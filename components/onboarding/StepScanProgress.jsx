"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function StepScanProgress({ onNext }) {
  const [progress, setProgress] = useState({ scanned: 0, total: 0, detected: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function runScan() {
      try {
        const res = await fetch("/api/gmail/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "initial" }),
          signal: controller.signal,
        });
        if (!res.ok) { setError("Scan failed. Please try again."); return; }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (!controller.signal.aborted) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") { reader.cancel(); setDone(true); return; }
            try { setProgress(JSON.parse(payload)); } catch (e) { console.error("SSE parse error:", e); }
          }
        }
        setDone(true);
      } catch (e) {
        if (!controller.signal.aborted) setError("Scan failed. Please try again.");
      }
    }

    runScan();
    return () => { controller.abort(); };
  }, []);

  const pct = progress.total > 0 ? Math.round((progress.scanned / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <h2 className="text-xl font-bold">Scanning your Gmail</h2>
        <p className="text-muted-foreground mt-1">
          Looking through your sent mail for job applications...
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="w-full max-w-sm flex flex-col gap-3">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {done
              ? `Scan complete — found ${progress.detected} application${progress.detected !== 1 ? "s" : ""}`
              : progress.total > 0
              ? `Scanned ${progress.scanned} of ${progress.total} emails`
              : "Starting scan..."}
          </p>
        </div>
      )}

      {done ? (
        <Button onClick={() => onNext(progress.detected)}>Continue</Button>
      ) : !error && (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
