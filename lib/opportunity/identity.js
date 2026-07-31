/**
 * Cross-thread identity for opportunities.
 *
 * One real-world application can arrive as several unrelated email threads —
 * a LinkedIn/Indeed "Easy Apply" confirmation, an email you sent directly, and
 * the recruiter's eventual reply all have different participants and different
 * Gmail thread ids. Thread id alone therefore cannot answer "is this the same
 * application?"; organization + role is the only signal common to all three.
 *
 * Two layers, because neither is sufficient alone:
 *   - `dedupKey()` — a normalized exact key, cheap to index and query.
 *   - `findMatch()` — token-overlap similarity, for the near-misses an exact
 *     key always misses ("Sr. Software Engineer" vs "Senior Software Engineer",
 *     "Acme, Inc." vs "Acme").
 */

/** Dropped from organization names — legal-entity noise only. Descriptive words
 *  (Labs, Software, Studio) are deliberately kept: "Acme Labs" and "Acme Studio"
 *  are usually different employers. */
const ORG_LEGAL_SUFFIXES = new Set([
  "inc", "incorporated", "llc", "llp", "lp", "ltd", "limited", "corp",
  "corporation", "co", "company", "gmbh", "ag", "plc", "sa", "sas", "srl",
  "nv", "bv", "ab", "oy", "as", "pte", "pvt", "pty",
]);

/** Canonical form for seniority markers that vary purely by abbreviation. */
const SENIORITY_ALIASES = {
  sr: "senior", snr: "senior", jr: "junior", jnr: "junior",
  mgr: "manager", eng: "engineer", engr: "engineer", dev: "developer",
  swe: "engineer", ops: "operations", admin: "administrator",
};

/** Words that carry no identity: posting boilerplate, work arrangement, req ids. */
const TITLE_STOPWORDS = new Set([
  "a", "an", "the", "of", "for", "at", "in", "on", "to", "and", "or", "with",
  "position", "positions", "role", "roles", "job", "jobs", "opening", "openings",
  "opportunity", "opportunities", "vacancy", "posting", "req", "requisition",
  "application", "apply", "hiring", "career", "careers",
  "remote", "hybrid", "onsite", "office", "full", "part", "time", "fulltime",
  "parttime", "contract", "permanent", "temporary", "intern", "internship",
  "level", "team", "our", "your", "we", "us",
]);

/** Lowercase, strip accents, and reduce everything non-alphanumeric to spaces. */
function normalizeText(value) {
  return (value ?? "")
    .toString()
    .normalize("NFKD")
    // NFKD splits accented letters into base + combining mark; \p{M} drops the mark.
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Placeholder organization names the classifier emits when it cannot tell. */
const UNKNOWN_ORGS = new Set(["", "unknown", "n a", "na", "none", "null", "undefined"]);

/**
 * Canonical organization name: lowercased, punctuation-free, legal suffixes
 * dropped. Returns "" for placeholders, which callers treat as "no identity"
 * rather than as an organization literally named "Unknown".
 */
export function normalizeOrganization(name) {
  const base = normalizeText(name);
  if (UNKNOWN_ORGS.has(base)) return "";

  const tokens = base.split(" ").filter(Boolean);
  while (tokens.length > 1 && ORG_LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/**
 * Canonical role tokens: stopwords removed, abbreviations expanded, sorted so
 * word order stops mattering ("Engineer, Software" === "Software Engineer").
 */
export function normalizeTitleTokens(title) {
  const tokens = normalizeText(title)
    .split(" ")
    .filter(Boolean)
    .map((token) => SENIORITY_ALIASES[token] ?? token)
    .filter((token) => !TITLE_STOPWORDS.has(token))
    // Bare numbers are req-id fragments ("Engineer II" survives as "ii").
    .filter((token) => !/^\d+$/.test(token));

  return [...new Set(tokens)].sort();
}

/**
 * Stable identity string for an opportunity, or null when the organization is
 * unknown — an unknown org would collapse every unidentifiable application into
 * one bucket, which is worse than not deduplicating at all.
 */
export function dedupKey({ organizationName, contextTitle } = {}) {
  const org = normalizeOrganization(organizationName);
  if (!org) return null;
  return `${org.replace(/ /g, "-")}|${normalizeTitleTokens(contextTitle).join("-")}`;
}

/** Sørensen–Dice over token sets: 2·|A∩B| / (|A|+|B|). */
export function titleSimilarity(aTokens, bTokens) {
  if (aTokens.length === 0 && bTokens.length === 0) return 1;
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const b = new Set(bTokens);
  const overlap = aTokens.filter((token) => b.has(token)).length;
  return (2 * overlap) / (aTokens.length + bTokens.length);
}

/** Token overlap above which two titles are considered the same role. */
export const TITLE_MATCH_THRESHOLD = 0.6;

/**
 * Pick the candidate opportunity that represents the same application as
 * `target`, or null.
 *
 * Candidates must already be scoped to one user and type. Organization has to
 * match exactly once normalized — a fuzzy org match risks merging "Acme" with
 * "Acme Health", which are different employers and different applications.
 *
 * A missing role (common in board confirmations: "Your application was sent to
 * Acme") matches only when the organization has exactly one candidate. With two
 * open Acme applications there is no way to tell which one the confirmation
 * belongs to, and guessing wrong silently corrupts both.
 */
export function findMatch(candidates, target) {
  const org = normalizeOrganization(target?.organizationName);
  if (!org) return null;

  const sameOrg = (candidates ?? []).filter(
    (candidate) => normalizeOrganization(candidate.organization_name) === org
  );
  if (sameOrg.length === 0) return null;

  const targetTokens = normalizeTitleTokens(target?.contextTitle);
  if (targetTokens.length === 0) {
    return sameOrg.length === 1 ? sameOrg[0] : null;
  }

  let best = null;
  let bestScore = 0;

  for (const candidate of sameOrg) {
    const candidateTokens = normalizeTitleTokens(candidate.context_title);
    // Same reasoning in reverse: an untitled existing row absorbs a titled
    // match only when it is the org's only candidate.
    const score =
      candidateTokens.length === 0
        ? sameOrg.length === 1
          ? TITLE_MATCH_THRESHOLD
          : 0
        : titleSimilarity(targetTokens, candidateTokens);

    if (score >= TITLE_MATCH_THRESHOLD && score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}
