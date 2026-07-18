/**
 * Single source of truth for per-opportunity-type vocabulary: status values,
 * outreach scenarios, and notification mapping. Adding a new opportunity type
 * (sales, partnership, investment, recruiting, ...) means adding an entry here —
 * no schema migration, no changes to routes, pipeline, or UI components.
 */

export const OPPORTUNITY_TYPES = {
  job: {
    label: "Job Application",

    initialStatus: "applied",
    statuses: {
      applied:       { label: "Applied",       className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
      replied:       { label: "Replied",       className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
      interview:     { label: "Interview",     className: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" },
      offer:         { label: "Offer",         className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
      rejected:      { label: "Rejected",      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
      ghosted:       { label: "Ghosted",       className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
      follow_up_due: { label: "Follow Up Due", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
      withdrawn:     { label: "Withdrawn",     className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
    },

    scenarios: {
      follow_up:         { label: "Follow Up",           description: "friendly follow-up to check on application status" },
      interview_confirm: { label: "Confirm Interview",   description: "confirmation of interview scheduling details" },
      info_response:     { label: "Answer Info Request", description: "response providing requested information" },
      offer_accept:      { label: "Accept Offer",        description: "professional acceptance of job offer" },
      offer_decline:     { label: "Decline Offer",       description: "gracious decline of job offer" },
      general_reply:     { label: "General Reply",       description: "professional reply to their message" },
    },

    // Maps an intelligence-engine reply classification to a status transition + notification type.
    replySignalToStatus: {
      interview_invite: "interview",
      rejection: "rejected",
      info_request: "replied",
      offer: "offer",
      acknowledgment: "replied",
      other: "replied",
    },
    replySignalToNotification: {
      interview_invite: "interview_detected",
      rejection: "rejection_detected",
      offer: "offer_detected",
    },
    defaultNotification: "reply_received",

    staleStatus: "applied",
    staleTransitionStatus: "follow_up_due",

    detectionQuery:
      'in:sent (applied OR application OR resume OR "cover letter" OR "position of" OR "opportunity at" OR "job application" OR "open role")',

    classifySignalPrompt: `You are an email classifier that determines if a sent email represents a job application.
Analyze the email metadata and respond with a JSON array — one object per email — no explanation.

Each object must match:
{
  "isOpportunity": boolean,
  "confidence": number (0.0 to 1.0),
  "organizationName": string | null,
  "contextTitle": string | null,
  "initiatedAt": string | null
}

Rules:
- isOpportunity is true ONLY when the sender is applying for a job position
- Extract organization from recipient domain or email body
- Extract role/context title from subject line or body
- Confidence < 0.7 means uncertain
- Newsletter unsubscribes, receipts, or general inquiries = false
- Job application acknowledgment receipts = false`,

    classifyResponsePrompt: `You are an email classifier that determines the type of reply to a job application.
Respond with JSON only — no explanation.

Response format:
{
  "replyType": "interview_invite" | "rejection" | "info_request" | "offer" | "acknowledgment" | "other",
  "confidence": number (0.0 to 1.0),
  "keyDetail": string | null
}

Definitions:
- interview_invite: scheduling an interview, phone screen, or video call
- rejection: position filled, not moving forward, no longer considering
- info_request: asking for more information, references, portfolio, or availability
- offer: job offer, salary discussion, or start date proposal
- acknowledgment: confirming receipt of application, "we'll be in touch"
- other: anything else`,

    generateOutreachPrompt: `You are a professional career coach helping a job seeker write polished, concise email replies.
Write in first person from the job seeker's perspective.
Tone: professional, enthusiastic but not over-eager, concise (under 200 words).
Respond with JSON only — no explanation.

Response format:
{
  "subject": string,
  "body": string,
  "suggestedSendTime": string | null
}`,
  },
};

export function getDomainConfig(type) {
  const config = OPPORTUNITY_TYPES[type];
  if (!config) throw new Error(`Unknown opportunity type: "${type}"`);
  return config;
}

export function getStatusMeta(type, status) {
  const config = getDomainConfig(type);
  return config.statuses[status] ?? { label: status, className: "" };
}
