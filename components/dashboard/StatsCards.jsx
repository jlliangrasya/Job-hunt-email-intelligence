const STAT_DEFINITIONS = [
  { key: "applied",   label: "Applied",   accentColor: "#3b82f6" },
  { key: "interview", label: "Interview", accentColor: "#8b5cf6" },
  { key: "offer",     label: "Offer",     accentColor: "#22c55e" },
  { key: "rejected",  label: "Rejected",  accentColor: "#ef4444" },
];

export function StatsCards({ applications }) {
  const counts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {STAT_DEFINITIONS.map(({ key, label, accentColor }) => (
        <div
          key={key}
          className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1 border-l-4"
          style={{ borderLeftColor: accentColor }}
        >
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <span className="text-2xl font-bold text-foreground">{counts[key] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}
