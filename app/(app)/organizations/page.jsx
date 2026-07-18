import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrganizationsTable } from "@/components/organizations/OrganizationsTable";

export const metadata = { title: "Organizations — Job Hunt Intel" };

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: organizations } = await supabase
    .from("organizations")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Organizations</h1>
      <OrganizationsTable initialOrganizations={organizations ?? []} />
    </div>
  );
}
