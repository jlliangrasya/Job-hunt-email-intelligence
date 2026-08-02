/**
 * Single source of truth for per-opportunity-type vocabulary: status values,
 * outreach scenarios, and notification mapping. Adding a new opportunity type
 * (sales, partnership, investment, recruiting, ...) means adding an entry here —
 * no schema migration, no changes to routes, pipeline, or UI components.
 */

/**
 * Applicant tracking systems, where the sender domain alone is enough to be
 * worth classifying: an ATS only ever mails you about an application you
 * actually submitted, so its traffic is close to pure signal.
 *
 * Job board *domains* deliberately do not appear here. Measured against real
 * mailboxes, `from:linkedin.com` matched 500+ messages over 90 days of which
 * almost none were confirmations — the rest were job alerts, "N people viewed
 * your profile", and connection requests. Matching a board by domain buries the
 * handful of real confirmations under hundreds of LLM calls' worth of noise.
 */
const APPLICATION_ATS_DOMAINS = [
  "greenhouse.io", "greenhouse-mail.io", "lever.co", "myworkday.com", "myworkdayjobs.com",
  "workday.com", "ashbyhq.com", "smartrecruiters.com", "jobvite.com", "icims.com",
  "taleo.net", "successfactors.com", "bamboohr.com", "breezy.hr", "workable.com",
  "recruitee.com", "teamtailor.com", "personio.de", "rippling.com", "gem.com",
  "hire.google.com", "applytojob.com", "manatal.com", "zohorecruit.com", "jazz.co",
];

/**
 * Individual board addresses that carry application mail rather than the board's
 * marketing feed. Boards split their traffic by sending address, so the address
 * is the usable unit where the domain is not: LinkedIn confirmations come from
 * `jobs-noreply@`, while `jobalerts-noreply@` and `messages-noreply@` are alerts
 * and social noise.
 *
 * Recommendation feeds that share an address with a board's application mail
 * (SEEK and Jobsdb both send "+ 11 new jobs" from the same address as their
 * confirmations) are intentionally absent — their confirmations still get caught
 * by the subject phrases below, at no noise cost.
 */
const APPLICATION_SENDER_ADDRESSES = [
  "jobs-noreply@linkedin.com",
  "indeedapply@indeed.com",
  "noreply@e.jobstreet.com",
];

/**
 * Subject phrases employers and boards use when acknowledging an application.
 * Gmail matches `subject:"..."` on adjacent words, so near-misses need their own
 * entry — "application submitted" does not match "application was successfully
 * submitted".
 */
const APPLICATION_SUBJECT_PHRASES = [
  "application received", "received your application", "we got your application",
  "application was sent", "your application was sent to", "application submitted",
  "successfully submitted", "application has been submitted", "successfully applied",
  "thanks for applying", "thank you for applying", "thank you for your application",
  "thanks for your interest in", "thank you for your interest in",
  "your application to", "your application for", "application confirmation",
  "received your resume", "indeed application",
];

/**
 * Alert and marketing subjects that otherwise slip through on a matched sender.
 * A board's transactional address still carries some promotion ("apply now to
 * ...", "Acme is hiring"), and excluding those here is far cheaper than paying
 * for the model to reject each one.
 */
const APPLICATION_EXCLUDE_SUBJECT_PHRASES = [
  "new jobs", "jobs for you", "job alert", "jobs similar", "similar to",
  "is hiring", "are hiring", "apply now", "viewed your profile", "people viewed",
  "recommended for you", "job recommendations", "new post for you", "connection request",
];

/**
 * Gmail search for inbound confirmations, derived from the same lists the
 * runtime prefilter uses so the scan and the webhook can never drift apart.
 */
