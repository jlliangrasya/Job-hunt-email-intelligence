/** See cron-renew-watches.mjs for why this shim exists. */
export default async () => {
  const baseUrl = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const res = await fetch(`${baseUrl}/api/cron/follow-up-reminders`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return new Response(await res.text(), { status: res.status });
};

export const config = { schedule: "0 9 * * *" };
