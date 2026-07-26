/**
 * Netlify Scheduled Function shim. Netlify has no equivalent of Vercel's
 * vercel.json cron -> Next.js route wiring, so this just pings the existing
 * /api/cron/renew-watches route on a schedule, reusing the same CRON_SECRET
 * bearer-token check the route already enforces.
 */
export default async () => {
  const baseUrl = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const res = await fetch(`${baseUrl}/api/cron/renew-watches`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return new Response(await res.text(), { status: res.status });
};

export const config = { schedule: "0 6 * * *" };
