"use client";
import { useState } from "react";
import Link from "next/link";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/FadeIn";
import { getDomainConfig } from "@/lib/opportunity/domain-config";
import { NewStepForm } from "./NewStepForm";

const ENROLLMENT_STATUS_LABEL = { active: "Active", paused: "Paused", completed: "Completed", cancelled: "Cancelled" };

export function CampaignDetail({ campaign, steps: initialSteps, enrollments }) {
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description ?? "");
  const [steps, setSteps] = useState(initialSteps);
  const [showNewStep, setShowNewStep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const scenarioLabels = getDomainConfig("job").scenarios;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function handleStepCreated(step) {
    setSteps((prev) => [...prev, step]);
    setShowNewStep(false);
  }

  async function handleDeleteStep(stepId) {
    if (!confirm("Remove this step?")) return;
    const res = await fetch(`/api/campaigns/${campaign.id}/steps/${stepId}`, { method: "DELETE" });
    if (res.ok) setSteps((prev) => prev.filter((s) => s.id !== stepId));
  }

  return (
    <FadeIn className="flex flex-col gap-6">
      <form onSubmit={handleSave} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <textarea
          rows={2}
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" disabled={saving} className="self-start">
          {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>

      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
        <h2 className="text-base font-semibold">Steps</h2>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No steps yet — add at least one before enrolling opportunities.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {steps.map((step, i) => (
              <li
                key={step.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{step.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {scenarioLabels[step.scenario]?.label ?? step.scenario} · {step.delay_days} day{step.delay_days === 1 ? "" : "s"} after previous
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteStep(step.id)} aria-label="Remove step">
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ol>
        )}

        {showNewStep ? (
          <NewStepForm campaignId={campaign.id} onCreated={handleStepCreated} onCancel={() => setShowNewStep(false)} />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowNewStep(true)} className="self-start gap-1.5">
            <Plus className="size-3.5" /> Add Step
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
        <h2 className="text-base font-semibold">Enrolled Opportunities</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No opportunities enrolled yet — enroll one from its Campaign tab.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {enrollments.map((enrollment) => {
              const opportunity = enrollment.opportunities;
              return (
                <li key={enrollment.id}>
                  <Link
                    href={`/opportunities/${opportunity?.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium truncate">
                      {opportunity?.organization_name ?? "Unknown"} — {opportunity?.context_title ?? "Untitled"}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      Step {enrollment.current_step_index} of {steps.length} · {ENROLLMENT_STATUS_LABEL[enrollment.status]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </FadeIn>
  );
}
