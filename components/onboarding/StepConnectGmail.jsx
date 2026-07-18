"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export function StepConnectGmail({ onNext }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Mail className="size-8 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Connect your Gmail</h2>
        <p className="text-muted-foreground mt-1 max-w-sm">
          We need read access to scan your sent mail for job applications and watch for replies.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button render={<Link href="/login" />} nativeButton={false}>Connect Gmail</Button>
        <Button variant="ghost" onClick={onNext}>
          Already connected — continue
        </Button>
      </div>
    </div>
  );
}
