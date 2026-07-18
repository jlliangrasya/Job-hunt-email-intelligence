import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron-secret";
import { createServiceClient } from "@/lib/supabase/server";
import { setupGmailWatch } from "@/lib/gmail/watch";

export async function GET(request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const expiringBefore = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data: watches } = await supabase
    .from("gmail_watches")
    .select("user_id")
    .eq("is_active", true)
    .lt("expiration", expiringBefore);

  const userIds = (watches ?? []).map((w) => w.user_id);
  let renewed = 0;

  for (let i = 0; i < userIds.length; i += 10) {
    const batch = userIds.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map((id) => setupGmailWatch(id)));
    renewed += results.filter((r) => r.status === "fulfilled").length;
  }

  return NextResponse.json({ renewed, total: userIds.length });
}
