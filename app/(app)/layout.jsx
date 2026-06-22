import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <SupabaseProvider>
      <AppShell userId={user.id} user={user}>
        {children}
      </AppShell>
    </SupabaseProvider>
  );
}
