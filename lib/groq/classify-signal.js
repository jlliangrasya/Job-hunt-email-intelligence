import { createChatCompletion, GROQ_MODELS } from "./client";
import { getDomainConfig } from "@/lib/opportunity/domain-config";

/**
 * Classify up to 5 emails in a single Groq call to stay within rate limits.
 *
 * `direction` selects which side of the application is being judged: "sent" asks
 * whether the user applied, "inbound" whether a board/ATS/employer confirmed an
 * application. The counterparty header flips with it — the identity of a sent
 * email is who it went To, of a received one who it came From.
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
    model: GROQ_MODELS.fast,
    temperature: 0.1,
    max_tokens: 800,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `${userPrompt}\n\nRespond with a JSON array of ${emails.length} objects.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "[]";

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return emails.map(() => ({
      isOpportunity: false,
      confidence: 0,
      organizationName: null,
      contextTitle: null,
      initiatedAt: null,
    }));
  }
}
