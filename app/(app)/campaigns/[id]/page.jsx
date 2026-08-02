import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CampaignDetail } from "@/components/campaigns/CampaignDetail";

export default async function CampaignDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!campaign) notFound();

  const [{ data: steps }, { data: enrollments }] = await Promise.all([
    supabase
      .from("campaign_steps")
      .select("*")
      .eq("campaign_id", id)
      .eq("user_id", user.id)
      .order("step_order", { ascending: true }),
    supabase
      .from("campaign_enrollments")
      .select("*, opportunities(id, organization_name, context_title)")
      .eq("campaign_id", id)
      .eq("user_id", user.id)
      .order("enrolled_at", { ascending: false }),
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <CampaignDetail campaign={campaign} steps={steps ?? []} enrollments={enrollments ?? []} />
    </div>
  );
}
