import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchThread } from "@/lib/gmail/messages";

export async function GET(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, channel_thread_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let threadMessages = [];
  try {
    threadMessages = await fetchThread(user.id, opportunity.channel_thread_id);
  } catch (e) {
    console.error("Thread fetch failed:", e);
    return NextResponse.json({ messages: [] });
  }

  const { data: events } = await supabase
    .from("interaction_events")
    .select("channel_message_id, signal_type")
    .eq("opportunity_id", opportunity.id);

  const signalByMessageId = new Map((events ?? []).map((e) => [e.channel_message_id, e.signal_type]));

  const messages = threadMessages.map((msg) => ({
    id: msg.id,
    subject: msg.subject,
    from_address: msg.from,
    snippet: msg.snippet,
    received_at: msg.date,
    direction: msg.labelIds.includes("SENT") ? "sent" : "received",
    signal_type: signalByMessageId.get(msg.id) ?? null,
  }));

  return NextResponse.json({ messages });
}
