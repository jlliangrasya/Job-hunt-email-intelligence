import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignalsFeed } from "@/components/signals/SignalsFeed";

export const metadata = { title: "Signals — Hustle Hunter" };

export default async function SignalsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: signals } = await supabase
    .from("interaction_events")
    .select("*, opportunities(id, organization_name, context_title)")
    .eq("user_id", user.id)
    .not("signal_type", "is", null)
    .order("received_at", { ascending: false })
    .limit(200);

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Signals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-detected reply signals across your opportunities — interview invites, offers, rejections, and more.
        </p>
      </div>
      <SignalsFeed signals={signals ?? []} />
    </div>
  );
}
