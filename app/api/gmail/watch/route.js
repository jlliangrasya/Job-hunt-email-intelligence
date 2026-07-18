import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setupGmailWatch } from "@/lib/gmail/watch";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { historyId, expiration } = await setupGmailWatch(user.id);
    return NextResponse.json({ historyId, expiration });
  } catch (e) {
    console.error("Gmail watch setup failed:", e);
    return NextResponse.json({ error: "Watch setup failed" }, { status: 500 });
  }
}
