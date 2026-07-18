import { getGroqClient } from "./client";
import { getDomainConfig } from "@/lib/opportunity/domain-config";

/** Classify up to 5 emails in a single Groq call to stay within rate limits. */
export async function classifySignalBatch(emails, type = "job") {
  const groq = getGroqClient();
  const { classifySignalPrompt } = getDomainConfig(type);

  const userPrompt = emails
    .map(
      (e, i) =>
        `Email ${i + 1}:\nSubject: ${e.subject}\nTo: ${e.to}\nDate: ${e.date}\nSnippet: ${e.snippet}`
    )
    .join("\n\n---\n\n");

  const response = await groq.chat.completions.create({
    model: "llama3-8b-8192",
    temperature: 0.1,
    max_tokens: 800,
    messages: [
      { role: "system", content: classifySignalPrompt },
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
