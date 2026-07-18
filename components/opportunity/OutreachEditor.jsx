"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, SendHorizonal, CheckCircle2 } from "lucide-react";

export function OutreachEditor({ draft, onUpdate, onSend, sending }) {
  const [body, setBody] = useState(draft.body_edited ?? draft.body_markdown ?? "");

  function handleChange(e) {
    setBody(e.target.value);
    onUpdate(e.target.value);
  }

  if (draft.was_sent) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-green-600" />
        <span>Sent</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <p className="text-sm font-medium">{draft.subject}</p>
      <textarea
        value={body}
        onChange={handleChange}
        rows={8}
        className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <Button onClick={onSend} disabled={sending} className="self-end">
        {sending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <>
            <SendHorizonal className="size-3.5" />
            Send Email
          </>
        )}
      </Button>
    </div>
  );
}
