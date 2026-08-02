import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InteractionsTimeline } from "@/components/interactions/InteractionsTimeline";

export const metadata = { title: "Interactions — Hustle Hunter" };

export default async function InteractionsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: events } = await supabase
    .from("interaction_events")
    .select("*, opportunities(id, organization_name, context_title)")
    .eq("user_id", user.id)
    .order("received_at", { ascending: false })
    .limit(200);

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Interactions</h1>
      <InteractionsTimeline initialEvents={events ?? []} />
    </div>
  );
}
