"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { OutreachEditor } from "./OutreachEditor";
import { getDomainConfig } from "@/lib/opportunity/domain-config";

export function OutreachPanel({ opportunityId, type = "job", initialDrafts }) {
  const { scenarios } = getDomainConfig(type);
  const scenarioOptions = Object.entries(scenarios).map(([value, { label }]) => ({ value, label }));

  const [drafts, setDrafts] = useState(initialDrafts);
  const [selectedScenario, setSelectedScenario] = useState(scenarioOptions[0]?.value);
  const [generating, setGenerating] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState(initialDrafts[0]?.id ?? null);
  const [sending, setSending] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, scenario: selectedScenario }),
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
    const res = await fetch(`/api/outreach/${draftId}`, {
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
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {scenarioOptions.map(({ value, label }) => (
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
        <OutreachEditor
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
