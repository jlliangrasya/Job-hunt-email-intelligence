"use client";
import Link from "next/link";
import { relativeTime } from "@/lib/utils/date";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { WidgetCard } from "./WidgetCard";

export function UpcomingFollowUps({ opportunities }) {
  const dueSoon = opportunities
    .filter((o) => o.follow_up_due_at)
    .sort((a, b) => new Date(a.follow_up_due_at) - new Date(b.follow_up_due_at))
    .slice(0, 5);

  return (
    <WidgetCard title="Upcoming Follow-ups">
      {dueSoon.length === 0 ? (
        <p className="text-sm text-muted-foreground">No follow-ups due.</p>
      ) : (
        <StaggerList as="div" className="flex flex-col gap-1">
          {dueSoon.map((o) => (
            <StaggerItem key={o.id} as="div">
              <Link
                href={`/opportunities/${o.id}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted transition-colors"
              >
                <span className="text-sm font-medium truncate">{o.organization_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(o.follow_up_due_at)}</span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </WidgetCard>
  );
}
