import { getDomainConfig } from "./domain-config";
import { priorityFields } from "./priority";
import { dedupKey, findMatch, normalizeOrganization } from "./identity";
import { toDateOnly } from "@/lib/utils/date";

/**
 * The single write path for creating opportunities from detected emails.
 *
 * Both detection directions funnel through here — the sent-mail scan
 * (lib/gmail/scan.js) and inbound board/ATS confirmations (also the scan, plus
 * the realtime webhook in lib/pipeline/process-webhook.js) — because one
 * application routinely produces several unrelated Gmail threads and only a
 * shared write path can tell "second thread for a known application" from
 * "new application".
 *
 * Resolution order, cheapest first:
 *   1. thread already linked            → return it untouched
 *   2. exact normalized identity key    → link the thread in
 *   3. fuzzy organization + role match  → link the thread in
 *   4. otherwise                        → create
 */

const OPPORTUNITY_COLUMNS =
  "id, user_id, type, status, organization_id, organization_name, context_title, " +
  "channel_thread_id, channel_thread_ids, dedup_key, initiated_at, subject, " +
  "recipient_email, source_email, ai_confidence, follow_up_due_at, last_activity_at";

/** Most recent opportunities considered when fuzzy-matching a new detection. */
const CANDIDATE_LIMIT = 500;

/**
 * How far back a detection may reach to link into an existing opportunity.
 * Re-applying to the same role a year later is a genuinely new opportunity, and
 * the threads of one application always land within days of each other.
 */
const LINK_WINDOW_DAYS = 180;

/** Statuses a detection may merge into — i.e. everything not already closed out. */
function openStatuses(type) {
  const { priorityWeights = {} } = getDomainConfig(type);
  return Object.entries(priorityWeights)
    .filter(([, weight]) => weight > 0)
    .map(([status]) => status);
}

/** Gmail thread ids are hex; anything else would be unsafe in a PostgREST filter. */
function isSafeThreadId(threadId) {
  return typeof threadId === "string" && /^[A-Za-z0-9_-]+$/.test(threadId);
}

/**
 * Find the opportunity owning `threadId`, whether it is the originating thread
 * or one linked to it later.
 */
