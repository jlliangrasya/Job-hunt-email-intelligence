"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, CircleCheck } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

export function BriefingCard() {
  const [briefing, setBriefing] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/briefing")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load briefing");
        return r.json();
      })
      .then(setBriefing)
      .catch(() => setError(true));
  }, []);

  return (
    <WidgetCard
      title="Today's Briefing"
      action={<Sparkles className="size-4 text-primary" />}
      className="lg:col-span-2"
    >
      {error ? (
        <p className="text-sm text-muted-foreground">Couldn't generate a briefing right now.</p>
      ) : !briefing ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-3 rounded bg-muted"
              style={{ width: `${90 - i * 15}%` }}
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{briefing.summary}</p>
          {briefing.recommendations?.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {briefing.recommendations.map((rec, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <CircleCheck className="size-3.5 mt-0.5 shrink-0 text-primary" />
                  {rec}
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
