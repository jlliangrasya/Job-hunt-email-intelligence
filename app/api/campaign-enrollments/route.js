import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveNextStep, computeDueAt } from "@/lib/campaigns/scheduling";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { opportunityId, campaignId } = await request.json();
  if (!opportunityId || !campaignId) {
    return NextResponse.json({ error: "opportunityId and campaignId are required" }, { status: 400 });
  }

  const { data: steps } = await supabase
    .from("campaign_steps")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .order("step_order", { ascending: true });

  if (!steps?.length) {
    return NextResponse.json({ error: "Campaign has no steps yet" }, { status: 400 });
  }

  const firstStep = resolveNextStep(steps, 0);
  const now = new Date();

  const { data, error } = await supabase
    .from("campaign_enrollments")
    .insert({
      user_id: user.id,
      campaign_id: campaignId,
      opportunity_id: opportunityId,
      current_step_index: 0,
      status: "active",
      next_step_due_at: computeDueAt(firstStep, now),
    })
    .select("*, opportunities(id, organization_name, context_title)")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This opportunity is already enrolled in an active campaign" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ enrollment: data });
}
