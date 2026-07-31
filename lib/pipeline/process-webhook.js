import { createServiceClient } from "@/lib/supabase/server";
import { fetchHistorySince } from "@/lib/gmail/history";
import { fetchMessage } from "@/lib/gmail/messages";
import { classifyResponse } from "@/lib/groq/classify-response";
import { classifySignalBatch } from "@/lib/groq/classify-signal";
import { getDomainConfig, matchesInboundSignal } from "@/lib/opportunity/domain-config";
import { priorityFields } from "@/lib/opportunity/priority";
import { findOpportunityByThread, linkOrCreateOpportunity } from "@/lib/opportunity/link";
import { isNoReplyAddress, parseAddress } from "@/lib/utils/email-parser";
import { toDateOnly } from "@/lib/utils/date";

/** Confidence below which an inbound detection is not worth writing. */
const MIN_CONFIDENCE = 0.75;

/**
 * A message on a thread we don't track. Before the two-sided detection work this
 * was simply dropped, which meant every "Easy Apply" confirmation was invisible:
 * with no sent email there was no opportunity for it to match, so the
 * application went untracked and the recruiter's eventual reply had nothing to
 * attach to either.
 *
 * Returns the created opportunity, or null when the message isn't a confirmation
 * (the overwhelmingly common case — most unmatched inbox mail is unrelated).
 */
async function detectFromInbound(supabase, userId, msg, type = "job") {
  // Gate the LLM on a cheap sender/subject test — the webhook sees every message
  // that reaches the inbox, and classifying all of them would be both slow and
  // expensive. This applies the same criteria the scan gets from Gmail search.
  if (!matchesInboundSignal(type, { from: msg.from, subject: msg.subject })) return null;

  const [classification] = await classifySignalBatch(
    [{ subject: msg.subject, from: msg.from, date: msg.date, snippet: msg.snippet }],
    type,
    "inbound"
  );

  if (!classification?.isOpportunity || !(classification.confidence > MIN_CONFIDENCE)) {
    return null;
  }

  const sender = parseAddress(msg.from) || null;

  const { opportunity, created, linked } = await linkOrCreateOpportunity(supabase, {
    userId,
    type,
    threadId: msg.threadId,
    messageId: msg.id,
    detectionSource: "inbound",
    organizationName: classification.organizationName,
    contextTitle: classification.contextTitle,
    // The model's date is free text and may not parse; fall back to the message
    // header rather than to today.
    initiatedAt: toDateOnly(classification.initiatedAt) ?? msg.date,
    subject: msg.subject,
    recipientEmail: isNoReplyAddress(msg.from) ? null : sender,
    sourceEmail: sender,
    confidence: classification.confidence,
    snippet: msg.snippet,
  });

  if (!opportunity) return null;

  const { inboundSignal, detectionNotification, defaultNotification } = getDomainConfig(type);

  await supabase.from("interaction_events").upsert(
    {
      user_id: userId,
      opportunity_id: opportunity.id,
      channel: "email",
      channel_message_id: msg.id,
      channel_thread_id: msg.threadId,
      direction: "received",
      from_address: msg.from,
      to_addresses: [msg.to],
      subject: msg.subject,
      snippet: msg.snippet.slice(0, 500),
      received_at: new Date().toISOString(),
      signal_type: inboundSignal ?? "application_confirmation",
      signal_raw: classification,
    },
    { onConflict: "user_id,channel_message_id" }
  );

  // Linking an extra thread onto an application the user already knows about
  // isn't news; a brand-new one they never emailed about is.
  if (created && !linked) {
    await supabase.from("notifications").insert({
      user_id: userId,
      opportunity_id: opportunity.id,
      type: detectionNotification ?? defaultNotification,
      title: `Application detected at ${opportunity.organization_name}`,
      body: msg.snippet.slice(0, 200),
    });
  }

  return opportunity;
}

/**
 * Process a Gmail Pub/Sub webhook event.
 *
 * Fetches new messages and either classifies them as replies to a tracked
 * opportunity, or — when nothing matches the thread — tests them for being an
 * application confirmation and creates the opportunity from that.
 */
