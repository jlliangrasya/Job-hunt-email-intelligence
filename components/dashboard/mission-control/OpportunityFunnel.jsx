"use client";
import { motion } from "framer-motion";
import { getDomainConfig } from "@/lib/opportunity/domain-config";
import { WidgetCard } from "./WidgetCard";

export function OpportunityFunnel({ opportunities, type = "job" }) {
  const { statuses } = getDomainConfig(type);
  const counts = opportunities.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  const max = Math.max(1, ...Object.values(counts));

  return (
    <WidgetCard title="Opportunity Funnel">
      <div className="flex flex-col gap-2.5">
        {Object.entries(statuses).map(([key, { label }]) => {
          const count = counts[key] ?? 0;
          const pct = (count / max) * 100;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs font-medium">{count}</span>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
