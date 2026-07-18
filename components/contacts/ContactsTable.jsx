"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { NewContactForm } from "./NewContactForm";

export function ContactsTable({ initialContacts }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const router = useRouter();

  const filtered = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (c.name?.toLowerCase().includes(q)) || (c.email?.toLowerCase().includes(q));
  });

  function handleCreated(contact) {
    setContacts((prev) => [contact, ...prev]);
    setShowNewForm(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button size="sm" onClick={() => setShowNewForm((v) => !v)} className="ml-auto gap-1.5">
            <Plus className="size-3.5" /> New
          </Button>
        </div>

        {showNewForm && (
          <NewContactForm onCreated={handleCreated} onCancel={() => setShowNewForm(false)} />
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Users className="size-10 opacity-40" />
            <p className="text-sm">No contacts found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Organization</th>
                </tr>
              </thead>
              <StaggerList as="tbody">
                {filtered.map((contact) => (
                  <StaggerItem
                    as="tr"
                    key={contact.id}
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                    whileTap={{ scale: 0.995 }}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{contact.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{contact.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{contact.role ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{contact.organizations?.name ?? "—"}</td>
                  </StaggerItem>
                ))}
              </StaggerList>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
