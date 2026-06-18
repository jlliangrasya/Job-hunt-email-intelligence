import { createServiceClient } from "@/lib/supabase/server";
import { createOAuth2Client, createGmailClient } from "./client";

/**
 * Get a valid (non-expired) Gmail client for the given user.
 * Refreshes the access token automatically if needed and persists it to DB.
 */
export async function getValidGmailClient(userId) {
  const supabase = await createServiceClient();

  const { data: tokenRow, error } = await supabase
    .from("user_tokens")
    .select("google_access_token, google_refresh_token, token_expires_at, gmail_address")
    .eq("user_id", userId)
    .single();

  if (error || !tokenRow) {
    throw new Error(`No Gmail token found for user ${userId}`);
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenRow.google_access_token,
    refresh_token: tokenRow.google_refresh_token,
  });

  const expiresAt = new Date(tokenRow.token_expires_at).getTime();
  const needsRefresh = expiresAt - Date.now() < 60_000;

  if (needsRefresh && tokenRow.google_refresh_token) {
    const { credentials } = await oauth2Client.refreshAccessToken();

    await supabase
      .from("user_tokens")
      .update({
        google_access_token: credentials.access_token,
        token_expires_at: new Date(credentials.expiry_date).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    oauth2Client.setCredentials(credentials);
  }

  return {
    gmail: createGmailClient(oauth2Client),
    gmailAddress: tokenRow.gmail_address,
  };
}
