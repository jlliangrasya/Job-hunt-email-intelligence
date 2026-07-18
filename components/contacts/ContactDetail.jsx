"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { FadeIn } from "@/components/motion/FadeIn";

const FIELDS = [
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "department", label: "Department" },
  { key: "linkedin_url", label: "LinkedIn" },
  { key: "phone", label: "Phone" },
];

export function ContactDetail({ contact, opportunities }) {
  const [form, setForm] = useState({
    email: contact.email ?? "",
    role: contact.role ?? "",
    department: contact.department ?? "",
    linkedin_url: contact.linkedin_url ?? "",
    phone: contact.phone ?? "",
    notes: contact.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/contacts/${contact.id}`, {
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
        <h1 className="text-2xl font-bold">{contact.name ?? contact.email ?? "Unnamed Contact"}</h1>
        {contact.organizations && (
          <Link href={`/organizations/${contact.organizations.id}`} className="text-sm text-primary hover:underline">
            {contact.organizations.name}
          </Link>
        )}
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
                  <span className="text-sm font-medium">
                    {opp.organization_name} — {opp.context_title ?? "Untitled"}
                  </span>
                  <StatusBadge status={opp.status} type={opp.type} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FadeIn>
  );
}