export async function processWebhookEvent(emailAddress, incomingHistoryId) {
  const supabase = await createServiceClient();

  const { data: tokenRow } = await supabase
    .from("user_tokens")
    .select("user_id")
    .eq("gmail_address", emailAddress)
    .single();

  if (!tokenRow) return;
  const userId = tokenRow.user_id;

  // Use the PREVIOUS historyId as cursor — NOT the one from the notification
  const { data: watchRow } = await supabase
    .from("gmail_watches")
    .select("history_id")
    .eq("user_id", userId)
    .single();

  if (!watchRow) return;

  const additions = await fetchHistorySince(userId, watchRow.history_id);

  for (const addition of additions) {
    const messageId = addition.message?.id;
    if (!messageId) continue;

    const msg = await fetchMessage(userId, messageId);
    if (msg.labelIds.includes("SENT")) continue;

    // Thread lookup spans every thread linked to an opportunity, not just the
    // originating one — an application can span several unrelated threads.
    const opportunity = await findOpportunityByThread(
      supabase,
      userId,
      msg.threadId,
      "id, type, organization_name, context_title, subject, status, recipient_email, follow_up_due_at"
    );

    if (!opportunity) {
      // A failed detection must not abort the event: the loop would exit before
      // the history cursor advances, so one message the classifier chokes on
      // would stall reply processing for every later message indefinitely. The
      // daily rescan (app/api/cron/scan-sent-mail) re-covers the inbound side,
      // so a dropped detection here is recovered rather than lost.
      try {
        await detectFromInbound(supabase, userId, msg);
      } catch (e) {
        console.error("Inbound detection failed:", e);
      }
      continue;
    }

    const { replySignalToStatus, replySignalToNotification, defaultNotification } =
      getDomainConfig(opportunity.type);

    const classification = await classifyResponse({
      type: opportunity.type,
      organizationName: opportunity.organization_name,
      contextTitle: opportunity.context_title,
      originalSubject: opportunity.subject ?? "",
      replyFrom: msg.from,
      replySubject: msg.subject,
      replySnippet: msg.snippet,
    });

    const newStatus = replySignalToStatus[classification.replyType] ?? "replied";
    const lastActivityAt = new Date().toISOString();

    const update = {
      status: newStatus,
      last_activity_at: lastActivityAt,
      updated_at: new Date().toISOString(),
      ...priorityFields({
        type: opportunity.type,
        status: newStatus,
        last_activity_at: lastActivityAt,
        follow_up_due_at: opportunity.follow_up_due_at,
      }),
    };

    // An opportunity detected from a board confirmation has no reply target — the
    // confirmation came from a no-reply address. The first real human to write in
    // supplies one, which is what makes outreach possible on these at all.
    if (!opportunity.recipient_email && !isNoReplyAddress(msg.from)) {
      update.recipient_email = parseAddress(msg.from);
    }

    await supabase.from("opportunities").update(update).eq("id", opportunity.id);

    await supabase.from("interaction_events").upsert(
      {
        user_id: userId,
        opportunity_id: opportunity.id,
        channel: "email",
        channel_message_id: msg.id,
        channel_thread_id: msg.threadId,
        direction: "received",
        from_address: msg.from,
        to_addresses: [msg.to],
        subject: msg.subject,
        snippet: msg.snippet.slice(0, 500),
        received_at: new Date().toISOString(),
        signal_type: classification.replyType,
        signal_raw: classification,
      },
      { onConflict: "user_id,channel_message_id" }
    );

    await supabase.from("notifications").insert({
      user_id: userId,
      opportunity_id: opportunity.id,
      type: replySignalToNotification[classification.replyType] ?? defaultNotification,
      title: `${classification.replyType.replace(/_/g, " ")} from ${opportunity.organization_name}`,
      body: msg.snippet.slice(0, 200),
    });
  }

  await supabase
    .from("gmail_watches")
    .update({ history_id: incomingHistoryId, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
