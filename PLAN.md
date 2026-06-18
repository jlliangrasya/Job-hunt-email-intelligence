# Job Hunt Email Intelligence — Implementation Plan

## Context

Job seekers send applications across Gmail constantly but have no unified system to track replies, classify outcomes, or know when to follow up. Opportunities silently die in the inbox. This platform connects to Gmail via OAuth, auto-detects job applications the user has sent, watches for replies, classifies them with AI, drafts contextual responses, and surfaces everything in a real-time dashboard PWA. Built to eventually generalize to any outreach workflow.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend + Backend | Next.js 14 App Router (full-stack monorepo) |
| Database + Auth | Supabase (Postgres + Google OAuth) |
| AI | Groq API (`llama3-8b-8192` for classification, `llama3-70b-8192` for drafts) |
| Email | Gmail API (OAuth2, Push Notifications via Google Cloud Pub/Sub) |
| Background Jobs | Vercel Cron |
| PWA | `@ducanh2912/next-pwa` |
| UI | Tailwind CSS + shadcn/ui |

---

## Folder Structure

```
src/
├── app/
│   ├── layout.tsx                    # root layout, PWA meta
│   ├── page.tsx                      # redirect → /dashboard or /login
│   ├── (auth)/
│   │   ├── login/page.tsx            # Google OAuth sign-in UI
│   │   └── auth/callback/route.ts   # Supabase OAuth callback + token storage
│   ├── (app)/
│   │   ├── layout.tsx               # sidebar, topnav, notification bell
│   │   ├── dashboard/page.tsx       # main applications table (SSR + Realtime)
│   │   ├── applications/[id]/page.tsx  # thread view + AI draft panel
│   │   ├── onboarding/page.tsx      # 3-step wizard
│   │   └── settings/page.tsx        # preferences, disconnect Gmail
│   └── api/
│       ├── auth/google/route.ts     # store tokens after OAuth
│       ├── auth/revoke/route.ts     # revoke token, clear DB
│       ├── gmail/watch/route.ts     # setup/renew Pub/Sub watch
│       ├── gmail/scan/route.ts      # SSE-streamed initial + incremental scan
│       ├── gmail/send/route.ts      # send draft via Gmail API
│       ├── webhooks/gmail/route.ts  # Pub/Sub push endpoint (no auth middleware)
│       ├── applications/route.ts    # GET list
│       ├── applications/[id]/route.ts         # GET/PATCH/DELETE
│       ├── applications/[id]/thread/route.ts  # GET Gmail thread
│       ├── drafts/route.ts          # POST generate draft
│       ├── drafts/[id]/route.ts     # GET/PATCH/DELETE
│       ├── notifications/route.ts   # GET unread, PATCH mark-read
│       └── cron/
│           ├── renew-watches/route.ts       # daily watch renewal
│           ├── scan-sent-mail/route.ts      # daily incremental scan
│           └── follow-up-reminders/route.ts # daily stale-app flagging
├── components/
│   ├── ui/                          # shadcn/ui primitives
│   ├── layout/Sidebar.tsx, TopNav.tsx, NotificationBell.tsx
│   ├── dashboard/ApplicationsTable.tsx, StatusBadge.tsx, StatsCards.tsx, FilterBar.tsx
│   ├── application/ThreadViewer.tsx, DraftPanel.tsx, DraftEditor.tsx, ApplicationMeta.tsx
│   ├── onboarding/OnboardingWizard.tsx, StepConnectGmail.tsx, StepScanProgress.tsx, StepDone.tsx
│   └── providers/SupabaseProvider.tsx, RealtimeProvider.tsx
├── lib/
│   ├── supabase/client.ts, server.ts, middleware.ts
│   ├── gmail/client.ts, token-manager.ts, watch.ts, history.ts, messages.ts, send.ts, scan.ts
│   ├── groq/client.ts, classify-application.ts, classify-reply.ts, generate-draft.ts
│   ├── pipeline/process-webhook.ts, process-sent-email.ts, process-reply.ts
│   └── utils/mime.ts, date.ts, email-parser.ts, cron-secret.ts
└── types/database.ts, gmail.ts, groq.ts
```

