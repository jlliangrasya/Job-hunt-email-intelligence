import Link from "next/link";

/**
 * People attached to this opportunity: the contact the outreach was addressed to
 * (`opportunities.contact_id`), plus everyone else known at the same organization.
 */
function ContactRow({ contact, isPrimary }) {
  return (
    <li>
      <Link
        href={`/contacts/${contact.id}`}
        className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{contact.name ?? contact.email ?? "Unnamed"}</span>
            {isPrimary && (
              <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                Primary
              </span>
            )}
          </p>
          {contact.name && contact.email && (
            <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
          )}
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {contact.role ?? contact.department ?? "—"}
        </span>
      </Link>
    </li>
  );
}

export function ContactsTab({ contacts, primaryContactId }) {
  if (!contacts?.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No contacts linked to this opportunity yet.
      </p>
    );
  }

  // Primary first, then the rest in the order the query returned them.
  const ordered = [...contacts].sort((a, b) => {
    if (a.id === primaryContactId) return -1;
    if (b.id === primaryContactId) return 1;
    return 0;
  });

  return (
    <ul className="rounded-xl border border-border bg-card p-2 flex flex-col">
      {ordered.map((contact) => (
        <ContactRow
          key={contact.id}
          contact={contact}
          isPrimary={contact.id === primaryContactId}
        />
      ))}
    </ul>
  );
}
