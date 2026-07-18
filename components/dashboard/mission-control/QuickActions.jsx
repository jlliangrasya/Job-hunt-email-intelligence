"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Building2, Users, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "./WidgetCard";

export function QuickActions() {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const router = useRouter();

  async function handleRescan() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/gmail/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "job" }),
      });
      if (!res.ok) throw new Error("Scan failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let detected = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (typeof parsed.detected === "number") detected = parsed.detected;
          } catch {}
        }
      }

      setScanResult(`Found ${detected} new opportunit${detected === 1 ? "y" : "ies"}`);
      router.refresh();
    } catch {
      setScanResult("Scan failed — try again");
    } finally {
      setScanning(false);
    }
  }

  return (
    <WidgetCard title="Quick Actions">
      <div className="flex flex-col gap-2">
        <Button size="sm" variant="outline" onClick={handleRescan} disabled={scanning} className="justify-start gap-2">
          {scanning ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {scanning ? "Scanning Gmail..." : "Rescan Gmail"}
        </Button>
        {scanResult && <p className="text-xs text-muted-foreground pl-1">{scanResult}</p>}
        <Button size="sm" variant="outline" render={<Link href="/organizations" />} nativeButton={false} className="justify-start gap-2">
          <Building2 className="size-3.5" /> Add Organization
        </Button>
        <Button size="sm" variant="outline" render={<Link href="/contacts" />} nativeButton={false} className="justify-start gap-2">
          <Users className="size-3.5" /> Add Contact
        </Button>
        <Button size="sm" variant="outline" render={<Link href="/settings" />} nativeButton={false} className="justify-start gap-2">
          <Settings className="size-3.5" /> Settings
        </Button>
      </div>
    </WidgetCard>
  );
}
