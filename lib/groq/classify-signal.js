import { createChatCompletion, GROQ_MODELS } from "./client";
import { getDomainConfig } from "@/lib/opportunity/domain-config";

/**
 * Classify up to 5 emails in a single Groq call to stay within rate limits.
 *
 * `direction` selects which side of the application is being judged: "sent" asks
 * whether the user applied, "inbound" whether a board/ATS/employer confirmed an
 * application. The counterparty header flips with it — the identity of a sent
 * email is who it went To, of a received one who it came From.
 *
 * Inbound is the harder judgement and gets the better model. A sent application
 * announces itself — the user wrote it, to the employer, saying so. An inbound
 * confirmation has to be told apart from the marketing a job board wraps it in,
 * often on the subject line alone: "Indeed Application: Full Stack Developer" is
 * a real submission whose snippet reads "We'll help you get started", while
 * "Complete your application: Backend Engineer" is a nudge for one that never
 * happened. Measured on real mail, the small model skipped the former and
 * borrowed roles across emails in the same batch; the difference is affordable
 * because the sender/subject prefilter keeps inbound volume low.
 */
export async function classifySignalBatch(emails, type = "job", direction = "sent") {
  const { classifySignalPrompt, classifyInboundPrompt } = getDomainConfig(type);
  const inbound = direction === "inbound";
  const systemPrompt = inbound ? classifyInboundPrompt : classifySignalPrompt;

  if (!systemPrompt) throw new Error(`No ${direction} classifier prompt for type "${type}"`);

  const userPrompt = emails
    .map(
      (e, i) =>
        `Email ${i + 1}:\nSubject: ${e.subject}\n${inbound ? "From" : "To"}: ${
          inbound ? e.from : e.to
        }\nDate: ${e.date}\nSnippet: ${e.snippet}`
    )
    .join("\n\n---\n\n");

  const response = await createChatCompletion({
    model: inbound ? GROQ_MODELS.quality : GROQ_MODELS.fast,
    temperature: 0.1,
    // Five results with long role titles run to a few hundred tokens; the
    // headroom is cheap next to a truncated batch, which costs all five.
    max_tokens: 1500,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          `${userPrompt}\n\nRespond with a JSON array of ${emails.length} objects, ` +
          `one per email in order. Judge each email only on its own subject, sender, ` +
          `and snippet — never carry an organization or role across from another email.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";

  // Anything unusable degrades to one negative verdict per email, never to a
  // short array. Callers index results positionally, so a truncated response —
  // which has no closing bracket to match on — would otherwise return `[]` and
  // silently drop every email in the batch instead of just failing to classify
  // them, which is the same shape of bug as a discarded write error.
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    if (Array.isArray(parsed) && parsed.length === emails.length) return parsed;
    console.error(
      `Classifier returned ${
        Array.isArray(parsed) ? `${parsed.length} results` : "no JSON array"
      } for ${emails.length} emails`
    );
  } catch (e) {
    console.error("Classifier response was not valid JSON:", e.message);
  }

  return emails.map(() => ({
    isOpportunity: false,
    confidence: 0,
    organizationName: null,
    contextTitle: null,
    initiatedAt: null,
  }));
}