---

## Database Schema

### Tables

**`user_tokens`** — Google OAuth credentials per user
- `user_id` (FK → auth.users), `google_access_token`, `google_refresh_token`, `token_expires_at`, `gmail_address`, `scopes[]`
- UNIQUE on `user_id`; RLS: user reads/writes own row only

**`gmail_watches`** — Active Pub/Sub push subscriptions
- `user_id`, `history_id` (last known, used as cursor), `expiration`, `topic_name`, `is_active`
- UNIQUE on `user_id`; RLS: user reads/writes own row only

**`applications`** — One row per detected job application thread
- `user_id`, `gmail_thread_id`, `gmail_message_id`, `company_name`, `role_title`
- `status` ENUM: `applied | replied | interview | offer | rejected | ghosted | follow_up_due | withdrawn`
- `application_date`, `last_activity_at`, `follow_up_due_at`, `recipient_email`, `subject`, `ai_confidence`, `raw_snippet`, `notes`, `is_archived`
- UNIQUE on `(user_id, gmail_thread_id)`; indexes on `(user_id, status)` and `follow_up_due_at`
- RLS: all CRUD for own rows

**`email_events`** — Raw email events tied to applications
- `user_id`, `application_id` (FK, nullable), `gmail_message_id`, `gmail_thread_id`
- `direction` ENUM: `sent | received`
- `from_address`, `to_addresses[]`, `subject`, `snippet`, `received_at`
- `groq_reply_type` (interview_invite | rejection | info_request | offer | acknowledgment | other)
- `groq_raw_response` JSONB
- UNIQUE on `(user_id, gmail_message_id)`

**`ai_drafts`** — Generated drafts, edited versions, send status
- `user_id`, `application_id` (FK), `draft_type` ENUM, `subject`, `body_markdown`, `body_edited`, `groq_model`, `groq_prompt_tokens`, `groq_completion_tokens`, `was_sent`, `sent_at`, `gmail_sent_message_id`

**`notifications`** — In-app notification queue
- `user_id`, `application_id` (FK, nullable), `type` ENUM, `title`, `body`, `is_read`
- Index on `(user_id, is_read, created_at DESC)` WHERE `is_read = false`
- Realtime-enabled

**`user_settings`** — Per-user preferences
- `user_id` (PK), `follow_up_delay_days` (default 7), `email_digest_enabled`, `keyword_overrides[]`, `onboarding_completed`, `initial_scan_completed`, `scan_lookback_days` (default 90)

All tables: `updated_at` trigger, RLS enabled. Supabase Realtime enabled on `applications` and `notifications`.

---

## Feature Data Flows

### 1. Auth & Gmail Connection

```
Login → supabase.signInWithOAuth({ provider: 'google',
           options: { scopes: 'gmail.readonly gmail.send',
                      queryParams: { access_type: 'offline', prompt: 'consent' } }})
→ /auth/callback/route.ts:
    1. exchangeCodeForSession(code)
    2. Extract provider_token + provider_refresh_token
    3. UPSERT user_tokens — NEVER overwrite refresh_token with null
    4. UPSERT user_settings with defaults
    5. POST /api/gmail/watch
    6. Redirect → /onboarding (first login) or /dashboard
```

Token refresh (`lib/gmail/token-manager.ts`): check `token_expires_at`, if within 60s call Google token endpoint, UPDATE `user_tokens`, return fresh token. Called before every Gmail API request.

### 2. Application Detection Engine

