import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/gmail/send";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId } = await request.json();

  const { data: draft } = await supabase
    .from("outreach_drafts")
    .select("*, opportunities!inner(id, user_id, recipient_email, channel_thread_id, subject)")
    .eq("id", draftId)
    .eq("user_id", user.id)
    .single();

  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const { data: tokenRow } = await supabase
    .from("user_tokens")
    .select("gmail_address")
    .eq("user_id", user.id)
    .single();

  const opportunity = draft.opportunities;
  const body = draft.body_edited ?? draft.body_markdown;
  const subject = draft.subject?.startsWith("Re:") ? draft.subject : `Re: ${draft.subject ?? opportunity.subject}`;

  const messageId = await sendEmail({
    userId: user.id,
    from: tokenRow?.gmail_address,
    to: opportunity.recipient_email,
    subject,
    body,
    threadId: opportunity.channel_thread_id,
  });

  await supabase
    .from("outreach_drafts")
    .update({
      was_sent: true,
      sent_at: new Date().toISOString(),
      channel_sent_message_id: messageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  await supabase.from("interaction_events").upsert(
    {
      user_id: user.id,
      opportunity_id: opportunity.id,
      channel: "email",
      channel_message_id: messageId,
      channel_thread_id: opportunity.channel_thread_id,
      direction: "sent",
      from_address: tokenRow?.gmail_address,
      to_addresses: [opportunity.recipient_email],
      subject,
      snippet: body.slice(0, 500),
      received_at: new Date().toISOString(),
    },
    { onConflict: "user_id,channel_message_id" }
  );

  return NextResponse.json({ ok: true, messageId });
}
