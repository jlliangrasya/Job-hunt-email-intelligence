"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/FadeIn";

const CATEGORIES = ["template", "playbook", "snippet", "note"];

export function KnowledgeDetail({ item }) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category);
  const [body, setBody] = useState(item.body_markdown ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/knowledge/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category, body_markdown: body }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this knowledge item?")) return;
    const res = await fetch(`/api/knowledge/${item.id}`, { method: "DELETE" });
    if (res.ok) router.push("/knowledge");
  }

  return (
    <FadeIn className="flex flex-col gap-6">
      <form onSubmit={handleSave} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-ring"
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
        </div>
        <textarea
          rows={16}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your template, playbook, or notes here (markdown supported)..."
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving}>
            {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete}>Delete</Button>
        </div>
      </form>
    </FadeIn>
  );
}
