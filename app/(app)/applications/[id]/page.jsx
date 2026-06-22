import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApplicationMeta } from "@/components/application/ApplicationMeta";
import { ThreadViewer } from "@/components/application/ThreadViewer";
import { DraftPanel } from "@/components/application/DraftPanel";

export default async function ApplicationDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!application) notFound();

  // Fetch thread from Dev 2's API route — non-fatal if not yet built
  let messages = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/applications/${id}/thread`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      messages = data.messages ?? [];
    }
  } catch {
    // Thread fetch failure is non-fatal
  }

  const { data: drafts } = await supabase
    .from("ai_drafts")
    .select("*")
    .eq("application_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto">
      <ApplicationMeta application={application} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Email Thread</h2>
          <ThreadViewer messages={messages} />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">AI Drafts</h2>
          <DraftPanel applicationId={id} initialDrafts={drafts ?? []} />
        </div>
      </div>
    </div>
  );
}