export async function findOpportunityByThread(supabase, userId, threadId, columns = OPPORTUNITY_COLUMNS) {
  if (!isSafeThreadId(threadId)) return null;

  const { data } = await supabase
    .from("opportunities")
    .select(columns)
    .eq("user_id", userId)
    .or(`channel_thread_id.eq.${threadId},channel_thread_ids.cs.{${threadId}}`)
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

async function findByIdentity(supabase, userId, type, { organizationName, contextTitle }) {
  if (!normalizeOrganization(organizationName)) return null;

  const since = new Date();
  since.setDate(since.getDate() - LINK_WINDOW_DAYS);
  const sinceDate = since.toISOString().split("T")[0];
  const statuses = openStatuses(type);

  const key = dedupKey({ organizationName, contextTitle });
  if (key) {
    const { data } = await supabase
      .from("opportunities")
      .select(OPPORTUNITY_COLUMNS)
      .eq("user_id", userId)
      .eq("type", type)
      .eq("dedup_key", key)
      .in("status", statuses)
      .gte("initiated_at", sinceDate)
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  // Fuzzy fallback: catches near-miss titles ("Sr." vs "Senior") and rows
  // predating the dedup_key column, which is backfilled lazily on write.
  const { data: candidates } = await supabase
    .from("opportunities")
    .select(OPPORTUNITY_COLUMNS)
    .eq("user_id", userId)
    .eq("type", type)
    .in("status", statuses)
    .gte("initiated_at", sinceDate)
    .order("initiated_at", { ascending: false })
    .limit(CANDIDATE_LIMIT);

  return findMatch(candidates ?? [], { organizationName, contextTitle });
}

async function resolveOrganizationId(supabase, userId, organizationName) {
  if (!normalizeOrganization(organizationName)) return null;

  const { data } = await supabase
    .from("organizations")
    .upsert(
      { user_id: userId, name: organizationName },
      { onConflict: "user_id,name", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  return data?.id ?? null;
}

/** Merge a newly detected thread into an opportunity we already track. */
async function linkThread(supabase, existing, detection) {
  const threadIds = new Set([
    ...(existing.channel_thread_ids ?? []),
    existing.channel_thread_id,
    detection.threadId,
  ].filter(Boolean));

  const patch = {
    channel_thread_ids: [...threadIds],
    updated_at: new Date().toISOString(),
  };

  // Fill gaps only. A board confirmation knows less than the application it
  // links to, so it must never overwrite richer data already on the row.
  if (!existing.context_title && detection.contextTitle) patch.context_title = detection.contextTitle;
  if (!existing.subject && detection.subject) patch.subject = detection.subject;
  if (!existing.source_email && detection.sourceEmail) patch.source_email = detection.sourceEmail;
  if (!existing.recipient_email && detection.recipientEmail) patch.recipient_email = detection.recipientEmail;
  if (!existing.dedup_key) {
    patch.dedup_key = dedupKey({
      organizationName: existing.organization_name ?? detection.organizationName,
      contextTitle: existing.context_title ?? detection.contextTitle,
    });
  }
  if (!existing.organization_id && detection.organizationName) {
    patch.organization_id = await resolveOrganizationId(
      supabase,
      existing.user_id,
      detection.organizationName
    );
  }

  // The earliest evidence is when the application actually happened: a board
  // confirmation can predate the follow-up email that first created the row.
  const detectedAt = toDateOnly(detection.initiatedAt);
  if (detectedAt && (!existing.initiated_at || detectedAt < existing.initiated_at)) {
    patch.initiated_at = detectedAt;
  }

  const confidence = Number(detection.confidence);
  if (Number.isFinite(confidence) && confidence > (existing.ai_confidence ?? 0)) {
    patch.ai_confidence = confidence;
  }

  const { data } = await supabase
    .from("opportunities")
    .update(patch)
    .eq("id", existing.id)
    .select(OPPORTUNITY_COLUMNS)
    .single();

  return data ?? { ...existing, ...patch };
}

/**
 * Link a detected email to an existing opportunity, or create one.
 *
 * `detectionSource` is "sent" for outgoing applications and "inbound" for
 * board/ATS confirmations. Returns `{ opportunity, created, linked }` so callers
 * can report accurate detection counts — a linked thread is not a new find.
 */
export async function linkOrCreateOpportunity(supabase, detection) {
  const {
    userId,
    type = "job",
    threadId,
    messageId,
    detectionSource = "sent",
    organizationName,
    contextTitle,
    initiatedAt,
    subject,
    recipientEmail = null,
    sourceEmail = null,
    confidence = null,
    snippet = "",
  } = detection;

  const normalized = { ...detection, type, detectionSource };

  const byThread = await findOpportunityByThread(supabase, userId, threadId);
  if (byThread) return { opportunity: byThread, created: false, linked: false };

  const byIdentity = await findByIdentity(supabase, userId, type, {
    organizationName,
    contextTitle,
  });
  if (byIdentity) {
    return {
      opportunity: await linkThread(supabase, byIdentity, normalized),
      created: false,
      linked: true,
    };
  }

  const { initialStatus } = getDomainConfig(type);
  const organizationId = await resolveOrganizationId(supabase, userId, organizationName);

  const { data } = await supabase
    .from("opportunities")
    .upsert(
      {
        user_id: userId,
        type,
        channel: "email",
        channel_thread_id: threadId,
        channel_thread_ids: [threadId],
        channel_message_id: messageId,
        detection_source: detectionSource,
        dedup_key: dedupKey({ organizationName, contextTitle }),
        organization_id: organizationId,
        organization_name: normalizeOrganization(organizationName) ? organizationName : "Unknown",
        context_title: contextTitle ?? null,
        initiated_at: toDateOnly(initiatedAt) ?? new Date().toISOString().split("T")[0],
        subject: subject ?? null,
        recipient_email: recipientEmail,
        source_email: sourceEmail,
        ai_confidence: confidence,
        raw_snippet: (snippet ?? "").slice(0, 500),
        status: initialStatus,
        ...priorityFields({ type, status: initialStatus }),
      },
      { onConflict: "user_id,channel_thread_id" }
    )
    .select(OPPORTUNITY_COLUMNS)
    .single();

  return { opportunity: data ?? null, created: Boolean(data), linked: false };
}
