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
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm">
        <div className="rounded-xl border bg-primary/5 px-5 py-4 text-left">
          <p className="font-semibold">🎂 Happy birthday, Ate Kylyn!</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Hope today's a good one — the kind with your favorite food, no stress, and people
            around you who appreciate you as much as we do. Thank you for always looking out
            for us. Enjoy your day, you deserve it. Love you, Ate!
          </p>
        </div>
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="size-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Job Hunt Intel</h1>
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
