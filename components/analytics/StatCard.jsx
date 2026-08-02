import { WidgetCard } from "@/components/dashboard/mission-control/WidgetCard";

/** Single-number stat with a graceful "not enough data" fallback below `minSample`. */
export function StatCard({ title, value, unit, sampleSize, minSample }) {
  const hasData = value !== null && value !== undefined;
  return (
    <WidgetCard title={title}>
      {hasData ? (
        <p className="text-3xl font-bold">
          {value}
          {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Not enough data yet ({sampleSize}/{minSample} needed).
        </p>
      )}
    </WidgetCard>
  );
}
