"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Mail } from "lucide-react";

export default function LoginPage() {
  const [supabase] = useState(() => createClient());

  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
        queryParams: { access_type: "offline", prompt: "consent" },
        // Derived from the live origin rather than NEXT_PUBLIC_SITE_URL: that var is
        // inlined at build time, so a missing/stale value silently produced
        // "undefined/auth/callback" and Supabase fell back to its Site URL.
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="size-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Hustle Hunter</h1>
          <p className="text-muted-foreground mt-1">
            Sign in with Google to track applications and draft AI-powered follow-ups.
          </p>
        </div>
        <Button onClick={handleSignIn} className="w-full">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
