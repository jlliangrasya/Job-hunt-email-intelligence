import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { relativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { SignalBadge } from "./SignalBadge";

/**
 * Chronological history from the stored `interaction_events` rows.
 *
 * Distinct from the Thread tab: that one fetches live from Gmail and shows the
 * conversation as it exists in the mailbox, while this shows what the pipeline
 * actually recorded and classified — including events whose Gmail message may
 * since have been deleted.
 */
export function TimelineTab({ events }) {
  if (!events?.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No recorded activity yet.
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const sent = event.direction === "sent";
        const Icon = sent ? ArrowUpRight : ArrowDownLeft;
        const isLast = index === events.length - 1;

        return (
          <li key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border",
                  sent
                    ? "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-3.5" />
              </span>
              {!isLast && <span className="w-px flex-1 bg-border" />}
            </div>

            <div className={cn("flex-1 min-w-0", isLast ? "pb-0" : "pb-5")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {sent ? "You sent" : "Received from"}{" "}
                  {sent ? (event.to_addresses?.[0] ?? "recipient") : (event.from_address ?? "unknown")}
                </span>
                <SignalBadge signalType={event.signal_type} />
                <span className="ml-auto text-xs text-muted-foreground shrink-0">
                  {event.received_at ? relativeTime(event.received_at) : ""}
                </span>
              </div>
              {event.subject && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.subject}</p>
              )}
              {event.snippet && <p className="mt-1 text-sm">{event.snippet}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
