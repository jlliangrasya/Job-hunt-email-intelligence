import { getValidGmailClient } from "./token-manager";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Register or renew a Gmail Push Notification watch for the given user.
 * Stores the returned historyId and expiration in gmail_watches.
 */
export async function setupGmailWatch(userId) {
  const { gmail } = await getValidGmailClient(userId);
  const supabase = await createServiceClient();

  const topicName = process.env.GMAIL_PUBSUB_TOPIC;

  const res = await gmail.users.watch({
    userId: "me",
    requestBody: { topicName, labelIds: ["INBOX"] },
  });

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
