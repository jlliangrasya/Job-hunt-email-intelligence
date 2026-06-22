import { relativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

const REPLY_TYPE_LABELS = {
  interview_invite: "Interview Invite",
  rejection:        "Rejection",
  info_request:     "Info Request",
  offer:            "Offer",
  acknowledgment:   "Acknowledgment",
  other:            "Other",
};

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
              {msg.groq_reply_type && (
                <span className="text-xs rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 font-medium dark:bg-violet-900/30 dark:text-violet-300">
                  {REPLY_TYPE_LABELS[msg.groq_reply_type] ?? msg.groq_reply_type}
                </span>
              )}
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
