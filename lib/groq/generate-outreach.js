import { getGroqClient } from "./client";
import { getDomainConfig } from "@/lib/opportunity/domain-config";

export async function generateOutreach({
  type = "job",
  organizationName,
  contextTitle,
  initiatedAt,
  status,
  scenario,
  threadMessages,
  userNotes,
}) {
  const groq = getGroqClient();
  const { generateOutreachPrompt, scenarios } = getDomainConfig(type);

  const threadContext = threadMessages
    .slice(0, 3)
    .map((m) => `[${m.date}] ${m.from}: ${m.snippet}`)
    .join("\n\n");

  const response = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    temperature: 0.7,
    max_tokens: 500,
    messages: [
      { role: "system", content: generateOutreachPrompt },
      {
        role: "user",
        content: `Opportunity context:
Organization: ${organizationName}
Context: ${contextTitle ?? "Unknown"}
Initiated: ${initiatedAt}
Current status: ${status}

Email thread (most recent first):
${threadContext}

Task: Write a ${scenarios[scenario]?.description ?? scenario} email.
${userNotes ? `\nAdditional context: ${userNotes}` : ""}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { subject: "", body: content, suggestedSendTime: null };
  } catch {
    return { subject: `Re: ${organizationName}`, body: content, suggestedSendTime: null };
  }
}
