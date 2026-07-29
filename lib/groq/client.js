import Groq from "groq-sdk";
import { withRetry } from "@/lib/utils/retry";

/**
 * Model IDs live here so a Groq deprecation is a one-line fix.
 * `fast` is for high-volume classification, `quality` for user-facing generation.
 * Verify against https://console.groq.com/docs/deprecations before changing.
 */
export const GROQ_MODELS = {
  fast: "llama-3.1-8b-instant",
  quality: "llama-3.3-70b-versatile",
};

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
