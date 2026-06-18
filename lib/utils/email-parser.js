/** Extract a header value by name (case-insensitive) from a Gmail message. */
export function getHeader(message, name) {
  const headers = message.payload?.headers ?? [];
  return (
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ""
  );
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
