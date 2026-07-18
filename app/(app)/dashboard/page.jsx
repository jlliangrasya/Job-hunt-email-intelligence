import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OpportunitiesTable } from "@/components/dashboard/OpportunitiesTable";
import { MissionControl } from "@/components/dashboard/mission-control/MissionControl";

export const metadata = { title: "Dashboard — Job Hunt Intel" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("*")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false });

  const [{ data: replies }, { data: notifications }] = await Promise.all([
    supabase
      .from("interaction_events")
      .select("id, opportunity_id, subject, from_address, received_at, opportunities(organization_name)")
      .eq("user_id", user.id)
      .eq("direction", "received")
      .order("received_at", { ascending: false })
      .limit(5),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <MissionControl
        opportunities={opportunities ?? []}
        replies={replies ?? []}
        notifications={notifications ?? []}
      />
      <OpportunitiesTable
        initialOpportunities={opportunities ?? []}
        userId={user.id}
      />
    </div>
  );
}
