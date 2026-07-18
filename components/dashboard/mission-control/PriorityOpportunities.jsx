"use client";
import Link from "next/link";
import { rankByPriority } from "@/lib/opportunity/priority";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { WidgetCard } from "./WidgetCard";

export function PriorityOpportunities({ opportunities }) {
  const ranked = rankByPriority(opportunities, 5);

  return (
    <WidgetCard title="Priority Opportunities">
      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing urgent right now.</p>
      ) : (
        <StaggerList as="div" className="flex flex-col gap-1">
          {ranked.map(({ opportunity, reason }) => (
            <StaggerItem key={opportunity.id} as="div">
              <Link
                href={`/opportunities/${opportunity.id}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{opportunity.organization_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{opportunity.context_title ?? "—"}</p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                  {reason}
                </span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </WidgetCard>
  );
}
