import { getValidGmailClient } from "./token-manager";
import { createServiceClient } from "@/lib/supabase/server";
import { classifyApplicationBatch } from "@/lib/groq/classify-application";
import { getHeader } from "@/lib/utils/email-parser";

const JOB_SEARCH_QUERY =
  'in:sent (applied OR application OR resume OR "cover letter" OR "position of" OR "opportunity at" OR "job application" OR "open role")';

/**
 * Scan sent mail for job applications and upsert them to the DB.
 * Yields progress events for SSE streaming.
 */
export async function* scanSentMail(userId, lookbackDays = 90) {
  const { gmail } = await getValidGmailClient(userId);
  const supabase = await createServiceClient();

  const messageIds = [];
  let pageToken;

  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - lookbackDays);
  const afterEpoch = Math.floor(afterDate.getTime() / 1000);

  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: `${JOB_SEARCH_QUERY} after:${afterEpoch}`,
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

    const classifications = await classifyApplicationBatch(emailInputs);

    for (let j = 0; j < batch.length; j++) {
      const msg = messages[j].data;
      const cls = classifications[j];

      if (cls?.isJobApplication && cls.confidence > 0.75) {
        await supabase.from("applications").upsert(
          {
            user_id: userId,
            gmail_thread_id: msg.threadId,
            gmail_message_id: msg.id,
            company_name: cls.companyName ?? "Unknown",
            role_title: cls.roleTitle,
            application_date: cls.applicationDate ?? new Date().toISOString().split("T")[0],
            subject: emailInputs[j].subject,
            recipient_email: emailInputs[j].to,
            ai_confidence: cls.confidence,
            raw_snippet: emailInputs[j].snippet.slice(0, 500),
            status: "applied",
          },
          { onConflict: "user_id,gmail_thread_id" }
        );
        detected++;
      }
    }

    scanned += batch.length;
    yield { scanned, total, detected };
  }

  await supabase
    .from("user_settings")
    .update({ initial_scan_completed: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
