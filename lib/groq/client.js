import Groq from "groq-sdk";
import { withRetry } from "@/lib/utils/retry";

let _client = null;

export function getGroqClient() {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

/** Chat completion wrapped with retry/backoff for 429 rate limits and transient 5xx errors. */
export async function createChatCompletion(params) {
  return withRetry(() => getGroqClient().chat.completions.create(params));
}
