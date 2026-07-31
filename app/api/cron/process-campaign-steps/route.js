import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron-secret";
import { createServiceClient } from "@/lib/supabase/server";
import { processDueCampaignSteps } from "@/lib/campaigns/process-due-steps";

export async function GET(request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const processed = await processDueCampaignSteps(supabase);

  return NextResponse.json({ processed });
}
