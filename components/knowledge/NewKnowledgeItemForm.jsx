"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const CATEGORIES = ["template", "playbook", "snippet", "note"];

export function NewKnowledgeItemForm({ onCreated, onCancel }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("template");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), category, body_markdown: "" }),
    });
    setSaving(false);
    if (!res.ok) { setError("Failed to create item."); return; }
    const { item } = await res.json();
    onCreated(item);
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
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 max-w-xs rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </motion.form>
  );
}
