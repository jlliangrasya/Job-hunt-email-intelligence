import { getValidGmailClient } from "./token-manager";
import { getHeader, extractTextBody } from "@/lib/utils/email-parser";

export async function fetchMessage(userId, messageId) {
  const { gmail } = await getValidGmailClient(userId);

  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  return parseMessage(res.data);
}

export function parseMessage(msg) {
  return {
    id: msg.id ?? "",
    threadId: msg.threadId ?? "",
    subject: getHeader(msg, "Subject"),
    from: getHeader(msg, "From"),
    to: getHeader(msg, "To"),
    date: getHeader(msg, "Date"),
    snippet: msg.snippet ?? "",
    body: extractTextBody(msg.payload),
    labelIds: msg.labelIds ?? [],
  };
}

/** Fetch all messages in a Gmail thread. */
export async function fetchThread(userId, threadId) {
  const { gmail } = await getValidGmailClient(userId);

  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  return (res.data.messages ?? []).map(parseMessage);
}
