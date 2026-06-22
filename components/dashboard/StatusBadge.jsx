import { cn } from "@/lib/utils";

export const STATUS_MAP = {
  applied:       { label: "Applied",       className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  replied:       { label: "Replied",       className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  interview:     { label: "Interview",     className: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" },
  offer:         { label: "Offer",         className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  rejected:      { label: "Rejected",      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  ghosted:       { label: "Ghosted",       className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  follow_up_due: { label: "Follow Up Due", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  withdrawn:     { label: "Withdrawn",     className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
};

export function StatusBadge({ status }) {
  const { label, className } = STATUS_MAP[status] ?? { label: status, className: "" };
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
