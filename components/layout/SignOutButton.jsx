"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { useSupabase } from "@/components/providers/SupabaseProvider";

export function SignOutButton() {
  const supabase = useSupabase();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <motion.button
      type="button"
      aria-label="Sign out"
      onClick={handleSignOut}
      disabled={signingOut}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
    >
      <LogOut className="size-4" />
    </motion.button>
  );
}
