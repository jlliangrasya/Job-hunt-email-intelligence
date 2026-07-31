import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeInsights } from "@/lib/analytics/compute-insights";
import { AnalyticsGrid } from "@/components/analytics/AnalyticsGrid";

export const metadata = { title: "Analytics — Hustle Hunter" };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const [{ data: opportunities }, { data: interactionEvents }, { data: outreachDrafts }] = await Promise.all([
    supabase.from("opportunities").select("*").eq("user_id", user.id),
    supabase.from("interaction_events").select("*").eq("user_id", user.id),
    supabase.from("outreach_drafts").select("*").eq("user_id", user.id),
  ]);

  const insights = computeInsights({
    opportunities: opportunities ?? [],
    interactionEvents: interactionEvents ?? [],
    outreachDrafts: outreachDrafts ?? [],
  });

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <AnalyticsGrid insights={insights} />
    </div>
  );
}
