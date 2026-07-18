import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setupGmailWatch } from "@/lib/gmail/watch";
import { GMAIL_SCOPES } from "@/lib/gmail/client";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const { session } = data;
  const userId = session.user.id;

  // Google only returns a refresh_token on first consent — never overwrite
  // an existing one with null on subsequent logins.
  const { data: existingToken } = await supabase
    .from("user_tokens")
    .select("google_refresh_token")
    .eq("user_id", userId)
    .single();

  const refreshToken = session.provider_refresh_token ?? existingToken?.google_refresh_token ?? null;

  // Supabase's session object doesn't expose the Google access token's exact
  // expiry, so we assume the standard ~1h lifetime here — token-manager.js
  // refreshes proactively (60s buffer) before every Gmail API call regardless.
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

  await supabase.from("user_tokens").upsert(
    {
      user_id: userId,
      google_access_token: session.provider_token,
      google_refresh_token: refreshToken,
      token_expires_at: expiresAt,
      gmail_address: session.user.email,
      scopes: GMAIL_SCOPES,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  await supabase
    .from("user_settings")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  if (refreshToken) {
    try {
      await setupGmailWatch(userId);
    } catch (e) {
      console.error("Gmail watch setup failed:", e);
    }
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("onboarding_completed")
    .eq("user_id", userId)
    .single();

  const destination = settings?.onboarding_completed ? "/dashboard" : "/onboarding";
  return NextResponse.redirect(`${origin}${destination}`);
}
