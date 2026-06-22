import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { AppShell } from "@/components/layout/AppShell";

const DEV_USER = { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" };

export default async function AppLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true" ? DEV_USER : null);
  if (!user) redirect("/login");

  return (
    <SupabaseProvider>
      <AppShell userId={user.id} user={user}>
        {children}
      </AppShell>
    </SupabaseProvider>
  );
}
