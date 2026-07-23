/**
 * Priority scoring engine for the Mission Control dashboard and any
 * future consumer that needs to rank/sort opportunities server-side
 * (digests, agents, SQL views over the persisted priority_score column).
 *
 * Score = per-type status weight (lib/opportunity/domain-config.js)
 *       + recency bonus (recent activity outranks stale activity)
 *       + overdue bonus (a follow-up overdue by longer outranks one
 *         just past due).
 *
 * Consumers only depend on the `{ score, reason }` shape, so future
 * changes to the formula won't touch dashboard components.
 */

import { getDomainConfig, getStatusMeta } from "./domain-config";

const RECENCY_WINDOW_DAYS = 10;
const RECENCY_MAX_BONUS = 10;
const OVERDUE_BONUS_PER_DAY = 1;
const OVERDUE_MAX_BONUS = 20;

const REASON = {
  offer: "Offer — respond soon",
  follow_up_due: "Follow-up due",
  interview: "Interview scheduled",
  replied: "They replied — check thread",
  applied: "Awaiting response",
};

export function computePriority(opportunity) {
  const type = opportunity.type ?? "job";
  const { priorityWeights = {} } = getDomainConfig(type);
  const baseWeight = priorityWeights[opportunity.status] ?? 0;

  if (baseWeight === 0) {
    return { score: 0, reason: null };
  }

  const daysSinceActivity = opportunity.last_activity_at
    ? (Date.now() - new Date(opportunity.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
    : RECENCY_WINDOW_DAYS + 1;
  const recencyBonus = Math.max(0, RECENCY_MAX_BONUS - Math.min(daysSinceActivity, RECENCY_WINDOW_DAYS));

  const overdueDays = opportunity.follow_up_due_at
    ? (Date.now() - new Date(opportunity.follow_up_due_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const overdueBonus = overdueDays > 0 ? Math.min(overdueDays * OVERDUE_BONUS_PER_DAY, OVERDUE_MAX_BONUS) : 0;

  const baseReason = REASON[opportunity.status] ?? getStatusMeta(type, opportunity.status).label ?? null;
  const reason = overdueBonus > 0 ? `${baseReason} (${Math.floor(overdueDays)}d overdue)` : baseReason;

  return {
    score: Math.round((baseWeight + recencyBonus + overdueBonus) * 100) / 100,
    reason,
  };
}

export function rankByPriority(opportunities, limit = 5) {
  return opportunities
    .map((opportunity) => ({ opportunity, ...computePriority(opportunity) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Fields to spread into an insert/update payload so priority_score and
 * priority_reason stay in sync with the row being written, without an
 * extra round trip to read the row back first.
 */
export function priorityFields(opportunity) {
  const { score, reason } = computePriority(opportunity);
  return { priority_score: score, priority_reason: reason };
}
