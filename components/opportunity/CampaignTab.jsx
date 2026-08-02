"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils/date";

const STATUS_LABEL = { active: "Active", paused: "Paused", completed: "Completed", cancelled: "Cancelled" };

export function CampaignTab({ opportunityId, enrollment: initialEnrollment, availableCampaigns, stepCount }) {
  const [enrollment, setEnrollment] = useState(initialEnrollment);
  const [selectedCampaignId, setSelectedCampaignId] = useState(availableCampaigns[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function handleEnroll() {
    if (!selectedCampaignId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/campaign-enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId, campaignId: selectedCampaignId }),
    });
    setBusy(false);
    if (!res.ok) {
      const { error: message } = await res.json().catch(() => ({}));
      setError(message ?? "Failed to enroll.");
      return;
    }
    const { enrollment: created } = await res.json();
    setEnrollment(created);
    router.refresh();
  }

  async function handleStatusChange(status) {
    if (!enrollment) return;
    setBusy(true);
    const res = await fetch(`/api/campaign-enrollments/${enrollment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.ok) {
      const { enrollment: updated } = await res.json();
      setEnrollment(updated);
      router.refresh();
    }
  }

  if (!enrollment || enrollment.status === "completed" || enrollment.status === "cancelled") {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        {enrollment && (
          <p className="text-sm text-muted-foreground">
            Previous campaign <span className="font-medium">{STATUS_LABEL[enrollment.status]}</span>.
          </p>
        )}
        {availableCampaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No campaigns yet. <Link href="/campaigns" className="text-primary hover:underline">Create one</Link> first.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {availableCampaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button size="sm" onClick={handleEnroll} disabled={busy}>
              {busy ? "Enrolling..." : "Enroll"}
            </Button>
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            <Link href={`/campaigns/${enrollment.campaign_id}`} className="hover:underline">
              {enrollment.campaigns?.name ?? "Campaign"}
            </Link>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Step {enrollment.current_step_index} of {stepCount} · {STATUS_LABEL[enrollment.status]}
          </p>
        </div>
        <div className="flex gap-2">
          {enrollment.status === "active" ? (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange("paused")} disabled={busy}>
              Pause
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange("active")} disabled={busy}>
              Resume
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => handleStatusChange("cancelled")} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
      {enrollment.next_step_due_at && (
        <p className="text-xs text-muted-foreground">
          Next step due {relativeTime(enrollment.next_step_due_at)}
        </p>
      )}
    </div>
  );
}
