# DEV 2 — AI Pipeline & Data Layer: Implementation Plan

> **Date:** 2026-07-04 · **Owner:** Dev 2 · **Companion docs:** [PLAN.md](../../../PLAN.md) (master plan), [2026-06-22-dev3-frontend.md](2026-06-22-dev3-frontend.md) (Dev 3 plan, defines the API contracts this plan must satisfy)

---

## 1. Where this project is going

**Product:** A Gmail-connected job-hunt tracker PWA. The user signs in with Google, the app scans their sent mail to auto-detect job applications, watches the inbox via Gmail Push (Pub/Sub), classifies incoming replies with AI (interview / rejection / offer / etc.), updates a live dashboard in real time, drafts contextual reply emails with AI, and reminds the user to follow up on stale applications.

**Expected final output:** A deployed Vercel app where the end-to-end loop works:

```
Google sign-in → onboarding scan finds applications → dashboard shows them
→ recruiter replies → webhook fires → AI classifies → status + notification update live
→ user clicks app → generates AI draft → edits → sends via Gmail → thread stays intact
→ 7 days of silence → cron flags "follow_up_due" → notification
```

---

## 2. Current state audit (as of commit `b6298d7`)

### What exists ✅

| Area | State |
|---|---|
| **DB schema** | `supabase/migrations/0001_initial_schema.sql` — complete: all 7 tables, ENUMs, RLS, indexes, `updated_at` triggers, Realtime publication on `applications` + `notifications` |
| **`lib/` layer (scaffold)** | All of `lib/gmail/` (client, token-manager, watch, history, messages, scan, send), `lib/groq/` (client + 3 prompt modules), `lib/pipeline/process-webhook.js`, `lib/supabase/`, `lib/utils/` — real implementations, not stubs |
| **Frontend (Dev 3)** | **Done.** All pages (`dashboard`, `applications/[id]`, `onboarding`, `settings`), all components, app shell, realtime table, notification bell, 14 test suites. See git history `569bdbb..b6298d7` |
| **Auth guard** | `proxy.js` (Next 16 renamed `middleware` → `proxy`) with Supabase session check + webhook bypass — exists |
| **Config** | `vercel.json` (3 crons), `next.config.js`, `public/manifest.json` (PWA manifest, service worker deferred — Turbopack) |

### What does NOT exist ❌

**There is no `app/api/` directory at all.** The frontend calls 8+ endpoints that return 404 today — that's why the `NEXT_PUBLIC_DEV_PREVIEW` bypass was added. There is also no `app/(auth)/` login page or OAuth callback, so nobody can sign in.

| Missing | Owner |
|---|---|
| `app/(auth)/login/page.jsx` + `app/auth/callback/route.js` (OAuth + token storage) | **Dev 1** |
| `app/api/auth/google`, `app/api/auth/revoke` | **Dev 1** |
| `app/api/gmail/watch`, `app/api/gmail/scan` (SSE), `app/api/gmail/send` | **Dev 1** |
| `app/api/webhooks/gmail` (Pub/Sub receiver) | **Dev 1** |
| `app/api/cron/*` (all 3 routes) | **Dev 1** |
| GCP Pub/Sub topic/subscription setup, Vercel env vars | **Dev 1** |
| `app/api/applications/` — list, `[id]`, `[id]/thread` | **Dev 2 (you)** |
| `app/api/drafts/` — `route.js` + `[id]/route.js` | **Dev 2 (you)** |
| `app/api/notifications/route.js` | **Dev 2 (you)** |
| `lib/pipeline/process-sent-email.js`, `lib/pipeline/process-reply.js` | **Dev 2 (you)** |
| Rate limiting / retry inside Groq client | **Dev 2 (you)** |
| `types/` (JSDoc typedefs — project is JS-only, no TS) | **Dev 2 (you)** |

### Defects found in existing Dev-2-owned scaffold code 🐛

