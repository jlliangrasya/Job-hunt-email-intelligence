import { getGroqClient } from "./client";

const SYSTEM_PROMPT = `You are an email classifier that determines if a sent email represents a job application.
Analyze the email metadata and respond with a JSON array — one object per email — no explanation.

Each object must match:
{
  "isJobApplication": boolean,
  "confidence": number (0.0 to 1.0),
  "companyName": string | null,
  "roleTitle": string | null,
  "applicationDate": string | null
}

Rules:
- isJobApplication is true ONLY when the sender is applying for a job position
- Extract company from recipient domain or email body
- Extract role title from subject line or body
- Confidence < 0.7 means uncertain
- Newsletter unsubscribes, receipts, or general inquiries = false
- Job application acknowledgment receipts = false`;

/** Classify up to 5 emails in a single Groq call to stay within rate limits. */
export async function classifyApplicationBatch(emails) {
  const groq = getGroqClient();

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
      { role: "system", content: SYSTEM_PROMPT },
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
      isJobApplication: false,
      confidence: 0,
      companyName: null,
      roleTitle: null,
      applicationDate: null,
    }));
  }
}