**Initial scan** (triggered by onboarding wizard, streamed via SSE):
```
POST /api/gmail/scan { mode: 'initial' }
→ gmail.users.messages.list({ q: 'in:sent (applied OR application OR resume OR "cover letter" OR "position of" OR "opportunity at")' })
→ Paginate (500 per page), batch messages.get in groups of 10
→ For each message: classify-application.ts (Groq llama3-8b, batch 5 emails per call)
→ If isJobApplication && confidence > 0.75: UPSERT applications + email_events
→ Stream progress: data: {"scanned": 10, "total": 342, "detected": 3}
→ UPDATE user_settings.initial_scan_completed = true
```

**Incremental scan** (Vercel Cron 02:00 UTC): uses stored `history_id` as cursor via `users.history.list`.

### 3. Reply Intelligence Pipeline

```
Pub/Sub push → POST /api/webhooks/gmail (no auth middleware)
→ Decode base64 message.data → { emailAddress, historyId }
→ Lookup user_id by gmail_address in user_tokens
→ Respond 200 immediately, process async via waitUntil()
→ gmail.users.history.list({ startHistoryId: previousHistoryId })
→ For each new message:
    a. messages.get → extract threadId
    b. SELECT application WHERE gmail_thread_id = threadId
    c. If found AND direction=received:
       → classify-reply.ts (Groq) → reply type
       → UPDATE applications.status + last_activity_at
       → INSERT email_events, INSERT notification
       → Supabase Realtime fires → dashboard updates live
→ UPDATE gmail_watches.history_id = latest
```

**Critical**: The Pub/Sub `historyId` is NOT used for `history.list` — use the PREVIOUSLY stored `history_id` from `gmail_watches`.

### 4. AI Draft Generator

```
POST /api/drafts { applicationId, draftType }
→ Fetch application metadata + last 3 thread messages via gmail.users.threads.get
→ generate-draft.ts (Groq llama3-70b): subject + body + suggestedSendTime
→ INSERT ai_drafts → return to DraftEditor

PATCH /api/drafts/[id] { body_edited } → user edits

POST /api/gmail/send { draftId }
→ Compose RFC 2822 MIME with In-Reply-To + References headers (for threading)
→ gmail.users.messages.send({ raw: base64url(mime) })
→ UPDATE ai_drafts.was_sent=true + INSERT email_events
```

### 5. Dashboard

- SSR initial load (Server Component + `createServerClient`) for fast paint
- Client: Supabase Realtime subscription on `applications` table filtered by `user_id`
- Client-side filtering/sorting (status, date, company) on local state
- `StatsCards`: Applied / Interview / Offer / Rejected counts
- Click row → `/applications/[id]` with thread + draft panel

### 6. Reminder System (Vercel Cron 09:00 UTC)

```
/api/cron/follow-up-reminders:
→ SELECT applications WHERE status='applied' AND application_date < now() - follow_up_delay_days
→ UPDATE status='follow_up_due', follow_up_due_at=now()
→ INSERT notifications (type: follow_up_reminder)
→ If email_digest_enabled: send Gmail digest to user
```

### 7. Onboarding Wizard

- Step 1: Check refresh_token exists → show Gmail connect button if not
- Step 2: POST scan, consume SSE stream → animated progress bar
- Step 3: "Found X applications" → Go to Dashboard
- Wizard hidden from users with `onboarding_completed = true`

---

## Groq Prompts

### classify-application.ts
- Model: `llama3-8b-8192`, temp 0.1, max_tokens 150
- Batch 5 emails per call to stay within rate limits
- Returns: `{ isJobApplication, confidence, companyName, roleTitle, applicationDate }`
- Threshold: only persist if `confidence > 0.75`

### classify-reply.ts
- Model: `llama3-8b-8192`, temp 0.1, max_tokens 200
- Input: original application context + reply subject/snippet
- Returns: `{ replyType, confidence, keyDetail }` where replyType ∈ `interview_invite | rejection | info_request | offer | acknowledgment | other`

