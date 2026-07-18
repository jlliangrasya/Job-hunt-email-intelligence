"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function NewContactForm({ onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() && !email.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || null, email: email.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) { setError("Failed to create contact."); return; }
    const { contact } = await res.json();
    onCreated(contact);
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
        placeholder="Contact name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 max-w-xs rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 max-w-xs rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </motion.form>
  );
}
