"use client";
import { motion } from "framer-motion";
import { WidgetCard } from "@/components/dashboard/mission-control/WidgetCard";

export function DayOfWeekReplies({ dayOfWeekReplies }) {
  const { value, days, sampleSize, minSample } = dayOfWeekReplies;

  return (
    <WidgetCard title="Best Day for Replies">
      {value === null ? (
        <p className="text-sm text-muted-foreground">
          Not enough reply data yet ({sampleSize}/{minSample} needed).
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-semibold">{value.label}</span> gets the most replies ({value.count} of {sampleSize}).
          </p>
          <div className="flex items-end gap-2 h-16">
            {days.map((d) => {
              const max = Math.max(1, ...days.map((x) => x.count));
              const pct = (d.count / max) * 100;
              return (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex-1 flex items-end">
                    <motion.div
                      className="w-full rounded-t bg-primary"
                      initial={{ height: 0 }}
                      animate={{ height: `${pct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