### generate-draft.ts
- Model: `llama3-70b-8192`, temp 0.7, max_tokens 500
- Input: company, role, status, last 3 thread messages, draft type
- Draft types: `follow_up | interview_confirm | info_response | offer_accept | offer_decline | general_reply`
- Returns: `{ subject, body, suggestedSendTime }`

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_SITE_URL=               # https://your-app.vercel.app
GMAIL_PUBSUB_TOPIC=                 # projects/xxx/topics/gmail-push
GMAIL_WEBHOOK_SECRET=               # validate Pub/Sub messages
GROQ_API_KEY=
CRON_SECRET=                        # Vercel injects automatically
```

---

## Vercel Cron Jobs (`vercel.json`)

| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/renew-watches` | `0 6 * * *` | Renew Gmail watches expiring within 48h |
| `/api/cron/scan-sent-mail` | `0 2 * * *` | Incremental sent-mail scan for all users |
| `/api/cron/follow-up-reminders` | `0 9 * * *` | Flag stale applications, create notifications |

All cron routes validate `Authorization: Bearer <CRON_SECRET>` and process users in batches of 10 with `Promise.allSettled`.

---

## Middleware

```typescript
// middleware.ts — exclude webhooks and static assets from auth guard
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)']
}
```

---

## Key Gotchas

| Area | Gotcha | Fix |
|---|---|---|
| Refresh token | Supabase returns `null` on re-login | Never overwrite DB refresh_token with null |
| historyId | Pub/Sub notification historyId ≠ cursor | Use PREVIOUS stored historyId for `history.list` |
| Watch TTL | Expires in ~7 days | Renew daily; store exact expiration timestamp |
| Webhook speed | Pub/Sub retries if not acked in time | Respond 200 immediately, process with `waitUntil()` |
| OAuth scopes | gmail.send is restricted scope | App stays in test mode (≤100 users) until Google verification |
| RLS + cron | Cron jobs need service role to bypass RLS | Use `SUPABASE_SERVICE_ROLE_KEY` in all cron/webhook routes |
| MIME threading | Reply won't thread without proper headers | Include `In-Reply-To` + `References` in MIME composition |
| Groq rate limits | 30 req/min on free tier | Batch 5 emails per classification call |

---

## Implementation Phases

| Phase | Focus | Key Deliverables |
|---|---|---|
| 1 | Foundation | Next.js scaffold, Supabase schema, Google OAuth, token storage, middleware, PWA config |
| 2 | Gmail Integration | Gmail client, token manager, initial scan, watch setup, webhook receiver, history fetch |
| 3 | AI Classification | Groq client, classify-application + classify-reply, pipeline wiring, status updates |
| 4 | Core UX | Onboarding wizard, dashboard table, status badges, thread viewer, notifications |
| 5 | AI Draft & Send | Draft generation, inline editor, MIME send, draft persistence |
| 6 | Reminders & Settings | Cron jobs, follow-up flagging, settings page, Gmail disconnect |
| 7 | Production Hardening | Rate limiting, error boundaries, retry logic, Vercel env setup, GCP Pub/Sub config |

---

## Team Roles & Responsibilities

All three developers have similar full-stack skills, so ownership is split by **feature domain** rather than tech layer. Each dev owns their modules end-to-end (DB schema, API routes, lib utilities, and UI components).

---

### Dev 1 — Infrastructure & Gmail Integration

**Owns:** Everything that touches Google/Gmail, the auth lifecycle, background jobs, and deployment infrastructure.

**Modules:**
- `lib/supabase/` — Supabase client setup (browser, server, middleware)
- `lib/gmail/` — all 7 files: `client.ts`, `token-manager.ts`, `watch.ts`, `history.ts`, `messages.ts`, `send.ts`, `scan.ts`
- `lib/utils/mime.ts`, `email-parser.ts`, `cron-secret.ts`
- `app/(auth)/` — login page + OAuth callback route
- `app/api/auth/` — token storage + revocation routes
- `app/api/gmail/` — watch, scan (SSE stream), send routes
- `app/api/webhooks/gmail/route.ts` — Pub/Sub receiver
- `app/api/cron/` — all 3 cron routes
- `middleware.ts` — auth guard + webhook bypass
- `supabase/migrations/` — full DB schema SQL
- `vercel.json` — cron definitions
- `next.config.js` — PWA config + headers
- GCP Pub/Sub setup (topic, subscription, IAM)
- Vercel environment variables setup

