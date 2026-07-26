import { getValidGmailClient } from "./token-manager";
import { withRetry } from "@/lib/utils/retry";

/**
 * Fetch Gmail history since a given historyId.
 * Returns all message additions (new messages added to any label).
 */
export async function fetchHistorySince(userId, startHistoryId) {
  const { gmail } = await getValidGmailClient(userId);

  const res = await withRetry(() =>
    gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
    })
  );

  const history = res.data.history ?? [];
  return history.flatMap((h) => h.messagesAdded ?? []);
}
