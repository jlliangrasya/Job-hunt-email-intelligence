import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron-secret";
import { createServiceClient } from "@/lib/supabase/server";
import { getDomainConfig } from "@/lib/opportunity/domain-config";
import { priorityFields } from "@/lib/opportunity/priority";

export async function GET(request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  const { data: settingsRows } = await supabase
    .from("user_settings")
    .select("user_id, stale_threshold_days");

  let flagged = 0;

  for (const { user_id, stale_threshold_days } of settingsRows ?? []) {
    const thresholdDays = stale_threshold_days ?? 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - thresholdDays);

    const { data: opportunities } = await supabase
      .from("opportunities")
      .select("id, type, status, organization_name, initiated_at, last_activity_at")
      .eq("user_id", user_id)
      .eq("is_archived", false)
      .lt("initiated_at", cutoff.toISOString().split("T")[0]);

    for (const opp of opportunities ?? []) {
      const { staleStatus, staleTransitionStatus } = getDomainConfig(opp.type);
      if (opp.status !== staleStatus) continue;

      const followUpDueAt = new Date().toISOString();

      await supabase
        .from("opportunities")
        .update({
          status: staleTransitionStatus,
          follow_up_due_at: followUpDueAt,
          updated_at: new Date().toISOString(),
          ...priorityFields({
            type: opp.type,
            status: staleTransitionStatus,
            last_activity_at: opp.last_activity_at,
            follow_up_due_at: followUpDueAt,
          }),
        })
        .eq("id", opp.id);

      await supabase.from("notifications").insert({
        user_id,
        opportunity_id: opp.id,
        type: "follow_up_reminder",
        title: `Follow-up due: ${opp.organization_name}`,
        body: `No reply after ${thresholdDays} days.`,
      });

      flagged++;
    }
  }

  return NextResponse.json({ flagged });
}
