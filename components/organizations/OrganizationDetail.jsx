"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { FadeIn } from "@/components/motion/FadeIn";

const FIELDS = [
  { key: "website", label: "Website" },
  { key: "industry", label: "Industry" },
  { key: "size", label: "Size" },
  { key: "location", label: "Location" },
];

export function OrganizationDetail({ organization, opportunities, contacts }) {
  const [form, setForm] = useState({
    website: organization.website ?? "",
    industry: organization.industry ?? "",
    size: organization.size ?? "",
    location: organization.location ?? "",
    notes: organization.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/organizations/${organization.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <FadeIn className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{organization.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">Organization profile</p>
      </div>

      <form onSubmit={handleSave} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <h2 className="text-base font-semibold">Profile</h2>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1">
              <label htmlFor={key} className="text-xs text-muted-foreground uppercase tracking-wide">{label}</label>
              <input
                id={key}
                type="text"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="notes" className="text-xs text-muted-foreground uppercase tracking-wide">Notes</label>
          <textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button type="submit" disabled={saving} className="self-start">
          {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>

      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
        <h2 className="text-base font-semibold">Related Opportunities</h2>
        {opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No opportunities linked yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {opportunities.map((opp) => (
              <li key={opp.id}>
                <Link
                  href={`/opportunities/${opp.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted transition-colors"
                >
                  <span className="text-sm font-medium">{opp.context_title ?? "Untitled"}</span>
                  <StatusBadge status={opp.status} type={opp.type} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
        <h2 className="text-base font-semibold">Related Contacts</h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts linked yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted transition-colors"
                >
                  <span className="text-sm font-medium">{contact.name ?? contact.email ?? "Unnamed"}</span>
                  <span className="text-sm text-muted-foreground">{contact.role ?? "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FadeIn>
  );
}
