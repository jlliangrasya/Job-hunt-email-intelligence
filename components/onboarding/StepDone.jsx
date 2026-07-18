import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export function StepDone({ detected }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <CheckCircle2 className="size-16 text-green-600" />
      <div>
        <h2 className="text-xl font-bold">You're all set!</h2>
        <p className="text-muted-foreground mt-1">
          Found <strong>{detected}</strong> application{detected !== 1 ? "s" : ""} in your Gmail.
        </p>
      </div>
      <Button render={<Link href="/dashboard" />} nativeButton={false}>Go to Dashboard</Button>
    </div>
  );
}
