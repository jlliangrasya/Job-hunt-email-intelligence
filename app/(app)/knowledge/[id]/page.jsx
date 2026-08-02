import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeDetail } from "@/components/knowledge/KnowledgeDetail";

export default async function KnowledgeDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: item } = await supabase
    .from("knowledge_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!item) notFound();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <KnowledgeDetail item={item} />
    </div>
  );
}
