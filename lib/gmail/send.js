import { getValidGmailClient } from "./token-manager";
import { composeMimeMessage } from "@/lib/utils/mime";

/** Send an email on behalf of the user via the Gmail API. */
export async function sendEmail({ userId, from, to, subject, body, inReplyTo, references }) {
  const { gmail } = await getValidGmailClient(userId);

  const raw = composeMimeMessage({ from, to, subject, body, inReplyTo, references });

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return res.data.id ?? "";
}
