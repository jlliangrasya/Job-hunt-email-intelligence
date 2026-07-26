const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"]);

function getStatus(error) {
  return error?.status ?? error?.response?.status ?? error?.code;
}

function isRetryable(error) {
  const status = getStatus(error);
  if (typeof status === "number" && RETRYABLE_STATUS.has(status)) return true;
  return RETRYABLE_CODES.has(error?.code);
}

function getRetryAfterMs(error) {
  const header =
    error?.response?.headers?.get?.("retry-after") ?? error?.response?.headers?.["retry-after"];
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

/**
 * Retries `fn` with exponential backoff + jitter on transient failures
 * (429 rate limits, 5xx server errors, connection resets/timeouts).
 * Non-retryable errors (4xx auth/validation, bad input) throw immediately.
 */
export async function withRetry(fn, { retries = 3, baseDelayMs = 500, maxDelayMs = 8000 } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) throw error;

      const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const delay = getRetryAfterMs(error) ?? backoff + Math.random() * 250;

      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}
