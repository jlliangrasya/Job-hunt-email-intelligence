import { getGroqClient } from "./client";
import { getDomainConfig } from "@/lib/opportunity/domain-config";

export async function classifyResponse({
  type = "job",
  organizationName,
  contextTitle,
  originalSubject,
  replyFrom,
  replySubject,
  replySnippet,
}) {
  const groq = getGroqClient();
  const { classifyResponsePrompt } = getDomainConfig(type);

  const response = await groq.chat.completions.create({
    model: "llama3-8b-8192",
    temperature: 0.1,
    max_tokens: 200,
    messages: [
      { role: "system", content: classifyResponsePrompt },
      {
        role: "user",
        content: `Original opportunity:
Organization: ${organizationName}
Context: ${contextTitle ?? "Unknown"}
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
