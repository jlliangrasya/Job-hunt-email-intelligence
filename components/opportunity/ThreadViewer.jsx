import { relativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { SignalBadge } from "./SignalBadge";

export function ThreadViewer({ messages }) {
  if (!messages?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No messages in thread.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "rounded-xl border border-border bg-card p-4",
            msg.direction === "sent" && "border-l-4 border-l-blue-400"
          )}
        >
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="text-sm font-medium">{msg.from_address}</span>
            <div className="flex items-center gap-2">
              <SignalBadge signalType={msg.signal_type} />
              <span className="text-xs text-muted-foreground">
                {msg.received_at ? relativeTime(msg.received_at) : ""}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-1">{msg.subject}</p>
          <p className="text-sm">{msg.snippet}</p>
        </div>
      ))}
    </div>
  );
}
