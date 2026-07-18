import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContactDetail } from "@/components/contacts/ContactDetail";

export default async function ContactDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: contact } = await supabase
    .from("contacts")
    .select("*, organizations(id, name)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!contact) notFound();

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id, organization_name, context_title, status, type, initiated_at")
    .eq("contact_id", id)
    .eq("user_id", user.id)
    .order("initiated_at", { ascending: false });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <ContactDetail contact={contact} opportunities={opportunities ?? []} />
    </div>
  );
}
