"use client";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";

const STATUSES = [
  { value: "",              label: "All Statuses" },
  { value: "applied",       label: "Applied" },
  { value: "replied",       label: "Replied" },
  { value: "interview",     label: "Interview" },
  { value: "offer",         label: "Offer" },
  { value: "rejected",      label: "Rejected" },
  { value: "ghosted",       label: "Ghosted" },
  { value: "follow_up_due", label: "Follow Up Due" },
  { value: "withdrawn",     label: "Withdrawn" },
];

export function FilterBar({ statusFilter, searchQuery, onStatusChange, onSearchChange }) {
  const [internalSearch, setInternalSearch] = useState(searchQuery);

  useEffect(() => { setInternalSearch(searchQuery); }, [searchQuery]);

  function handleSearchChange(e) {
    setInternalSearch(e.target.value);
    onSearchChange(e.target.value);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search company or role..."
          value={internalSearch}
          onChange={handleSearchChange}
          className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {STATUSES.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}
