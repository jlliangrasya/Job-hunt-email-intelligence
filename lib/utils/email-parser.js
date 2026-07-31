/** Extract a header value by name (case-insensitive) from a Gmail message. */
export function getHeader(message, name) {
  const headers = message.payload?.headers ?? [];
  return (
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ""
  );
}

/** Extract the bare address from a header value like `"Acme HR" <hr@acme.com>`. */
export function parseAddress(headerValue) {
  const value = (headerValue ?? "").trim();
  const angled = value.match(/<([^>]+)>/);
  const address = (angled ? angled[1] : value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(address) ? address : "";
}

const NO_REPLY_PATTERN = /(^|[._-])(no-?reply|do-?not-?reply|donotreply|notifications?|mailer|automated|bounce|postmaster)([._-]|$)/i;

/**
 * True for unmonitored senders. Job-board and ATS confirmations come from these,
 * so they must never be stored as an opportunity's reply target — outreach sent
 * there goes nowhere.
 */
export function isNoReplyAddress(headerValue) {
  const address = parseAddress(headerValue);
  if (!address) return true;
  return NO_REPLY_PATTERN.test(address.split("@")[0]);
}

/** Decode a base64url-encoded Gmail message body part. */
export function decodeBody(data) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

/** Extract plain-text body from a Gmail message payload (handles multipart). */
export function extractTextBody(payload) {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBody(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }

  return "";
}
