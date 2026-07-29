"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Free-text notes on the opportunity, persisted via PATCH /api/opportunities/[id]. */
export function NotesTab({ opportunityId, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not save notes.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Could not save notes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3"
    >
      <label htmlFor="opportunity-notes" className="text-xs text-muted-foreground uppercase tracking-wide">
        Notes
      </label>
      <textarea
        id="opportunity-notes"
        rows={10}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Interview prep, salary expectations, who referred you…"
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving} className="self-start">
        {saved ? "Saved!" : saving ? "Saving..." : "Save Notes"}
      </Button>
    </form>
  );
}
