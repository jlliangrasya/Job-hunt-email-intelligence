const MIN_SAMPLE = {
  replyRate: 3,
  responseTime: 3,
  dayOfWeek: 10,
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Pure, deterministic insight computations over the user's own stored data —
 * no AI call, no external data. Every insight with a meaningful sample-size
 * threshold returns `{ value: null, sampleSize, minSample }` below it instead
 * of a misleadingly confident stat off a handful of rows.
 */
export function computeInsights({ opportunities = [], interactionEvents = [], outreachDrafts = [] }) {
  return {
    replyRate: computeReplyRate(opportunities, interactionEvents),
    avgResponseTime: computeAvgResponseTime(opportunities, interactionEvents),
    priorityDistribution: computePriorityDistribution(opportunities),
    dayOfWeekReplies: computeDayOfWeekReplies(interactionEvents),
    opportunitiesOverTime: computeOpportunitiesOverTime(opportunities),
    draftUsage: computeDraftUsage(outreachDrafts),
  };
}

function computeReplyRate(opportunities, events) {
  const sampleSize = opportunities.length;
  if (sampleSize < MIN_SAMPLE.replyRate) {
    return { value: null, sampleSize, minSample: MIN_SAMPLE.replyRate };
  }
  const repliedIds = new Set(
    events.filter((e) => e.direction === "received" && e.opportunity_id).map((e) => e.opportunity_id)
  );
  const value = Math.round((repliedIds.size / sampleSize) * 100);
  return { value, sampleSize, minSample: MIN_SAMPLE.replyRate };
}

function computeAvgResponseTime(opportunities, events) {
  const byOpportunity = new Map();
  for (const e of events) {
    if (e.direction !== "received" || !e.opportunity_id || !e.received_at) continue;
    const existing = byOpportunity.get(e.opportunity_id);
    if (!existing || new Date(e.received_at) < new Date(existing)) {
      byOpportunity.set(e.opportunity_id, e.received_at);
    }
  }

  const days = [];
  for (const opp of opportunities) {
    const firstReply = byOpportunity.get(opp.id);
    if (!firstReply || !opp.initiated_at) continue;
    const diff = (new Date(firstReply).getTime() - new Date(opp.initiated_at).getTime()) / MS_PER_DAY;
    if (diff >= 0) days.push(diff);
  }

  if (days.length < MIN_SAMPLE.responseTime) {
    return { value: null, sampleSize: days.length, minSample: MIN_SAMPLE.responseTime };
  }
  const avg = days.reduce((sum, d) => sum + d, 0) / days.length;
  return { value: Math.round(avg * 10) / 10, sampleSize: days.length, minSample: MIN_SAMPLE.responseTime };
}

function computePriorityDistribution(opportunities) {
  const buckets = [
    { label: "0-25", min: 0, max: 25, count: 0 },
    { label: "26-50", min: 26, max: 50, count: 0 },
    { label: "51-75", min: 51, max: 75, count: 0 },
    { label: "76-100", min: 76, max: 100, count: 0 },
  ];
  for (const opp of opportunities) {
    const score = opp.priority_score ?? 0;
    const bucket = buckets.find((b) => score >= b.min && score <= b.max) ?? buckets[buckets.length - 1];
    bucket.count += 1;
  }
  return buckets;
}

function computeDayOfWeekReplies(events) {
  const received = events.filter((e) => e.direction === "received" && e.received_at);
  if (received.length < MIN_SAMPLE.dayOfWeek) {
    return { value: null, sampleSize: received.length, minSample: MIN_SAMPLE.dayOfWeek };
  }
  const counts = new Array(7).fill(0);
  for (const e of received) {
    counts[new Date(e.received_at).getDay()] += 1;
  }
  const days = DAY_LABELS.map((label, i) => ({ label, count: counts[i] }));
  const best = days.reduce((max, d) => (d.count > max.count ? d : max), days[0]);
  return { value: best, days, sampleSize: received.length, minSample: MIN_SAMPLE.dayOfWeek };
}

function computeOpportunitiesOverTime(opportunities) {
  const weeks = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const count = opportunities.filter((o) => {
      if (!o.initiated_at) return false;
      const d = new Date(o.initiated_at);
      return d >= weekStart && d < weekEnd;
    }).length;
    weeks.push({ label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }), count });
  }
  return weeks;
}

function computeDraftUsage(outreachDrafts) {
  const total = outreachDrafts.length;
  const sent = outreachDrafts.filter((d) => d.was_sent).length;
  return { total, sent, sampleSize: total };
}
