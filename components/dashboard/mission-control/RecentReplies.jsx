"use client";
import Link from "next/link";
import { relativeTime } from "@/lib/utils/date";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { WidgetCard } from "./WidgetCard";

export function RecentReplies({ replies }) {
  return (
    <WidgetCard title="Recent Replies">
      {replies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replies yet.</p>
      ) : (
        <StaggerList as="div" className="flex flex-col gap-1">
          {replies.map((r) => (
            <StaggerItem key={r.id} as="div">
              <Link
                href={r.opportunity_id ? `/opportunities/${r.opportunity_id}` : "#"}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {r.opportunities?.organization_name ?? r.from_address ?? "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{r.subject ?? "—"}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(r.received_at)}</span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </WidgetCard>
  );
}
