import { computePriority, maxPriorityScore } from "@/lib/opportunity/priority";

/**
 * Surfaces the Phase 3 scoring engine on the opportunity detail page.
 *
 * The score is recomputed at render rather than read from the persisted
 * `priority_score` column: the formula decays with time since last activity, so
 * the stored value (written at the last status change) can be stale. The column
 * exists so SQL/digests can sort without JS — this view wants the live number.
 */
export function PriorityCard({ opportunity }) {
  const { score, reason } = computePriority(opportunity);
  const max = maxPriorityScore();
  const pct = Math.min(100, Math.round((score / max) * 100));

  if (score === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Priority</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Closed — excluded from priority ranking.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Priority</p>
        <p className="text-2xl font-bold tabular-nums">{score}</p>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
        role="meter"
        aria-label="Priority score"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
    </div>
  );
}
