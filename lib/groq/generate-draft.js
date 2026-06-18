import { getGroqClient } from "./client";

const DRAFT_TYPE_DESCRIPTIONS = {
  follow_up: "friendly follow-up to check on application status",
  interview_confirm: "confirmation of interview scheduling details",
  info_response: "response providing requested information",
  offer_accept: "professional acceptance of job offer",
  offer_decline: "gracious decline of job offer",
  general_reply: "professional reply to their message",
};

const SYSTEM_PROMPT = `You are a professional career coach helping a job seeker write polished, concise email replies.
Write in first person from the job seeker's perspective.
Tone: professional, enthusiastic but not over-eager, concise (under 200 words).
Respond with JSON only — no explanation.

Response format:
{
  "subject": string,
  "body": string,
  "suggestedSendTime": string | null
}`;

export async function generateDraft({
  companyName,
  roleTitle,
  applicationDate,
  status,
  draftType,
  threadMessages,
  userNotes,
}) {
  const groq = getGroqClient();

  const threadContext = threadMessages
    .slice(0, 3)
    .map((m) => `[${m.date}] ${m.from}: ${m.snippet}`)
    .join("\n\n");

  const response = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    temperature: 0.7,
    max_tokens: 500,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Job application context:
Company: ${companyName}
Role: ${roleTitle ?? "Unknown"}
Application sent: ${applicationDate}
Current status: ${status}

Email thread (most recent first):
${threadContext}

Task: Write a ${DRAFT_TYPE_DESCRIPTIONS[draftType]} email.
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
    return { subject: `Re: ${companyName}`, body: content, suggestedSendTime: null };
  }
}
