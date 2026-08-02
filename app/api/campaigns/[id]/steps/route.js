import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request, { params }) {
  const { id: campaignId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  if (!body.label || !body.scenario) {
    return NextResponse.json({ error: "label and scenario are required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("campaign_steps")
    .select("step_order")
    .eq("campaign_id", campaignId)
    .order("step_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.step_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("campaign_steps")
    .insert({
      campaign_id: campaignId,
      user_id: user.id,
      step_order: nextOrder,
      label: body.label,
      scenario: body.scenario,
      delay_days: body.delay_days ?? 3,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ step: data });
}
