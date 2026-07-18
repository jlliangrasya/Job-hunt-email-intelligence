import { cn } from "@/lib/utils";
import { getStatusMeta } from "@/lib/opportunity/domain-config";

export function StatusBadge({ status, type = "job" }) {
  const { label, className } = getStatusMeta(type, status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {label}
    </span>
  );
}
