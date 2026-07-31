import Link from "next/link";
import { Radio } from "lucide-react";
import { relativeTime } from "@/lib/utils/date";
import { SignalBadge } from "@/components/opportunity/SignalBadge";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";

export function SignalsFeed({ signals }) {
  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16 text-muted-foreground">
        <Radio className="size-10 opacity-40" />
        <p className="text-sm">No signals detected yet.</p>
      </div>
    );
  }

  return (
    <StaggerList as="div" className="flex flex-col gap-3">
      {signals.map((signal) => {
        const opportunity = signal.opportunities;
        return (
          <StaggerItem
            as="div"
            key={signal.id}
            className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <SignalBadge signalType={signal.signal_type} />
              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                {signal.received_at ? relativeTime(signal.received_at) : ""}
              </span>
            </div>
            {opportunity && (
              <Link
                href={`/opportunities/${opportunity.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {opportunity.organization_name} — {opportunity.context_title ?? "Untitled"}
              </Link>
            )}
            {signal.subject && <p className="text-xs text-muted-foreground truncate">{signal.subject}</p>}
            {signal.snippet && <p className="text-sm">{signal.snippet}</p>}
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
}