function buildInboundQuery({ domains, addresses, phrases, excludePhrases }) {
  const senders = `from:(${[...domains, ...addresses].join(" OR ")})`;
  const quote = (phrase) => `"${phrase}"`;
  const subjects = `subject:(${phrases.map(quote).join(" OR ")})`;
  const excluded = excludePhrases.length
    ? ` -subject:(${excludePhrases.map(quote).join(" OR ")})`
    : "";
  return `-in:sent -in:chats (${senders} OR ${subjects})${excluded}`;
}

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

    // Base score each status contributes to lib/opportunity/priority.js's
    // priority engine. Statuses absent here (or mapped to 0) are treated
    // as closed and excluded from ranked/priority views.
    priorityWeights: {
      offer: 100,
      follow_up_due: 90,
      interview: 80,
      replied: 40,
      applied: 20,
      ghosted: 0,
      rejected: 0,
      withdrawn: 0,
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
    // Raised when an inbound confirmation reveals an application the user never
    // emailed about (Easy Apply / ATS), so the detection is visible rather than
    // silently appearing in the list.
    detectionNotification: "opportunity_detected",
    // Signal recorded on the interaction_events row for such a confirmation.
    inboundSignal: "application_confirmation",

    staleStatus: "applied",
    staleTransitionStatus: "follow_up_due",

    // Intentionally broad — Gmail search is literal keyword matching, not semantic, so a
    // narrow pre-filter here would silently exclude real applications phrased differently
    // than the keyword list. classifySignalBatch's AI confidence threshold is the real filter.
    detectionQuery: "in:sent",

    // Detection has to be two-sided: an "Easy Apply" on LinkedIn/Indeed, or any
    // application submitted through an ATS, never produces a sent email — the
    // only trace is the confirmation that lands in the inbox.
    inboundSenderDomains: APPLICATION_ATS_DOMAINS,
    inboundSenderAddresses: APPLICATION_SENDER_ADDRESSES,
    inboundSubjectPhrases: APPLICATION_SUBJECT_PHRASES,
    inboundExcludeSubjectPhrases: APPLICATION_EXCLUDE_SUBJECT_PHRASES,
    inboundDetectionQuery: buildInboundQuery({
      domains: APPLICATION_ATS_DOMAINS,
      addresses: APPLICATION_SENDER_ADDRESSES,
      phrases: APPLICATION_SUBJECT_PHRASES,
      excludePhrases: APPLICATION_EXCLUDE_SUBJECT_PHRASES,
    }),

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

    // Mirror of classifySignalPrompt for the inbound direction. The hard part is
    // that the sender is almost never the employer: "Your application was sent to
    // Acme" arrives from LinkedIn, and ATS confirmations arrive from the vendor's
    // domain, so the organization has to come from the body rather than the From
    // address. Confirmations only — an interview invite or rejection on a thread
    // we already track is handled by classifyResponsePrompt; one for an
    // application we never saw is a known gap, not a case for this prompt.
    classifyInboundPrompt: `You are an email classifier that determines if an email received by the user confirms that THEY submitted a job application.
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
- isOpportunity is true when the email is evidence the user ALREADY submitted an application. All of these are true:
  "Your application was sent to Acme", "Your application to Software Engineer at Acme",
  "Thank you for applying to Acme", "Thanks for your interest in Acme",
  "Application Received", "Indeed Application: Full Stack Developer",
  "We've received your resume for the X role", "Your application was viewed by Acme"
- isOpportunity is false when the email merely invites the user to apply, or nudges them to finish an application they have not submitted. All of these are false:
  "Acme is hiring for a Frontend role", "Apply now to 'Engineer at Acme'",
  "New jobs similar to X", "Software Engineer @ Acme", "N new jobs for you",
  "Complete your application: X", "Don't forget to complete your application",
  saved-job reminders, and expiring-job reminders
- A job title next to a company name, on its own, is an advertisement and not proof of an application. Look for language about an application already being sent, submitted, received, or viewed
- organizationName must be the EMPLOYER being applied to, never the job board or applicant tracking system. "Your application was sent to Acme" received from LinkedIn means organizationName is "Acme"; an ATS confirmation from no-reply@hire.lever.co for Binance means "Binance"
- If the employer cannot be determined, set organizationName to null and keep isOpportunity true — a confirmation with an unknown employer is still an application. Never guess, and never fall back to the board or ATS name
- Extract the role from the subject or body into contextTitle; null if absent. contextTitle is the role alone ("Full Stack Engineer"), never the whole subject line and never "Role at Company"
- Newsletters, career advice, and profile-view notifications = false
- Interview invitations, rejections, and offers = false — those are replies, not confirmations
- Confirmations for someone else's application (e.g. the user is the recruiter) = false`,

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

/**
 * Cheap "is this worth classifying?" test for a received message, applying the
 * same sender/subject criteria as `inboundDetectionQuery`.
 *
 * The scan gets this filtering free from Gmail search, but the webhook sees
 * every message that lands in the inbox. Without this gate each newsletter and
 * receipt would cost an LLM call, so the prefilter is what makes realtime
 * inbound detection affordable.
 */
export function matchesInboundSignal(type, { from = "", subject = "" } = {}) {
  const {
    inboundSenderDomains = [],
    inboundSenderAddresses = [],
    inboundSubjectPhrases = [],
    inboundExcludeSubjectPhrases = [],
  } = getDomainConfig(type);

  const normalizedSubject = subject.toLowerCase();

  // An alert subject disqualifies outright, matching the trailing `-subject:`
  // clause of inboundDetectionQuery. Without this the boards' transactional
  // addresses would readmit exactly the noise the query drops.
  if (inboundExcludeSubjectPhrases.some((phrase) => normalizedSubject.includes(phrase))) {
    return false;
  }

  const address = from.toLowerCase().match(/<([^>]+)>/)?.[1] ?? from.toLowerCase();
  const trimmed = address.trim().replace(/[>,;\s].*$/, "");
  if (trimmed && inboundSenderAddresses.includes(trimmed)) return true;

  const domain = trimmed.split("@")[1] ?? "";
  if (domain && inboundSenderDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return true;
  }

  return inboundSubjectPhrases.some((phrase) => normalizedSubject.includes(phrase));
}

export function getStatusMeta(type, status) {
  const config = getDomainConfig(type);
  return config.statuses[status] ?? { label: status, className: "" };
}
