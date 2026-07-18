"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { relativeTime } from "@/lib/utils/date";
import { StatusBadge } from "./StatusBadge";
import { FilterBar } from "./FilterBar";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { Inbox } from "lucide-react";

export function OpportunitiesTable({ initialOpportunities, userId }) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const supabase = useSupabase();

  useEffect(() => {
    const channel = supabase
      .channel("opportunities-table")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "opportunities", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setOpportunities((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setOpportunities((prev) =>
              prev.map((o) => (o.id === payload.new.id ? payload.new : o))
            );
          } else if (payload.eventType === "DELETE") {
            setOpportunities((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [supabase, userId]);

  const filtered = opportunities.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesOrg = o.organization_name?.toLowerCase().includes(q);
      const matchesContext = o.context_title?.toLowerCase().includes(q);
      if (!matchesOrg && !matchesContext) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
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
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Inbox className="size-10 opacity-40" />
            <p className="text-sm">No applications found.</p>
          </div>
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
              <StaggerList as="tbody">
                {filtered.map((opp) => (
                  <StaggerItem
                    as="tr"
                    key={opp.id}
                    onClick={() => router.push(`/opportunities/${opp.id}`)}
                    whileTap={{ scale: 0.995 }}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{opp.organization_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{opp.context_title ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={opp.status} type={opp.type} /></td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {opp.initiated_at ? relativeTime(opp.initiated_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {opp.last_activity_at ? relativeTime(opp.last_activity_at) : "—"}
                    </td>
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
