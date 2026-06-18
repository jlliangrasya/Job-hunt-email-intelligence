import { getGroqClient } from "./client";

const SYSTEM_PROMPT = `You are an email classifier that determines the type of reply to a job application.
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
- other: anything else`;

export async function classifyReply({
  companyName,
  roleTitle,
  originalSubject,
  replyFrom,
  replySubject,
  replySnippet,
}) {
  const groq = getGroqClient();

  const response = await groq.chat.completions.create({
    model: "llama3-8b-8192",
    temperature: 0.1,
    max_tokens: 200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Original application:
Company: ${companyName}
Role: ${roleTitle ?? "Unknown"}
Subject: ${originalSubject}

Reply email:
From: ${replyFrom}
Subject: ${replySubject}
Snippet: ${replySnippet}

Classify this reply.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { replyType: "other", confidence: 0, keyDetail: null };
  } catch {
    return { replyType: "other", confidence: 0, keyDetail: null };
  }
}
