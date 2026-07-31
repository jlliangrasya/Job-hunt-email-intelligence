import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processDueCampaignSteps } from "@/lib/campaigns/process-due-steps";

/**
 * User-triggered equivalent of the cron sweep, for local testing without a
 * working scheduler ("Process Due Campaign Steps" in Quick Actions). Uses
 * the RLS-scoped client, so it's implicitly limited to the caller's own rows.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const processed = await processDueCampaignSteps(supabase);

  return NextResponse.json({ processed });
}
