import Groq from "groq-sdk";

let _client = null;

export function getGroqClient() {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}
