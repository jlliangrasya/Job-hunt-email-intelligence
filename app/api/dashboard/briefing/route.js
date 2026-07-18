import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateBriefing } from "@/lib/groq/generate-briefing";
import { rankByPriority } from "@/lib/opportunity/priority";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("organization_name, context_title, status, last_activity_at, follow_up_due_at, is_archived")
    .eq("user_id", user.id)
    .eq("is_archived", false);

  const active = opportunities ?? [];

  const statusCounts = active.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const overdueFollowUpsCount = active.filter(
    (o) => o.follow_up_due_at && new Date(o.follow_up_due_at) < new Date()
  ).length;

  const priorityOpportunities = rankByPriority(active, 5).map((entry) => ({
    organization_name: entry.opportunity.organization_name,
    context_title: entry.opportunity.context_title,
    reason: entry.reason,
  }));

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const { count: recentRepliesCount } = await supabase
    .from("interaction_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("direction", "received")
    .gte("received_at", twoDaysAgo.toISOString());

  const briefing = await generateBriefing({
    statusCounts,
    priorityOpportunities,
    overdueFollowUpsCount,
    recentRepliesCount: recentRepliesCount ?? 0,
  });

  return NextResponse.json({ ...briefing, generatedAt: new Date().toISOString() });
}
