"use client";
import { motion } from "framer-motion";
import { WidgetCard } from "@/components/dashboard/mission-control/WidgetCard";

export function PriorityDistribution({ buckets }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <WidgetCard title="Priority Score Distribution">
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No opportunities yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {buckets.map((bucket) => {
            const pct = (bucket.count / max) * 100;
            return (
              <div key={bucket.label} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">{bucket.label}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs font-medium">{bucket.count}</span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
