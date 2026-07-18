"use client";
import { relativeTime } from "@/lib/utils/date";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { WidgetCard } from "./WidgetCard";

export function ActivityFeed({ notifications }) {
  return (
    <WidgetCard title="Activity Feed">
      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity.</p>
      ) : (
        <StaggerList as="div" className="flex flex-col gap-1">
          {notifications.map((n) => (
            <StaggerItem key={n.id} as="div" className="rounded-lg px-2 py-2">
              <p className="text-sm font-medium">{n.title}</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(n.created_at)}</span>
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </WidgetCard>
  );
}
