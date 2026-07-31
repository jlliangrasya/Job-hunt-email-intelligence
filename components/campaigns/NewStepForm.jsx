"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getDomainConfig } from "@/lib/opportunity/domain-config";

export function NewStepForm({ campaignId, onCreated, onCancel }) {
  const scenarioOptions = Object.entries(getDomainConfig("job").scenarios);
  const [label, setLabel] = useState("");
  const [scenario, setScenario] = useState(scenarioOptions[0]?.[0] ?? "");
  const [delayDays, setDelayDays] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), scenario, delay_days: Number(delayDays) }),
    });
    setSaving(false);
    if (!res.ok) { setError("Failed to add step."); return; }
    const { step } = await res.json();
    onCreated(step);
  }

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3"
    >
      <input
        autoFocus
        type="text"
        placeholder="Step label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="flex-1 min-w-[10rem] rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <select
        value={scenario}
        onChange={(e) => setScenario(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {scenarioOptions.map(([value, { label: scenarioLabel }]) => (
          <option key={value} value={value}>{scenarioLabel}</option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        max={90}
        value={delayDays}
        onChange={(e) => setDelayDays(e.target.value)}
        title="Days after the previous step (or enrollment, for the first step)"
        className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <span className="text-xs text-muted-foreground">days</span>
      <Button type="submit" size="sm" disabled={saving}>{saving ? "Adding..." : "Add Step"}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      {error && <p className="text-xs text-destructive w-full">{error}</p>}
    </motion.form>
  );
}
