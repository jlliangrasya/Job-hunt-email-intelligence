"use client";
import { motion } from "framer-motion";
import { WidgetCard } from "@/components/dashboard/mission-control/WidgetCard";

export function OpportunitiesTrend({ weeks }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const total = weeks.reduce((sum, w) => sum + w.count, 0);

  return (
    <WidgetCard title="Opportunities Over Time (last 8 weeks)">
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No opportunities yet.</p>
      ) : (
        <div className="flex items-end gap-2 h-20">
          {weeks.map((w) => {
            const pct = (w.count / max) * 100;
            return (
              <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex-1 flex items-end">
                  <motion.div
                    className="w-full rounded-t bg-primary"
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{w.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
