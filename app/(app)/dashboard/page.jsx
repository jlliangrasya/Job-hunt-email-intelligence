import { createClient } from "@/lib/supabase/server";
import { ApplicationsTable } from "@/components/dashboard/ApplicationsTable";

export const metadata = { title: "Dashboard — Job Hunt Intel" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false });

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Applications</h1>
      <ApplicationsTable
        initialApplications={applications ?? []}
        userId={user.id}
      />
    </div>
  );
}
