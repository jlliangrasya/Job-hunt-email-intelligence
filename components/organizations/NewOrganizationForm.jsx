"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function NewOrganizationForm({ onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), website: website.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) { setError("Failed to create organization."); return; }
    const { organization } = await res.json();
    onCreated(organization);
  }

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit}
      className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30"
    >
      <input
        autoFocus
        type="text"
        placeholder="Organization name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 max-w-xs rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        type="text"
        placeholder="Website (optional)"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="flex-1 max-w-xs rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </motion.form>
  );
}
