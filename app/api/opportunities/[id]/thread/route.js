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
    .select("id, channel_thread_id, channel_thread_ids")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // An application can span several threads — a board confirmation, an email you
  // sent, and the recruiter's reply are three separate conversations in Gmail.
  // Showing only the originating one would hide most of the exchange, so every
  // linked thread is merged and re-sorted into a single chronology.
  const threadIds = [
    ...new Set([opportunity.channel_thread_id, ...(opportunity.channel_thread_ids ?? [])].filter(Boolean)),
  ];

  // One unreadable thread (deleted in Gmail, say) must not blank out the rest.
  const fetched = await Promise.allSettled(
    threadIds.map((threadId) => fetchThread(user.id, threadId))
  );

  for (const result of fetched) {
    if (result.status === "rejected") console.error("Thread fetch failed:", result.reason);
  }

  const threadMessages = fetched
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .sort((a, b) => new Date(a.date ?? 0) - new Date(b.date ?? 0));

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
