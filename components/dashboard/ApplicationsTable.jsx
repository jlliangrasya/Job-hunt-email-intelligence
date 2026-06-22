"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { relativeTime } from "@/lib/utils/date";
import { StatusBadge } from "./StatusBadge";
import { FilterBar } from "./FilterBar";
import { StatsCards } from "./StatsCards";

export function ApplicationsTable({ initialApplications, userId }) {
  const [applications, setApplications] = useState(initialApplications);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const supabase = useSupabase();

  useEffect(() => {
    const channel = supabase
      .channel("apps-table")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setApplications((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setApplications((prev) =>
              prev.map((a) => (a.id === payload.new.id ? payload.new : a))
            );
          } else if (payload.eventType === "DELETE") {
            setApplications((prev) => prev.filter((a) => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [supabase, userId]);

  const filtered = applications.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesCompany = a.company_name?.toLowerCase().includes(q);
      const matchesRole = a.role_title?.toLowerCase().includes(q);
      if (!matchesCompany && !matchesRole) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <StatsCards applications={applications} />
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <FilterBar
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            onStatusChange={setStatusFilter}
            onSearchChange={setSearchQuery}
          />
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No applications found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Applied</th>
                  <th className="px-4 py-3 font-medium">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => router.push(`/applications/${app.id}`)}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{app.company_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{app.role_title ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {app.application_date ? relativeTime(app.application_date) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {app.last_activity_at ? relativeTime(app.last_activity_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
