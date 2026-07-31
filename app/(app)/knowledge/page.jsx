import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeGrid } from "@/components/knowledge/KnowledgeGrid";

export const metadata = { title: "Knowledge — Hustle Hunter" };

export default async function KnowledgePage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("knowledge_items")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Knowledge</h1>
      <KnowledgeGrid initialItems={items ?? []} />
    </div>
  );
}
