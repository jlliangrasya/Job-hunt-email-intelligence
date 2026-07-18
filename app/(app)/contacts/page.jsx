import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContactsTable } from "@/components/contacts/ContactsTable";

export const metadata = { title: "Contacts — Job Hunt Intel" };

export default async function ContactsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*, organizations(id, name)")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Contacts</h1>
      <ContactsTable initialContacts={contacts ?? []} />
    </div>
  );
}
