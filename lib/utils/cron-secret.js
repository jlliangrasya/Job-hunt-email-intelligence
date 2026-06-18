/** Verify the Vercel Cron secret header. Returns true if valid. */
export function verifyCronSecret(request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
