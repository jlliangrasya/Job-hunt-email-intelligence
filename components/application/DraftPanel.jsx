"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { DraftEditor } from "./DraftEditor";

const DRAFT_TYPES = [
  { value: "follow_up",         label: "Follow Up" },
  { value: "interview_confirm", label: "Confirm Interview" },
  { value: "info_response",     label: "Answer Info Request" },
  { value: "offer_accept",      label: "Accept Offer" },
  { value: "offer_decline",     label: "Decline Offer" },
  { value: "general_reply",     label: "General Reply" },
];

export function DraftPanel({ applicationId, initialDrafts }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selectedType, setSelectedType] = useState("follow_up");
  const [generating, setGenerating] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState(initialDrafts[0]?.id ?? null);
  const [sending, setSending] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, draftType: selectedType }),
      });
      if (!res.ok) return;
      const { draft } = await res.json();
      setDrafts((prev) => [draft, ...prev]);
      setActiveDraftId(draft.id);
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdate(draftId, body) {
    const res = await fetch(`/api/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body_edited: body }),
    });
    if (res.ok) {
      const { draft } = await res.json();
      setDrafts((prev) => prev.map((d) => (d.id === draftId ? draft : d)));
    }
  }

  async function handleSend(draftId) {
    setSending(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      if (res.ok) {
        setDrafts((prev) =>
          prev.map((d) => (d.id === draftId ? { ...d, was_sent: true } : d))
        );
      }
    } finally {
      setSending(false);
    }
  }

  const activeDraft = drafts.find((d) => d.id === activeDraftId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {DRAFT_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <Button onClick={handleGenerate} disabled={generating} size="sm">
          {generating ? <Loader2 className="size-3.5 animate-spin" /> : "Generate"}
        </Button>
      </div>

      {drafts.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {drafts.map((d, i) => (
            <Button
              key={d.id}
              variant="ghost"
              size="sm"
              onClick={() => setActiveDraftId(d.id)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                d.id === activeDraftId
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted"
              }`}
            >
              Draft {i + 1}
            </Button>
          ))}
        </div>
      )}

      {activeDraft ? (
        <DraftEditor
          draft={activeDraft}
          onUpdate={(body) => handleUpdate(activeDraft.id, body)}
          onSend={() => handleSend(activeDraft.id)}
          sending={sending}
        />
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-xl">
          No draft yet. Choose a type and click Generate.
        </p>
      )}
    </div>
  );
}
