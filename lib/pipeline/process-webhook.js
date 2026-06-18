import { createServiceClient } from "@/lib/supabase/server";
import { fetchHistorySince } from "@/lib/gmail/history";
import { fetchMessage } from "@/lib/gmail/messages";
import { classifyReply } from "@/lib/groq/classify-reply";

const REPLY_TYPE_TO_STATUS = {
  interview_invite: "interview",
  rejection: "rejected",
  info_request: "replied",
  offer: "offer",
  acknowledgment: "replied",
  other: "replied",
};

const NOTIF_TYPE_MAP = {
  interview_invite: "interview_detected",
  rejection: "rejection_detected",
  offer: "offer_detected",
};

/**
 * Process a Gmail Pub/Sub webhook event.
 * Fetches new messages, matches them to known applications, classifies replies.
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

    const { data: application } = await supabase
      .from("applications")
      .select("id, company_name, role_title, subject, status")
      .eq("user_id", userId)
      .eq("gmail_thread_id", msg.threadId)
      .single();

    if (!application) continue;

    const classification = await classifyReply({
      companyName: application.company_name,
      roleTitle: application.role_title,
      originalSubject: application.subject ?? "",
      replyFrom: msg.from,
      replySubject: msg.subject,
      replySnippet: msg.snippet,
    });

    const newStatus = REPLY_TYPE_TO_STATUS[classification.replyType] ?? "replied";

    await supabase
      .from("applications")
      .update({
        status: newStatus,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", application.id);

    await supabase.from("email_events").upsert(
      {
        user_id: userId,
        application_id: application.id,
        gmail_message_id: msg.id,
        gmail_thread_id: msg.threadId,
        direction: "received",
        from_address: msg.from,
        to_addresses: [msg.to],
        subject: msg.subject,
        snippet: msg.snippet.slice(0, 500),
        received_at: new Date().toISOString(),
        groq_reply_type: classification.replyType,
        groq_raw_response: classification,
      },
      { onConflict: "user_id,gmail_message_id" }
    );

    await supabase.from("notifications").insert({
      user_id: userId,
      application_id: application.id,
      type: NOTIF_TYPE_MAP[classification.replyType] ?? "reply_received",
      title: `${classification.replyType.replace(/_/g, " ")} from ${application.company_name}`,
      body: msg.snippet.slice(0, 200),
    });
  }

  await supabase
    .from("gmail_watches")
    .update({ history_id: incomingHistoryId, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
