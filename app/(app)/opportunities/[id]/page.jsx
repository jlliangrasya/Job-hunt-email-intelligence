import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OpportunityMeta } from "@/components/opportunity/OpportunityMeta";
import { ThreadViewer } from "@/components/opportunity/ThreadViewer";
import { OutreachPanel } from "@/components/opportunity/OutreachPanel";

export default async function OpportunityDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!opportunity) notFound();

  let messages = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/opportunities/${id}/thread`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      messages = data.messages ?? [];
    }
  } catch (e) {
    console.error("Thread fetch failed:", e);
  }

  const { data: drafts } = await supabase
    .from("outreach_drafts")
    .select("*")
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto">
      <OpportunityMeta opportunity={opportunity} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Email Thread</h2>
          <ThreadViewer messages={messages} />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">AI Drafts</h2>
          <OutreachPanel opportunityId={id} type={opportunity.type} initialDrafts={drafts ?? []} />
        </div>
      </div>
    </div>
  );
}
