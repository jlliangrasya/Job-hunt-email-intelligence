import { resolveNextStep, computeDueAt } from "./scheduling";
import { generateOutreach } from "@/lib/groq/generate-outreach";
import { GROQ_MODELS } from "@/lib/groq/client";
import { fetchThread } from "@/lib/gmail/messages";

/**
 * Finds active campaign_enrollments whose next step is due, generates an
 * outreach_drafts row for review (never sends automatically — the user
 * reviews/edits/sends through the existing OutreachPanel flow), then
 * advances the enrollment to the next step or marks it completed.
 *
 * `supabase` may be RLS-scoped (user-triggered, implicitly limited to that
 * user's rows) or a service client (cron sweep across all users).
 */
export async function processDueCampaignSteps(supabase) {
  const { data: dueEnrollments } = await supabase
    .from("campaign_enrollments")
    .select("*, opportunities(*)")
    .eq("status", "active")
    .lte("next_step_due_at", new Date().toISOString());

  let processed = 0;

  for (const enrollment of dueEnrollments ?? []) {
    const opportunity = enrollment.opportunities;

    const { data: steps } = await supabase
      .from("campaign_steps")
      .select("*")
      .eq("campaign_id", enrollment.campaign_id)
      .order("step_order", { ascending: true });

    const step = resolveNextStep(steps ?? [], enrollment.current_step_index);

    if (!step || !opportunity) {
      await supabase
        .from("campaign_enrollments")
        .update({ status: "completed", next_step_due_at: null, updated_at: new Date().toISOString() })
        .eq("id", enrollment.id);
      continue;
    }

    let threadMessages = [];
    try {
      const raw = await fetchThread(enrollment.user_id, opportunity.channel_thread_id);
      threadMessages = raw.map((m) => ({ date: m.date, from: m.from, snippet: m.snippet }));
    } catch (e) {
      console.error("Thread fetch failed for campaign step draft:", e);
    }

    const result = await generateOutreach({
      type: opportunity.type,
      organizationName: opportunity.organization_name,
      contextTitle: opportunity.context_title,
      initiatedAt: opportunity.initiated_at,
      status: opportunity.status,
      scenario: step.scenario,
      threadMessages,
      userNotes: null,
    });

    await supabase.from("outreach_drafts").insert({
      user_id: enrollment.user_id,
      opportunity_id: opportunity.id,
      scenario: step.scenario,
      subject: result.subject,
      body_markdown: result.body,
      ai_model: GROQ_MODELS.quality,
    });

    await supabase.from("notifications").insert({
      user_id: enrollment.user_id,
      opportunity_id: opportunity.id,
      type: "campaign_step_ready",
      title: `Campaign step ready: ${step.label} for ${opportunity.organization_name}`,
      body: result.subject,
    });

    const nextStep = resolveNextStep(steps ?? [], enrollment.current_step_index + 1);
    const updates = {
      current_step_index: enrollment.current_step_index + 1,
      updated_at: new Date().toISOString(),
    };
    if (nextStep) {
      updates.next_step_due_at = computeDueAt(nextStep, new Date());
    } else {
      updates.status = "completed";
      updates.next_step_due_at = null;
    }

    await supabase.from("campaign_enrollments").update(updates).eq("id", enrollment.id);
    processed++;
  }

  return processed;
}
