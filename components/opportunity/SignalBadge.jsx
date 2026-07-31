import { cn } from "@/lib/utils";

/**
 * Renders an interaction's AI reply classification (`interaction_events.signal_type`).
 * Shared by ThreadViewer (live Gmail messages) and TimelineTab (stored events) so
 * the same signal reads identically wherever it surfaces.
 */
const SIGNAL_META = {
  interview_invite: { label: "Interview Invite", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  rejection:        { label: "Rejection",        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  info_request:     { label: "Info Request",     className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  offer:            { label: "Offer",            className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  acknowledgment:   { label: "Acknowledgment",   className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  application_confirmation: { label: "Application Confirmed", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
  other:            { label: "Other",            className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

export function SignalBadge({ signalType }) {
  if (!signalType) return null;
  const { label, className } = SIGNAL_META[signalType] ?? {
    label: signalType,
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={cn("text-xs rounded-full px-2 py-0.5 font-medium", className)}>
      {label}
    </span>
  );
}
