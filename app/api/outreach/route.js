import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOutreach } from "@/lib/groq/generate-outreach";
import { fetchThread } from "@/lib/gmail/messages";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { opportunityId, scenario, userNotes } = await request.json();

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", opportunityId)
    .eq("user_id", user.id)
    .single();

  if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let threadMessages = [];
  try {
    const raw = await fetchThread(user.id, opportunity.channel_thread_id);
    threadMessages = raw.map((m) => ({ date: m.date, from: m.from, snippet: m.snippet }));
  } catch (e) {
    console.error("Thread fetch failed for draft context:", e);
  }

  const result = await generateOutreach({
    type: opportunity.type,
    organizationName: opportunity.organization_name,
    contextTitle: opportunity.context_title,
    initiatedAt: opportunity.initiated_at,
    status: opportunity.status,
    scenario,
    threadMessages,
    userNotes,
  });

  const { data: draft, error } = await supabase
    .from("outreach_drafts")
    .insert({
      user_id: user.id,
      opportunity_id: opportunity.id,
      scenario,
      subject: result.subject,
      body_markdown: result.body,
      ai_model: "llama3-70b-8192",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft });
}