1. **Deprecated Groq models.** `classify-application.js`, `classify-reply.js` use `llama3-8b-8192` and `generate-draft.js` uses `llama3-70b-8192`. Groq decommissioned these; verify current IDs in the Groq console — expected replacements: `llama-3.1-8b-instant` (classification) and `llama-3.3-70b-versatile` (drafts). **Every AI call fails until this is fixed.**
2. **No rate limiting** in `lib/groq/client.js` — free tier is ~30 req/min; the initial scan will 429 on any real mailbox.
3. **Fragile JSON parsing** — regex `match(/\[[\s\S]*\]/)` instead of Groq JSON mode (`response_format: { type: "json_object" }`).
4. **`generate-draft.js` discards token usage** — `ai_drafts.groq_prompt_tokens` / `groq_completion_tokens` columns can never be populated.
5. **`lib/gmail/scan.js` never inserts `email_events`** — master plan says detected applications should also write a `sent` email event (the thread viewer and reply pipeline rely on it).
6. **`process-webhook.js` skips all SENT messages** — applications sent *after* the initial scan are only caught by the daily 02:00 cron, not in real time. The planned `process-sent-email.js` closes this gap.
7. **No per-message error isolation** in the webhook loop — one bad message aborts the rest and the `history_id` cursor still advances (events silently lost).

---

## 3. Architecture we follow

### Ownership boundaries (unchanged from PLAN.md)

```
                 Dev 1                      Dev 2 (YOU)                    Dev 3
        ┌────────────────────┐    ┌───────────────────────────┐   ┌──────────────────┐
Gmail ──▶ /api/webhooks/gmail ───▶ lib/pipeline/process-webhook ─▶ Realtime → UI     │
        │ /api/gmail/scan ────────▶ lib/gmail/scan + groq/classify│  (done)          │
        │ /api/cron/* ────────────▶ lib/pipeline/*              │ │                  │
        │ auth, tokens, watch │    │ /api/applications/*  ◀──────── fetch()          │
        └────────────────────┘    │ /api/drafts/*        ◀──────── fetch()          │
                                  │ /api/notifications   ◀──────── fetch()          │
                                  └───────────────────────────┘   └──────────────────┘
```

### Pipeline module architecture (Dev 2 target state)

```
lib/pipeline/
├── process-webhook.js       # orchestrator: resolve user, fetch history since stored
│                            #   cursor, route each addition, advance cursor ONLY
│                            #   after all messages processed (or individually caught)
├── process-reply.js         # one received message → classify → update application
│                            #   status → insert email_event + notification
└── process-sent-email.js    # one sent message → classify-application → upsert
                             #   applications + email_events (used by webhook AND
                             #   the daily scan-sent-mail cron)
```

### Rules

