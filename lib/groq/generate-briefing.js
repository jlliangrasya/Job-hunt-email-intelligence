import { getGroqClient } from "./client";

const SYSTEM_PROMPT = `You are an assistant that writes a short daily briefing for someone tracking job opportunities.
You will be given real facts about their current pipeline. Use ONLY those facts.
Never invent organizations, people, events, or outside market/hiring news that were not given to you.
Respond with JSON only — no explanation.

Response format:
{
  "summary": string (1-2 sentences, plain and direct),
  "recommendations": string[] (2-4 short, specific, actionable items grounded only in the given facts)
}`;

export async function generateBriefing({
  statusCounts,
  priorityOpportunities,
  overdueFollowUpsCount,
  recentRepliesCount,
}) {
  const groq = getGroqClient();

  const priorityLines = priorityOpportunities
    .map((p) => `- ${p.organization_name} (${p.context_title ?? "unknown role"}): ${p.reason}`)
    .join("\n");

  const response = await groq.chat.completions.create({
    model: "llama3-8b-8192",
    temperature: 0.4,
    max_tokens: 350,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Status counts: ${JSON.stringify(statusCounts)}
Overdue follow-ups: ${overdueFollowUpsCount}
Replies received in the last 48h: ${recentRepliesCount}

Top priority opportunities:
${priorityLines || "(none)"}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { summary: content, recommendations: [] };
  } catch {
    return { summary: "Unable to generate a briefing right now.", recommendations: [] };
  }
}
