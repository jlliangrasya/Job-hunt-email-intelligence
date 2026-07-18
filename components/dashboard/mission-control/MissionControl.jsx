"use client";
import { FadeIn } from "@/components/motion/FadeIn";
import { BriefingCard } from "./BriefingCard";
import { QuickActions } from "./QuickActions";
import { OpportunityFunnel } from "./OpportunityFunnel";
import { PriorityOpportunities } from "./PriorityOpportunities";
import { UpcomingFollowUps } from "./UpcomingFollowUps";
import { RecentReplies } from "./RecentReplies";
import { ActivityFeed } from "./ActivityFeed";

export function MissionControl({ opportunities, replies, notifications }) {
  return (
    <FadeIn className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BriefingCard />
        <QuickActions />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OpportunityFunnel opportunities={opportunities} />
        <PriorityOpportunities opportunities={opportunities} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <UpcomingFollowUps opportunities={opportunities} />
        <RecentReplies replies={replies} />
        <ActivityFeed notifications={notifications} />
      </div>
    </FadeIn>
  );
}
