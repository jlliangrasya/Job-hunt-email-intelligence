export function WidgetCard({ title, action, children, className }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 flex flex-col gap-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
