/**
 * Interim priority heuristic for the Mission Control dashboard.
 * Generic (not per-type) for now — Phase 3's Opportunity Engine v2 replaces
 * this with a stored, configurable score. Consumers only depend on the
 * `{ score, reason }` shape, so that swap won't touch dashboard components.
 */

const ACTION_WEIGHT = {
  offer: 100,
  follow_up_due: 90,
  interview: 80,
  replied: 40,
  applied: 20,
  ghosted: 0,
  rejected: 0,
  withdrawn: 0,
};

const REASON = {
  offer: "Offer — respond soon",
  follow_up_due: "Follow-up due",
  interview: "Interview scheduled",
  replied: "They replied — check thread",
  applied: "Awaiting response",
};

export function computePriority(opportunity) {
  const baseWeight = ACTION_WEIGHT[opportunity.status] ?? 0;

  if (baseWeight === 0) {
    return { score: 0, reason: null };
  }

  const daysSinceActivity = opportunity.last_activity_at
    ? (Date.now() - new Date(opportunity.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  const recencyBonus = Math.max(0, 10 - Math.min(daysSinceActivity, 10));

  return {
    score: baseWeight + recencyBonus,
    reason: REASON[opportunity.status] ?? null,
  };
}

export function rankByPriority(opportunities, limit = 5) {
  return opportunities
    .map((opportunity) => ({ opportunity, ...computePriority(opportunity) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
