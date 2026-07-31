"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, MessagesSquare } from "lucide-react";
import { relativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { SignalBadge } from "@/components/opportunity/SignalBadge";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";

const DIRECTIONS = [
  { value: "", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "received", label: "Received" },
];

export function InteractionsTimeline({ initialEvents }) {
  const [direction, setDirection] = useState("");

  const filtered = direction
    ? initialEvents.filter((e) => e.direction === direction)
    : initialEvents;

  if (initialEvents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16 text-muted-foreground">
        <MessagesSquare className="size-10 opacity-40" />
        <p className="text-sm">No interactions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {DIRECTIONS.map(({ value, label }) => (
          <button
            key={value || "all"}
            type="button"
            onClick={() => setDirection(value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm border border-border transition-colors",
              direction === value
                ? "bg-primary text-primary-foreground border-transparent"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <StaggerList as="ol" className="flex flex-col">
          {filtered.map((event, index) => {
            const sent = event.direction === "sent";
            const Icon = sent ? ArrowUpRight : ArrowDownLeft;
            const isLast = index === filtered.length - 1;
            const opportunity = event.opportunities;

            return (
              <StaggerItem as="li" key={event.id} className="flex gap-3">
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
                  {opportunity && (
                    <Link
                      href={`/opportunities/${opportunity.id}`}
                      className="mt-0.5 inline-block text-xs text-primary hover:underline"
                    >
                      {opportunity.organization_name} — {opportunity.context_title ?? "Untitled"}
                    </Link>
                  )}
                  {event.subject && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.subject}</p>
                  )}
                  {event.snippet && <p className="mt-1 text-sm">{event.snippet}</p>}
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>
      </div>
    </div>
  );
}
