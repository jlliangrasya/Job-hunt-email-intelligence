import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="size-16 rounded-full bg-muted flex items-center justify-center">
          <SearchX className="size-8 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Page not found</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            The page you're looking for doesn't exist or may have moved.
          </p>
        </div>
        <Button render={<Link href="/dashboard" />} nativeButton={false}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