**Phase ownership:** Phase 1 (foundation) + Phase 2 (Gmail integration) + Phase 7 (prod hardening)

---

### Dev 2 — AI Pipeline & Data Layer

**Owns:** Everything Groq-related, the classification/drafting pipelines, and all API routes that serve application data to the frontend.

**Modules:**
- `lib/groq/` — all 4 files: `client.ts`, `classify-application.ts`, `classify-reply.ts`, `generate-draft.ts`
- `lib/pipeline/` — `process-webhook.ts`, `process-sent-email.ts`, `process-reply.ts`
- `lib/utils/date.ts`
- `app/api/applications/` — list, detail, thread routes
- `app/api/drafts/` — generate + manage draft routes
- `app/api/notifications/route.ts`
- `types/` — `database.ts` (supabase gen types), `gmail.ts`, `groq.ts`
- Prompt engineering and iteration (all 3 Groq prompts)
- Rate limiting logic inside Groq client
- Supabase Realtime policy configuration

**Phase ownership:** Phase 3 (AI classification) + Phase 5 (AI draft & send)

---

### Dev 3 — Frontend & UX

**Owns:** All user-facing pages, components, and the real-time client experience. Consumes the APIs built by Dev 1 and Dev 2.

**Modules:**
- `app/(app)/` — all authenticated pages: dashboard, applications/[id], onboarding, settings
- `app/layout.tsx` + `app/page.tsx`
- `components/ui/` — shadcn/ui primitives
- `components/layout/` — Sidebar, TopNav, NotificationBell
- `components/dashboard/` — ApplicationsTable, StatusBadge, StatsCards, FilterBar
- `components/application/` — ThreadViewer, DraftPanel, DraftEditor, ApplicationMeta
- `components/onboarding/` — full wizard (all 4 step components)
- `components/providers/` — SupabaseProvider, RealtimeProvider
- `public/manifest.json` + PWA icons
- `globals.css` + Tailwind config
- PWA install prompt behavior

**Phase ownership:** Phase 4 (core UX) + Phase 6 (reminders & settings)

---

### Coordination Points (where devs must sync)

| Touch point | Who | What to agree on |
|---|---|---|
| DB schema | Dev 1 writes it, Dev 2 + Dev 3 review | Column names, ENUM values, RLS rules |
| API contracts | Dev 2 defines request/response shapes | Dev 3 must align component data expectations |
| Webhook → pipeline | Dev 1 (webhook) calls Dev 2 (pipeline) | Function signature of `process-webhook.ts` |
| SSE scan stream | Dev 1 (route) + Dev 3 (UI consumer) | Event payload shape for progress updates |
| Realtime events | Dev 2 (policy) + Dev 3 (subscription) | Channel name + filter format |
| Token manager | Dev 1 owns it | Dev 2 must call it before every Gmail API call in pipeline |

---

## Verification Plan

1. **Auth**: Sign in with Google → check `user_tokens` row has non-null `google_refresh_token`
2. **Scan**: Complete onboarding → confirm `applications` table populated, SSE progress works
3. **Webhook**: Send a test email reply to a tracked thread → confirm status updates on dashboard within seconds
4. **Draft**: Open any application → generate draft → edit → send → confirm email appears in Gmail Sent
5. **Reminders**: Manually set `application_date` to 14 days ago → run cron → confirm `follow_up_due` status + notification
6. **PWA**: Open app in Chrome → install as PWA → verify manifest + service worker via DevTools → test offline cached shell
7. **Realtime**: Open dashboard in two browser tabs → change application status in one → confirm instant update in other
