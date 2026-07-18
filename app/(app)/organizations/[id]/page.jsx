import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrganizationDetail } from "@/components/organizations/OrganizationDetail";

export default async function OrganizationDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!organization) notFound();

  const [{ data: opportunities }, { data: contacts }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, context_title, status, type, initiated_at")
      .eq("organization_id", id)
      .eq("user_id", user.id)
      .order("initiated_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("id, name, email, role")
      .eq("organization_id", id)
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <OrganizationDetail
        organization={organization}
        opportunities={opportunities ?? []}
        contacts={contacts ?? []}
      />
    </div>
  );
}
