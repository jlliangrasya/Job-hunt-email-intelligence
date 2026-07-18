import { createServiceClient } from "@/lib/supabase/server";
import { fetchHistorySince } from "@/lib/gmail/history";
import { fetchMessage } from "@/lib/gmail/messages";
import { classifyResponse } from "@/lib/groq/classify-response";
import { getDomainConfig } from "@/lib/opportunity/domain-config";

/**
 * Process a Gmail Pub/Sub webhook event.
 * Fetches new messages, matches them to known opportunities, classifies replies.
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

    const { data: opportunity } = await supabase
      .from("opportunities")
      .select("id, type, organization_name, context_title, subject, status")
      .eq("user_id", userId)
      .eq("channel_thread_id", msg.threadId)
      .single();

    if (!opportunity) continue;

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

    await supabase
      .from("opportunities")
      .update({
        status: newStatus,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", opportunity.id);

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
