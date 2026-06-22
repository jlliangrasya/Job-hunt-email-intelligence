import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata = { title: "Setup — Job Hunt Intel" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .single();

  if (settings?.onboarding_completed) redirect("/dashboard");

  const { data: tokens } = await supabase
    .from("user_tokens")
    .select("google_refresh_token")
    .eq("user_id", user.id)
    .single();

  const hasGmail = !!tokens?.google_refresh_token;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Welcome to Job Hunt Intel</h1>
        <p className="text-muted-foreground mt-1">Let's get your applications set up.</p>
      </div>
      <OnboardingWizard hasGmail={hasGmail} />
    </div>
  );
}
