import { relativeTime } from "@/lib/utils/date";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

function MetaRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export function ApplicationMeta({ application }) {
  const {
    company_name, role_title, status, application_date, last_activity_at,
    follow_up_due_at, recipient_email, subject, ai_confidence,
  } = application;

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{company_name ?? "Unknown Company"}</h2>
          <p className="text-muted-foreground">{role_title ?? "Unknown Role"}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetaRow label="Recipient" value={recipient_email} />
        <MetaRow label="Subject" value={subject} />
        <MetaRow label="Applied" value={application_date ? relativeTime(application_date) : null} />
        <MetaRow label="Last Activity" value={last_activity_at ? relativeTime(last_activity_at) : null} />
        {follow_up_due_at && (
          <MetaRow label="Follow-up Due" value={relativeTime(follow_up_due_at)} />
        )}
        {ai_confidence != null && (
          <MetaRow label="AI Confidence" value={`${Math.round(ai_confidence * 100)}%`} />
        )}
      </div>
    </div>
  );
}
