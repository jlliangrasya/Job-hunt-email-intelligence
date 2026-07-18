import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron-secret";
import { createServiceClient } from "@/lib/supabase/server";
import { discoverOpportunities } from "@/lib/gmail/scan";

/**
 * Gmail watches only cover INBOX (see lib/gmail/watch.js), so newly sent
 * opportunity emails have no realtime push — a short-lookback rescan is the
 * incremental-detection mechanism for the Sent folder.
 */
async function runIncrementalScan(userId) {
  for await (const _progress of discoverOpportunities(userId, "job", 2)) {
    // drain the generator; per-message progress isn't needed for the cron sweep
  }
}

export async function GET(request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const { data: tokens } = await supabase
    .from("user_tokens")
    .select("user_id")
    .not("google_refresh_token", "is", null);

  const userIds = (tokens ?? []).map((t) => t.user_id);
  let scanned = 0;

  for (let i = 0; i < userIds.length; i += 10) {
    const batch = userIds.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map(runIncrementalScan));
    scanned += results.filter((r) => r.status === "fulfilled").length;
  }

  return NextResponse.json({ scanned, total: userIds.length });
}
