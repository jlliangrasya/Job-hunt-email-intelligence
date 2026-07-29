/**
 * Normalize an arbitrary date-ish value to a `YYYY-MM-DD` string, or null if it
 * isn't parseable. Used for `date` columns fed by LLM output or raw mail
 * headers, which are not guaranteed to be valid dates.
 */
export function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

/** Returns true if the given date is older than `days` days ago. */
export function isOlderThan(date, days) {
  const d = typeof date === "string" ? new Date(date) : date;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d < cutoff;
}

/** Format a date as a human-readable relative string, e.g. "3 days ago". */
export function relativeTime(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
