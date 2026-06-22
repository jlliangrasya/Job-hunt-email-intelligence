const STAT_DEFINITIONS = [
  { key: "applied",   label: "Applied",   color: "text-blue-600" },
  { key: "interview", label: "Interview", color: "text-violet-600" },
  { key: "offer",     label: "Offer",     color: "text-green-600" },
  { key: "rejected",  label: "Rejected",  color: "text-red-600" },
];

export function StatsCards({ applications }) {
  const counts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {STAT_DEFINITIONS.map(({ key, label, color }) => (
        <div key={key} className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className={`mt-2 text-3xl font-bold ${color}`}>{counts[key] ?? 0}</p>
        </div>
      ))}
    </div>
  );
}
