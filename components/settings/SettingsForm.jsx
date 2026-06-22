"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/components/providers/SupabaseProvider";

export function SettingsForm({ userId, settings }) {
  const [followUpDays, setFollowUpDays] = useState(settings.follow_up_delay_days);
  const [digestEnabled, setDigestEnabled] = useState(settings.email_digest_enabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = useSupabase();

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from("user_settings")
      .update({ follow_up_delay_days: Number(followUpDays), email_digest_enabled: digestEnabled })
      .eq("user_id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Gmail? You'll need to reconnect to keep using the app.")) return;
    await fetch("/api/auth/revoke", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSave} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <h2 className="text-base font-semibold">Preferences</h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="follow-up-days" className="text-sm font-medium">
            Follow-up delay (days)
          </label>
          <input
            id="follow-up-days"
            type="number"
            min={1}
            max={60}
            value={followUpDays}
            onChange={(e) => setFollowUpDays(Number(e.target.value))}
            className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Applications with no reply after this many days are flagged for follow-up.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="email-digest"
            type="checkbox"
            checked={digestEnabled}
            onChange={(e) => setDigestEnabled(e.target.checked)}
            className="size-4 rounded border-border"
          />
          <label htmlFor="email-digest" className="text-sm font-medium">
            Send daily email digest
          </label>
        </div>

        <Button type="submit" disabled={saving} className="self-start">
          {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>

      <div className="rounded-xl border border-destructive/30 bg-card p-5 flex flex-col gap-3">
        <h2 className="text-base font-semibold">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">
          Disconnecting Gmail stops all scanning and webhooks. Your existing application data is preserved.
        </p>
        <Button variant="destructive" onClick={handleDisconnect} className="self-start">
          Disconnect Gmail
        </Button>
      </div>
    </div>
  );
}
