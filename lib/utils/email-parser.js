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

const HTML_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#39;": "'",
};

/**
 * Clean up a Gmail snippet for classification.
 *
 * Templated mail pads its preview text so the client shows nothing after the
 * teaser line: a real Indeed Apply confirmation arrives as `We&#39;ll help you
 * get started` followed by roughly a hundred zero-width non-joiners. Fed to the
 * model raw, the padding is most of the prompt and the apostrophes arrive as
 * `&#39;`, which is enough to make a plain confirmation look like noise.
 */
export function normalizeSnippet(snippet) {
  return (snippet ?? "")
    // Zero-width and non-breaking spacers used as preview padding.
    .replace(/[​-‍⁠﻿ ]/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, name) => {
      const key = name.toLowerCase();
      if (HTML_ENTITIES[key]) return HTML_ENTITIES[key];
      const code = key.startsWith("#x")
        ? parseInt(key.slice(2), 16)
        : key.startsWith("#")
          ? parseInt(key.slice(1), 10)
          : NaN;
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    })
    .replace(/\s+/g, " ")
    .trim();
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