- **Auth in data routes:** `const supabase = await createClient()` (anon client + cookies) then `supabase.auth.getUser()`; return 401 if null. Query through the anon client so **RLS does the scoping** — no manual `user_id` filters needed, no service role in user-facing routes.
- **Service role** (`createServiceClient`) only inside pipeline code invoked by webhooks/cron.
- **Gmail access:** always via `getValidGmailClient(userId)` (Dev 1's token manager) — never construct an OAuth client directly.
- **Response envelope:** every JSON route returns `{ <resource>: ... }` on success, `{ error: string }` with proper status on failure — matches the contract table in Dev 3's plan.
- **This is Next.js 16** — APIs differ from training data. Run `npm install`, then **read `node_modules/next/dist/docs/` before writing any route handler** (route handler signatures, async `params`/`cookies`, caching semantics). `middleware.ts` is now `proxy.js` — already handled.
- JS only (`.js`/`.jsx`), JSDoc typedefs instead of TypeScript.

### API contracts (must match Dev 3's already-built fetch calls)

| Route | Method | Request | Response |
|---|---|---|---|
| `/api/applications` | GET | `?status=&archived=` (optional) | `{ applications: Application[] }` |
| `/api/applications/[id]` | GET / PATCH / DELETE | PATCH: `{ status?, notes?, is_archived? }` | `{ application }` / `{ success: true }` |
| `/api/applications/[id]/thread` | GET | — | `{ messages: [{ id, from, to, subject, date, snippet, body, direction }] }` |
| `/api/drafts` | POST | `{ applicationId, draftType }` | `{ draft: AiDraft }` |
| `/api/drafts/[id]` | GET / PATCH / DELETE | PATCH: `{ body_edited }` | `{ draft }` / `{ success: true }` |
| `/api/notifications` | GET | — | `{ notifications: Notification[] }` (unread first, newest first) |
| `/api/notifications` | PATCH | `{ ids: string[] }` | `{ success: true }` |

Draft type ENUM: `follow_up | interview_confirm | info_response | offer_accept | offer_decline | general_reply`
Status ENUM: `applied | replied | interview | offer | rejected | ghosted | follow_up_due | withdrawn`

---

## 4. Dev 2 checklist

### Phase 0 — Environment & groundwork
- [ ] `npm install`; confirm `npm test` passes (Dev 3's 14 suites are the regression baseline)
- [ ] Read `node_modules/next/dist/docs/` — route handlers, dynamic route `params`, streaming, `after()`/`waitUntil` equivalents
- [ ] Create `.env.local` from the env list in PLAN.md §Environment Variables (get Supabase + Groq keys; Gmail/GCP values can wait for Dev 1)
- [ ] Apply `0001_initial_schema.sql` to the Supabase project (if not yet applied)
- [ ] Create `types/database.js`, `types/gmail.js`, `types/groq.js` with JSDoc `@typedef`s for Application, EmailEvent, AiDraft, Notification, classification results
- [ ] Seed script (`supabase/seed.sql` or scratch script): fake applications/notifications for one test user so routes are testable **without Dev 1's auth flow**

### Phase 1 — Groq client hardening (fixes defects 1–4)
- [ ] Verify current Groq model IDs in console; replace `llama3-8b-8192` → `llama-3.1-8b-instant`, `llama3-70b-8192` → `llama-3.3-70b-versatile` (or whatever is current); hoist model names to constants in `lib/groq/client.js`
- [ ] Add rate limiter to `lib/groq/client.js` — simple token-bucket (default 25 req/min, configurable) wrapping `chat.completions.create`
- [ ] Add retry with exponential backoff on 429/5xx (respect `retry-after`), max 3 attempts
- [ ] Switch all 3 prompt modules to `response_format: { type: "json_object" }`; batch classifier returns `{ "results": [...] }` (JSON mode requires an object root)
- [ ] Return `usage` (prompt/completion tokens) from `generateDraft` so the drafts route can persist it
- [ ] Keep existing safe fallbacks on parse failure (already good)
- [ ] Unit tests with mocked Groq SDK: parsing, fallback, rate-limit queuing, retry

### Phase 2 — Data API routes (unblocks Dev 3's UI)
- [ ] `app/api/applications/route.js` — GET list; optional `status` / `archived` query filters; sorted by `last_activity_at DESC NULLS LAST, application_date DESC`
- [ ] `app/api/applications/[id]/route.js` — GET one; PATCH (whitelist: `status`, `notes`, `is_archived`, `role_title`, `company_name`); DELETE
- [ ] `app/api/applications/[id]/thread/route.js` — GET: look up application → `fetchThread(userId, gmail_thread_id)` (lib exists) → mark each message `direction: sent|received` by comparing `From` to the user's `gmail_address`; fall back to stored `email_events` if Gmail fetch fails (token missing in dev)
- [ ] `app/api/notifications/route.js` — GET (unread first, cap 50); PATCH `{ ids }` → `is_read = true`
- [ ] 401 handling on all routes; 404 when RLS returns no row
- [ ] Route tests (mock `createClient`) for happy path + 401 + 404
- [ ] **Remove/disable `NEXT_PUBLIC_DEV_PREVIEW` bypass reliance** once routes work with a seeded session — flag it so it never ships

### Phase 3 — Drafts vertical (Phase 5 of master plan, minus send)
- [ ] `app/api/drafts/route.js` — POST `{ applicationId, draftType }`: fetch application (RLS client) → last 3 thread messages via `fetchThread` (graceful fallback to `email_events` snippets) → `generateDraft()` → INSERT `ai_drafts` with model + token usage → `{ draft }`
- [ ] `app/api/drafts/[id]/route.js` — GET; PATCH `{ body_edited }`; DELETE
- [ ] Validate `draftType` against ENUM before hitting Groq
- [ ] Prompt iteration: test drafts for each of the 6 types against 2–3 real-ish threads; tune SYSTEM_PROMPT wording
- [ ] Coordinate with Dev 1: `/api/gmail/send` consumes `ai_drafts` (`body_edited ?? body_markdown`, sets `was_sent`, `gmail_sent_message_id`) — agree on that read/write split

### Phase 4 — Pipeline completion (fixes defects 5–7)
- [ ] Extract per-message reply logic from `process-webhook.js` → `lib/pipeline/process-reply.js` (input: `userId`, parsed message; idempotent via `email_events` unique key — skip classify if event already exists)
- [ ] New `lib/pipeline/process-sent-email.js` — classify a sent message via `classifyApplicationBatch`, upsert `applications` + insert `sent` `email_event`; **route SENT history additions here instead of skipping them**
- [ ] Rework `process-webhook.js` into an orchestrator: try/catch per message so one failure doesn't lose the batch; only advance `gmail_watches.history_id` after processing (log failures)
- [ ] Fix `lib/gmail/scan.js` to insert a `sent` `email_event` per detected application (reuse `process-sent-email.js` internals if clean)
- [ ] Also update `applications.last_activity_at` on initial detection
- [ ] Unit tests: reply-type → status mapping, idempotency (duplicate webhook delivery), SENT-message routing
- [ ] Confirm function signature of `processWebhookEvent(emailAddress, historyId)` with Dev 1 (their webhook route calls it)

### Phase 5 — Realtime & integration
- [ ] Verify Realtime publication rows exist (migration does this) and that RLS-authorized subscriptions work: two browser tabs, update a row, watch both update
- [ ] Confirm channel/filter shape matches Dev 3's `RealtimeProvider` + `ApplicationsTable` subscriptions (`postgres_changes` on `applications`/`notifications` filtered by `user_id`)
- [ ] Notification inserts from pipeline appear in NotificationBell live
- [ ] End-to-end pipeline dry run: seed a fake webhook payload → run `processWebhookEvent` against a test mailbox → status + notification + realtime all fire

### Phase 6 — Hardening (with Dev 1, master Phase 7)
- [ ] Cap Groq input sizes (truncate snippets/bodies before prompting)
- [ ] Structured error logging in pipeline (user_id, message_id, stage)
- [ ] Groq spend guard: skip classification when batch is empty; dedupe already-classified `gmail_message_id`s before calling Groq in scans
- [ ] Review `keyword_overrides` from `user_settings` → merge into scan query (currently unused)

---

## 5. Dev 1 gap — decision needed

Dev 1's entire surface (login, OAuth callback, token storage, watch, SSE scan route, send route, webhook route, all crons, GCP setup) is **not started**, and it blocks end-to-end testing of everything above (Phases 0–4 are testable with seeds + mocks; Phase 5 needs real auth).

Options, in order of preference:

1. **Ping Dev 1 now** — their `lib/gmail/` layer already exists from the scaffold, so their routes are mostly thin wrappers (`/api/gmail/scan` = auth check + stream `scanSentMail()`; `/api/webhooks/gmail` = decode + `processWebhookEvent()`; crons = loop users + call lib). Roughly 1–2 days of work plus GCP console setup.
2. **Dev 2 picks up the thin routes temporarily** (scan SSE, send, webhook, crons) since they wrap lib code Dev 2 is already deep in — leave OAuth callback + GCP + login page (the genuinely Dev-1 parts) to Dev 1.
3. Do nothing — dashboard stays on `DEV_PREVIEW` bypass with 404ing endpoints. Not viable.

Sequencing note: **Phases 0–2 have zero dependency on Dev 1** — start immediately. Phase 3 needs only Groq + seeded data. Phase 5 is where real Google auth becomes unavoidable.

---

## 6. Verification (Dev 2 scope)

1. **Groq:** `node` scratch script classifies 5 sample sent-mail snippets in one call, obeys rate limiter, survives a forced 429
2. **Applications API:** seeded user via cookie session → GET list/detail/thread return contract-shaped JSON; wrong user → 404 (RLS)
3. **Drafts:** POST → row in `ai_drafts` with token counts; PATCH `body_edited` persists; UI DraftPanel renders it
4. **Pipeline:** replay same webhook payload twice → exactly one `email_event`, one notification (idempotent)
5. **Realtime:** status update in SQL editor → dashboard row changes without refresh
6. **Regression:** `npm test` green after every phase
