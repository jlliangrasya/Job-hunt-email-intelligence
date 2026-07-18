import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOAuth2Client } from "@/lib/gmail/client";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tokenRow } = await supabase
    .from("user_tokens")
    .select("google_refresh_token")
    .eq("user_id", user.id)
    .single();

  if (tokenRow?.google_refresh_token) {
    try {
      const oauth2Client = createOAuth2Client();
      await oauth2Client.revokeToken(tokenRow.google_refresh_token);
    } catch (e) {
      console.error("Google token revoke failed:", e);
    }
  }

  await supabase.from("gmail_watches").delete().eq("user_id", user.id);
  await supabase.from("user_tokens").delete().eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
