import { getValidGmailClient } from "./token-manager";
import { createServiceClient } from "@/lib/supabase/server";
import { classifySignalBatch } from "@/lib/groq/classify-signal";
import { getDomainConfig } from "@/lib/opportunity/domain-config";
import { linkOrCreateOpportunity } from "@/lib/opportunity/link";
import { getHeader, isNoReplyAddress, parseAddress } from "@/lib/utils/email-parser";
import { toDateOnly } from "@/lib/utils/date";
import { withRetry } from "@/lib/utils/retry";

/**
 * The two directions an application leaves evidence in a mailbox. Scanning only
 * the sent side misses every "Easy Apply" — LinkedIn/Indeed and ATS submissions
 * produce no sent mail at all, just a confirmation in the inbox.
 *
 * The counterparty header differs per direction, and it is fetched into the same
 * `to`/`from` shape the classifier expects for that direction.
 */
const DIRECTIONS = [
  { direction: "sent", queryKey: "detectionQuery", headers: ["Subject", "To", "Date"] },
  { direction: "inbound", queryKey: "inboundDetectionQuery", headers: ["Subject", "From", "Date"] },
];

/** Confidence below which a classification is not worth writing to the DB. */
const MIN_CONFIDENCE = 0.75;

/** Messages fetched and classified per Groq call (see classifySignalBatch). */
const BATCH_SIZE = 5;

async function listMessageIds(gmail, query, afterEpoch) {
  const ids = [];
  let pageToken;

  do {
    const res = await withRetry(() =>
      gmail.users.messages.list({
        userId: "me",
        q: `${query} after:${afterEpoch}`,
        maxResults: 500,
        pageToken,
      })
    );
    ids.push(...(res.data.messages ?? []).map((m) => m.id));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return ids;
}

/**
 * Scan the mailbox for opportunities of the given type and upsert them.
 * Yields progress events for SSE streaming.
 *
 * Both directions are counted into a single `total` before any classification
 * runs, so the progress bar doesn't jump backwards when the second pass starts.
 */
export async function* discoverOpportunities(userId, type = "job", lookbackDays = 90) {
  const { gmail } = await getValidGmailClient(userId);
  const supabase = await createServiceClient();
  const config = getDomainConfig(type);

  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - lookbackDays);
  const afterEpoch = Math.floor(afterDate.getTime() / 1000);

  const passes = [];
  for (const spec of DIRECTIONS) {
    const query = config[spec.queryKey];
    if (!query) continue;
    passes.push({ ...spec, messageIds: await listMessageIds(gmail, query, afterEpoch) });
  }

  const total = passes.reduce((sum, pass) => sum + pass.messageIds.length, 0);
  let scanned = 0;
  let detected = 0;

  for (const pass of passes) {
    const inbound = pass.direction === "inbound";

    for (let i = 0; i < pass.messageIds.length; i += BATCH_SIZE) {
      const batch = pass.messageIds.slice(i, i + BATCH_SIZE);

      const messages = await Promise.all(
        batch.map((id) =>
          withRetry(() =>
            gmail.users.messages.get({
              userId: "me",
              id,
              format: "metadata",
              metadataHeaders: pass.headers,
            })
          )
        )
      );

      const emailInputs = messages.map((res) => ({
        subject: getHeader(res.data, "Subject"),
        to: inbound ? "" : getHeader(res.data, "To"),
        from: inbound ? getHeader(res.data, "From") : "",
        date: getHeader(res.data, "Date"),
        snippet: res.data.snippet ?? "",
      }));

      const classifications = await classifySignalBatch(emailInputs, type, pass.direction);

      for (let j = 0; j < batch.length; j++) {
        const msg = messages[j].data;
        const cls = classifications[j];
        if (!cls?.isOpportunity || !(cls.confidence > MIN_CONFIDENCE)) continue;

        const email = emailInputs[j];
        const sender = inbound ? parseAddress(email.from) || null : null;

        const { created } = await linkOrCreateOpportunity(supabase, {
          userId,
          type,
          threadId: msg.threadId,
          messageId: msg.id,
          detectionSource: pass.direction,
          organizationName: cls.organizationName,
          contextTitle: cls.contextTitle,
          // The model's date is preferred but unreliable — it is free text and
          // may not parse. The Date header is the fallback, not today's date.
          initiatedAt: toDateOnly(cls.initiatedAt) ?? email.date,
          subject: email.subject,
          // Board and ATS confirmations come from unmonitored addresses, so they
          // are recorded as provenance and never as an outreach target. An absent
          // address is NULL, never "" — an empty string reads as a real value to
          // the UI and would render a blank Recipient instead of a dash.
          recipientEmail: inbound
            ? isNoReplyAddress(email.from)
              ? null
              : sender
            : email.to || null,
          sourceEmail: sender,
          confidence: cls.confidence,
          snippet: email.snippet,
        });

        if (created) detected++;
      }

      scanned += batch.length;
      yield { scanned, total, detected };
    }
  }

  await supabase
    .from("user_settings")
    .update({ initial_discovery_completed: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
