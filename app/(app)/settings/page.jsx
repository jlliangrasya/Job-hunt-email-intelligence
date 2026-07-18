import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata = { title: "Settings — Job Hunt Intel" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("stale_threshold_days, email_digest_enabled, detection_lookback_days")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="p-6 flex flex-col gap-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm
        userId={user.id}
        settings={settings ?? { stale_threshold_days: 7, email_digest_enabled: false, detection_lookback_days: 90 }}
      />
    </div>
  );
}
