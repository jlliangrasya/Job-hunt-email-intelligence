import { getValidGmailClient } from "./token-manager";
import { createServiceClient } from "@/lib/supabase/server";
import { withRetry } from "@/lib/utils/retry";

/**
 * Register or renew a Gmail Push Notification watch for the given user.
 * Stores the returned historyId and expiration in gmail_watches.
 */
export async function setupGmailWatch(userId) {
  const { gmail } = await getValidGmailClient(userId);
  const supabase = await createServiceClient();

  const topicName = process.env.GMAIL_PUBSUB_TOPIC;

  // Without a topic Gmail rejects the watch with a bare "topicName required",
  // every user ends up with no row in gmail_watches, and realtime detection is
  // silently off — the webhook never fires because Google was never asked to
  // call it. Naming the missing variable is the difference between a five-minute
  // fix and an invisible outage.
  if (!topicName) {
    throw new Error(
      "GMAIL_PUBSUB_TOPIC is not set — Gmail push notifications cannot be registered, " +
        "so no inbound mail will be detected in realtime."
    );
  }

  const res = await withRetry(() =>
    gmail.users.watch({
      userId: "me",
      requestBody: { topicName, labelIds: ["INBOX"] },
    })
  );

  const { historyId, expiration } = res.data;

  await supabase.from("gmail_watches").upsert(
    {
      user_id: userId,
      history_id: historyId,
      expiration: new Date(Number(expiration)).toISOString(),
      topic_name: topicName,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return { historyId, expiration };
}
