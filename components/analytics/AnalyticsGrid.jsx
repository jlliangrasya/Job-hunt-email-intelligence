"use client";
import { FadeIn } from "@/components/motion/FadeIn";
import { StatCard } from "./StatCard";
import { PriorityDistribution } from "./PriorityDistribution";
import { DayOfWeekReplies } from "./DayOfWeekReplies";
import { OpportunitiesTrend } from "./OpportunitiesTrend";

export function AnalyticsGrid({ insights }) {
  const { replyRate, avgResponseTime, priorityDistribution, dayOfWeekReplies, opportunitiesOverTime, draftUsage } = insights;

  return (
    <FadeIn className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Reply Rate"
          value={replyRate.value}
          unit="%"
          sampleSize={replyRate.sampleSize}
          minSample={replyRate.minSample}
        />
        <StatCard
          title="Avg. Days to First Reply"
          value={avgResponseTime.value}
          unit="days"
          sampleSize={avgResponseTime.sampleSize}
          minSample={avgResponseTime.minSample}
        />
        <StatCard
          title="AI Drafts Sent"
          value={draftUsage.sampleSize > 0 ? draftUsage.sent : null}
          unit={draftUsage.sampleSize > 0 ? `of ${draftUsage.total}` : undefined}
          sampleSize={draftUsage.sampleSize}
          minSample={1}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PriorityDistribution buckets={priorityDistribution} />
        <DayOfWeekReplies dayOfWeekReplies={dayOfWeekReplies} />
      </div>
      <OpportunitiesTrend weeks={opportunitiesOverTime} />
    </FadeIn>
  );
}
