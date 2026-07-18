import { getValidGmailClient } from "./token-manager";
import { createServiceClient } from "@/lib/supabase/server";
import { classifySignalBatch } from "@/lib/groq/classify-signal";
import { getDomainConfig } from "@/lib/opportunity/domain-config";
import { getHeader } from "@/lib/utils/email-parser";

/**
 * Scan sent mail for opportunities of the given type and upsert them to the DB.
 * Yields progress events for SSE streaming.
 */
export async function* discoverOpportunities(userId, type = "job", lookbackDays = 90) {
  const { gmail } = await getValidGmailClient(userId);
  const supabase = await createServiceClient();
  const { detectionQuery, initialStatus } = getDomainConfig(type);

  const messageIds = [];
  let pageToken;

  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - lookbackDays);
  const afterEpoch = Math.floor(afterDate.getTime() / 1000);

  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: `${detectionQuery} after:${afterEpoch}`,
      maxResults: 500,
      pageToken,
    });
    messageIds.push(...(res.data.messages ?? []).map((m) => m.id));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  const total = messageIds.length;
  let scanned = 0;
  let detected = 0;

  for (let i = 0; i < messageIds.length; i += 5) {
    const batch = messageIds.slice(i, i + 5);

    const messages = await Promise.all(
      batch.map((id) =>
        gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["Subject", "To", "Date"],
        })
      )
    );

    const emailInputs = messages.map((res) => ({
      subject: getHeader(res.data, "Subject"),
      to: getHeader(res.data, "To"),
      date: getHeader(res.data, "Date"),
      snippet: res.data.snippet ?? "",
    }));

    const classifications = await classifySignalBatch(emailInputs, type);

    for (let j = 0; j < batch.length; j++) {
      const msg = messages[j].data;
      const cls = classifications[j];

      if (cls?.isOpportunity && cls.confidence > 0.75) {
        const organizationName = cls.organizationName ?? "Unknown";
        let organizationId = null;
        if (organizationName !== "Unknown") {
          const { data: org } = await supabase
            .from("organizations")
            .upsert(
              { user_id: userId, name: organizationName },
              { onConflict: "user_id,name", ignoreDuplicates: false }
            )
            .select("id")
            .single();
          organizationId = org?.id ?? null;
        }

        await supabase.from("opportunities").upsert(
          {
            user_id: userId,
            type,
            channel: "email",
            channel_thread_id: msg.threadId,
            channel_message_id: msg.id,
            organization_id: organizationId,
            organization_name: organizationName,
            context_title: cls.contextTitle,
            initiated_at: cls.initiatedAt ?? new Date().toISOString().split("T")[0],
            subject: emailInputs[j].subject,
            recipient_email: emailInputs[j].to,
            ai_confidence: cls.confidence,
            raw_snippet: emailInputs[j].snippet.slice(0, 500),
            status: initialStatus,
          },
          { onConflict: "user_id,channel_thread_id" }
        );
        detected++;
      }
    }

    scanned += batch.length;
    yield { scanned, total, detected };
  }

  await supabase
    .from("user_settings")
    .update({ initial_discovery_completed: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
