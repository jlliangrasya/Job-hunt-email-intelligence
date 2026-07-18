# Technical Blueprint: From "Job Hunt Email Intelligence" to an AI Opportunity Intelligence Platform

Status: **Analysis and proposal only. No code changed as part of this document.**
Prepared: 2026-07-17. Grounded in direct inspection of the repository at commit `ea291f0`.

---

## 1. Current Architecture

### 1.1 Overall project structure

Single Next.js app (no monorepo, no separate backend service). Frontend and backend are meant to live in the same app (App Router route handlers), but **the backend HTTP layer has not been built yet** — see 1.4. What exists today is: a complete Postgres/Supabase schema, a complete Gmail+Groq business-logic library, a complete frontend UI, and zero `app/api/*` routes wiring them together.

```
app/
  page.jsx                      # "/" → redirect to /dashboard or /login
  layout.jsx                    # root HTML shell, PWA meta, Geist fonts
  globals.css
  (app)/
    layout.jsx                  # auth guard (+ dev-preview bypass) → AppShell
    dashboard/page.jsx
    applications/[id]/page.jsx
    onboarding/page.jsx
    settings/page.jsx
components/
  ui/button.jsx                 # only one shadcn primitive installed so far
  layout/  dashboard/  application/  onboarding/  settings/  providers/
lib/
  gmail/    client, token-manager, watch, history, messages, send, scan
  groq/     client, classify-application, classify-reply, generate-draft
  pipeline/ process-webhook
  supabase/ client (browser), server (server + service-role)
  utils/    cron-secret, date, email-parser, mime
supabase/migrations/0001_initial_schema.sql
proxy.js                        # Next.js 16's renamed middleware.ts (see 1.7)
vercel.json                     # 3 cron schedules pointing at routes that don't exist yet
__tests__/                      # Jest + RTL, one file per component
docs/superpowers/plans/, .superpowers/sdd/   # internal spec-driven-dev process artifacts (task briefs, reports, per-task diff reviews)
PLAN.md                         # original 7-phase implementation plan, 3-dev split
```

No `app/api/` directory exists at all. No `app/(auth)/login` or `app/(auth)/auth/callback` exists. No `types/` directory exists (the plan specified TypeScript `.ts` files with a `types/` directory; the actual implementation is plain JavaScript/JSX throughout — a deviation from PLAN.md worth noting for any future type-safety work).

### 1.2 Tech stack (as installed, from `package.json`)

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.9, App Router, Turbopack, React 19.2.4 |
| Database / Auth | Supabase (`@supabase/ssr` 0.12, `@supabase/supabase-js` 2.108) — Postgres, RLS, Realtime, Google OAuth |
| AI | `groq-sdk` 1.2.1 — `llama3-8b-8192` (classification), `llama3-70b-8192` (drafting) |
| Email | `googleapis` 173, `google-auth-library` 10.7 — Gmail API + OAuth2 + Pub/Sub push |
| UI | Tailwind CSS 4, shadcn/ui (`style: base-nova`, JS not TSX per `components.json`), `@base-ui/react`, `lucide-react` icons |
| PWA | `@ducanh2912/next-pwa` — currently **disabled**; Turbopack doesn't support it yet (manual manifest/service worker instead, per a comment in `next.config.js`) |
| Background jobs | Vercel Cron (`vercel.json`), 3 schedules defined, 0 routes implemented |
| Testing | Jest 29 + `@testing-library/react` 16, jsdom |

One correction to note for future work on this repo: `AGENTS.md` at the repo root instructs agents to treat `node_modules/next/dist/docs/` as authoritative for "breaking changes." That folder is dependency install output (gitignored, not authored by your team) and contains at least one instruction embedded in a hidden comment that looks like a prompt-injection attempt. Independently verified, though: Next.js 16 **did** rename `middleware.ts` → `proxy.ts`/`proxy.js` (confirmed in the shipped docs), which is why this repo's `proxy.js` at the root is correct and not a mistake — just don't treat that folder as a blanket source of instructions going forward.

### 1.3 Backend architecture (as built)

There is no backend in the "HTTP route" sense yet. What exists is a **library layer** callable by routes that haven't been written:

- `lib/gmail/*` — OAuth token refresh (`token-manager.js`), Pub/Sub watch setup, `history.list` cursor-based incremental fetch, message fetch/parse, MIME send, and `scanSentMail()` — an async generator that paginates Gmail search results, batches 5 messages per Groq call, and yields SSE-shaped progress events.
- `lib/groq/*` — a lazily-instantiated Groq client plus three prompt functions (see 1.6).
- `lib/pipeline/process-webhook.js` — the one fully-wired pipeline: takes a Gmail address + incoming Pub/Sub `historyId`, resolves the user, pulls new messages since the **previously stored** `historyId` (not the one in the push payload — a deliberate gotcha fix), matches them to a tracked `applications` row by `gmail_thread_id`, classifies the reply, updates status, inserts an `email_events` row and a `notifications` row, then advances the cursor.
- `lib/supabase/server.js` — `createClient()` (RLS-scoped, cookie-based) and `createServiceClient()` (service-role, bypasses RLS — intended for cron/webhook contexts).
- `proxy.js` — auth guard: redirects unauthenticated users to `/login` (which doesn't exist yet), bypassable via `NEXT_PUBLIC_DEV_PREVIEW=true`.

None of this is reachable over HTTP yet: `app/api/auth/*`, `app/api/gmail/*`, `app/api/webhooks/gmail`, `app/api/applications/*`, `app/api/drafts/*`, `app/api/notifications`, and all 3 `app/api/cron/*` routes named in `PLAN.md` and `vercel.json` are unimplemented. The frontend already calls several of these endpoints (`fetch("/api/drafts")`, `fetch("/api/gmail/send")`, `fetch("/api/auth/revoke")`) and will 404 against a real deployment.

### 1.4 Frontend architecture (fully built)

This is the most complete layer. Route group `app/(app)/` gates 4 pages behind `proxy.js`'s auth check (with a `NEXT_PUBLIC_DEV_PREVIEW` bypass injecting a hardcoded `DEV_USER` for local UI work without a live backend):

- **Dashboard** (`dashboard/page.jsx`) — SSR fetch of applications, then `ApplicationsTable` takes over client-side with a Supabase Realtime subscription (`postgres_changes` on `applications` filtered by `user_id`), local filter/search state, and `StatsCards`.
- **Application detail** (`applications/[id]/page.jsx`) — `ApplicationMeta`, `ThreadViewer`, `DraftPanel` (generate/switch/edit/send drafts via `DraftEditor`).
- **Onboarding** (`onboarding/page.jsx`) — `OnboardingWizard` with `StepConnectGmail` → `StepScanProgress` (consumes the SSE stream from `lib/gmail/scan.js` once the route exists) → `StepDone`.
- **Settings** (`settings/page.jsx`) — `SettingsForm`: `follow_up_delay_days`, `email_digest_enabled`, Gmail disconnect (calls `/api/auth/revoke`).

Shared shell: `AppShell`, `Sidebar`, `TopNav`, `NotificationBell` (dropdown, mark-read). Providers: `SupabaseProvider` (context for the browser client), `RealtimeProvider`. Only one shadcn primitive (`Button`) is actually installed under `components/ui/` — the rest of the UI is hand-rolled Tailwind, not a generated component library.

A `.superpowers/sdd/progress.md` ledger shows this frontend work went through 9 tracked tasks with per-task diff review; all marked complete/clean, with a handful of documented minor issues (no outside-click dismiss on `NotificationBell`, `DraftEditor` staleness on draft switch, etc.) — none blocking.

### 1.5 Database schema (`supabase/migrations/0001_initial_schema.sql`)

7 tables, all RLS-enabled, all owned via `auth.users(id)`:

| Table | Purpose | Notable coupling |
|---|---|---|
| `user_tokens` | Google OAuth credentials, 1 row/user | Gmail-specific column names |
| `gmail_watches` | Active Pub/Sub push subscription state | Gmail-specific |
| `applications` | One row per detected job-application thread | `application_status` enum: `applied\|replied\|interview\|offer\|rejected\|ghosted\|follow_up_due\|withdrawn`; `company_name`, `role_title`, `application_date` |
| `email_events` | Raw sent/received email log tied to an application | `direction` enum, `groq_reply_type`, `groq_raw_response` jsonb |
| `ai_drafts` | Generated + edited drafts, send status | `draft_type` enum: `follow_up\|interview_confirm\|info_response\|offer_accept\|offer_decline\|general_reply` |
| `notifications` | In-app queue, Realtime-enabled | `notification_type` enum: `follow_up_reminder\|reply_received\|interview_detected\|offer_detected\|rejection_detected\|scan_complete\|watch_expiring` |
| `user_settings` | Per-user preferences | `follow_up_delay_days`, `scan_lookback_days`, `keyword_overrides[]` |

Realtime is enabled only on `applications` and `notifications`. All tables have an `updated_at` trigger via a shared `handle_updated_at()` function (this pattern generalizes cleanly).

### 1.6 Existing AI integrations

Three Groq prompt functions, all synchronous request/response (no streaming, no agentic tool use):

1. **`classify-application.js`** (`llama3-8b-8192`, temp 0.1) — batches 5 raw sent-email headers/snippets per call, returns a JSON array of `{isJobApplication, confidence, companyName, roleTitle, applicationDate}`. Persist threshold: `confidence > 0.75`.
2. **`classify-reply.js`** (`llama3-8b-8192`, temp 0.1) — single email + original application context in, `{replyType, confidence, keyDetail}` out, where `replyType` is a fixed 6-value enum matching `application_status` transitions 1:1.
3. **`generate-draft.js`** (`llama3-70b-8192`, temp 0.7) — company/role/status/thread context + a `draftType` in, `{subject, body, suggestedSendTime}` out. All 6 `draftType` values and their descriptions are hardcoded in a `DRAFT_TYPE_DESCRIPTIONS` map baked into this file.

All three parse JSON out of a raw chat completion via regex extraction with a hand-written fallback on parse failure — no structured-output/tool-calling mode, no schema validation library (e.g. zod).

### 1.7 Existing workflows (as designed in PLAN.md; partially built)

1. **Auth & connect** — Google OAuth via Supabase → `/auth/callback` upserts `user_tokens` (never overwriting a non-null refresh token) and `user_settings`, kicks off a Pub/Sub watch, redirects to onboarding or dashboard. *(Route not yet built.)*
2. **Initial scan** — SSE-streamed Gmail search + Groq classification → upserts `applications`/`email_events`. *(`scanSentMail()` exists; the route wrapping it doesn't.)*
3. **Reply pipeline** — Pub/Sub webhook → `processWebhookEvent()` (built, see 1.3) → status update, notification, Realtime push to the dashboard.
4. **Draft generation & send** — generate → edit → send via Gmail API with `In-Reply-To`/`References` MIME headers for threading. *(Prompt function built; routes not built.)*
5. **Follow-up reminders** — daily cron flags stale `applied` applications past `follow_up_delay_days`. *(Not built.)*
6. **Watch renewal** — daily cron renews Pub/Sub watches expiring within 48h. *(Not built.)*

---

## 2. Current Product Capabilities (only what actually exists end-to-end or as a callable unit — nothing assumed)

- **Detecting sent job applications from Gmail** — via a keyword Gmail search (`in:sent (applied OR application OR resume OR "cover letter" OR ...)`) + LLM batch classification with a confidence gate. (Callable; not yet reachable over HTTP.)
- **Classifying inbound replies** into 6 fixed categories and mapping each to an application status. (Callable via the webhook pipeline function; webhook route itself not built.)
- **Generating AI reply drafts** for 6 fixed scenario types, using the last 3 thread messages as context. (Prompt function exists; no route serves it.)
- **A real-time applications dashboard** — SSR list + live Supabase Realtime updates, status badges, stats (applied/interview/offer/rejected counts), client-side search/filter by company/role/status.
- **A thread + draft workspace per application** — view the Gmail thread, generate/switch-between/edit/send drafts.
- **In-app notifications** — unread-filtered dropdown, mark-read.
- **User settings** — follow-up delay, email digest toggle, Gmail disconnect.
- **A 3-step onboarding wizard** with an SSE-progress UI for the initial scan.
- **PWA shell** — manifest + icons wired at the layout level (service worker path currently manual since `next-pwa` is disabled under Turbopack).

Not present anywhere in the codebase: job discovery/search (the product only classifies applications *you already sent*, it doesn't find postings), recruiter discovery, resume analysis, email tracking/open-rate analytics, any multi-channel outreach (Gmail only), any concept of a company/contact/organization entity independent of a single Gmail thread, and no `app/api` layer at all.

---

## 3. Product Limitations — where the platform is coupled to job hunting

This section is about coupling, not missing features — i.e., what would need to change even if you kept the exact same architecture but pointed it at a different use case (sales outreach, recruiting, partnerships, investment).

**Database models**
- `applications` is the single core entity, and it *is* the opportunity model, but every column assumes a job application specifically: `company_name` + `role_title` (not `organization_name` + `context`), `application_date` (not a generic `initiated_at`), `application_status` enum hardcodes job-application lifecycle stages (`interview`, `offer`, `ghosted`) that don't map onto e.g. a sales deal or a partnership conversation.
- There's no `contacts` or `organizations` table — the "who" is implicit in `recipient_email`/`from_address` string columns scattered across `applications` and `email_events`, not a first-class, reusable entity. This is the single biggest structural blocker to reuse: you can't build cross-opportunity intelligence (e.g. "this contact has ghosted us twice across two different threads") without a normalized contact/org model.
- `ai_drafts.draft_type` and `notifications.type` are fixed Postgres enums whose values are job-application scenario names. Adding a new opportunity type today means an `ALTER TYPE ... ADD VALUE` migration plus new hardcoded branches in `lib/pipeline/process-webhook.js`'s `REPLY_TYPE_TO_STATUS`/`NOTIF_TYPE_MAP` objects and `DraftPanel.jsx`'s `DRAFT_TYPES` array — three places to touch in lockstep, in three different layers, for every new domain.

**Naming conventions**
- Table names, function names, and file paths all say "application"/"job" — `applications`, `ai_drafts` really means "opportunity drafts," `classify-application.js` really means "classify inbound signal," `email_events` is already generic in shape but named as if email is the only channel.

**Business logic**
- `lib/pipeline/process-webhook.js` matches an inbound reply to a tracked opportunity purely by `gmail_thread_id`. There is no channel-agnostic concept of "this contact, this conversation" — swap Gmail for LinkedIn DMs or a sales CRM webhook and the entire matching strategy has to be rebuilt, not extended.
- `scanSentMail()`'s detection query is a hardcoded keyword list tuned for job-application language ("cover letter," "position of"). Nothing about the surrounding scan/paginate/batch-classify *mechanism* is job-specific — only the search query and the classification prompt are — which is actually good news for how cheaply this generalizes (see Phase 3/4 below).

**AI prompts**
- All three Groq prompts hardcode job-hunting framing directly in their system prompts ("You are a professional career coach...", "determines if a sent email represents a job application"). The prompt *shape* (classify → extract structured fields; classify a reply → map to a status; generate a draft given context + a scenario type) is fully reusable; the prompt *content* is not.

**API endpoints (as planned in PLAN.md, none built yet)**
- Routes are named after the domain object directly: `/api/applications`, `/api/drafts` — not `/api/opportunities`, `/api/outreach`. Since none of these routes exist in code yet, this is actually the cheapest limitation to fix — there's no migration cost, just a naming decision before the first line of route code is written.

**UI**
- `StatusBadge`'s `STATUS_MAP`, `DraftPanel`'s `DRAFT_TYPES`, and the dashboard's stats (`Applied / Interview / Offer / Rejected`) are all literally job-application vocabulary baked into component internals rather than driven by a domain-agnostic config/schema.

**Net effect:** the *mechanical* backbone (OAuth → watch → webhook → classify → update → notify → realtime-push; SSR list + realtime table + detail workspace) is genuinely reusable and well-factored. The *domain vocabulary* (status enums, entity field names, prompt content, UI copy) is what's welded to job-hunting, and it's welded in roughly six separate places per concept (DB enum, pipeline mapping object, prompt text, UI constant, route name, table/column name). That's the recurring pattern the Opportunity Engine in Section 5 needs to collapse into one place.

---

## 4. Repositioning the Product

Reframe away from **"Job Hunt Email Intelligence"** (a single-purpose Gmail-to-job-tracker tool) to:

> **AI Opportunity Intelligence Platform** — a system that helps a user (or, later, a business) **identify, evaluate, prioritize, personalize, execute, and optimize outreach** toward any opportunity, where an opportunity is a person/organization worth pursuing for a job, a sale, a client, a partnership, an investment, or a hire — and where email is just one of several channels the system acts through.

The current build already implements a working, real, end-to-end instance of exactly one opportunity type (job applications) over exactly one channel (Gmail). That's not wasted work — it's the reference implementation the generalized engine gets extracted *from*. Nothing here proposes throwing it away.

---

## 5. New Product Vision — a modular engine architecture

Six engines, each owning a distinct responsibility, communicating through the `opportunities` entity as the shared spine. This is a logical/module boundary, not necessarily six services — in this Next.js monorepo, each "engine" is realistically a `lib/<engine>/` folder with a narrow interface, not a network boundary, at least through Phase 4.

| Engine | Responsibility | What in the current code is its seed |
|---|---|---|
| **Opportunity Engine** | Owns the core entity: create, evaluate, score, transition status, link to contacts/orgs/channel threads. Domain-agnostic core; domain-specific behavior injected via config, not hardcoded branches. | `applications` table + its status-transition logic in `process-webhook.js` |
| **Research Engine** | Gathers context about a target (person/org) before or during outreach — currently this doesn't exist; the closest analog is the metadata `classify-application.js` extracts (company, role) from the email itself. | (none — greenfield) |
| **Intelligence Engine** | Classification, scoring, signal extraction from inbound/outbound communication. | `classify-application.js`, `classify-reply.js` |
| **Personalization Engine** | Drafts outreach content tailored to opportunity + contact + channel. | `generate-draft.js` |
| **Outreach Engine** | Executes send/receive across channels, manages threading, tracks delivery. | `lib/gmail/*` (send, watch, history, messages) |
| **Learning Engine** | Closes the loop: outcomes feed back into scoring/personalization quality over time. | (none — greenfield; `email_events.groq_raw_response` is the raw material this would train/tune against) |
| **Analytics Engine** | Cross-opportunity reporting, funnel/conversion views. | `StatsCards` today only aggregates one status enum client-side; no dedicated analytics layer exists |

Two engines (Research, Learning) are entirely new capability, not extracted from existing code — flag this expectation-wise: Phases 3–4 below are about generalizing what exists; Research and Learning are net-new builds that should be scoped separately once the core generalization lands.

---

## 6. Internal-First Philosophy

Concretely, "we are the first customer" means the near-term roadmap should optimize for *your own* opportunity pipeline before any client-facing packaging:

- **Finding opportunities** — today the system only detects applications *you already sent*; it doesn't discover new postings/leads. An internal-first Research Engine would start by helping *you* find and qualify targets, not by re-skinning the existing scan for a second vertical.
- **Researching targets** — before generalizing `classify-application.js`'s "is this a job application" question, the more valuable internal win is "who is this org/contact, and is it worth pursuing" — a genuinely new capability, not a rename.
- **Prioritizing work** — `StatsCards` counts statuses today; a scoring/prioritization view (what should I act on next, across all opportunity types) is a natural Analytics Engine extension that pays for itself immediately in your own workflow.
- **Writing personalized outreach** — `generate-draft.js` already does this for job applications; generalizing its context-input shape (Section 8, Phase 3) benefits your own outreach the moment it ships, independent of any future client.
- **Tracking outcomes / learning from replies** — `classify-reply.js` + `email_events` already capture raw material; a Learning Engine that mines `groq_raw_response` history to improve future classification/draft quality is a compounding internal asset before it's ever a client feature.

---

## 7. Future Client Vision (structure only — no build proposed now)

The generalized entity model (opportunities/targets/contacts/organizations/campaigns) is what makes these services buildable later **without a rewrite**, provided Section 3's coupling is resolved first:

- **AI Revenue Intelligence** — Analytics Engine + Opportunity Engine over a `sales` opportunity type.
- **Outbound Campaign Management** — a `campaigns` grouping entity above `opportunities` (doesn't exist today — `applications` has no batch/campaign concept) + Outreach Engine multi-channel support.
- **Lead Research / Company Intelligence** — the net-new Research Engine, reusable across any opportunity type once built.
- **Opportunity Scoring** — Intelligence Engine generalized beyond binary "is this a job application" classification into a continuous/multi-factor score.
- **Meeting Preparation** — Research Engine + Personalization Engine composed together; genuinely new, but composable once both engines exist.

The key architectural precondition for all five is the same: a domain-agnostic `opportunities`/`targets`/`contacts` schema and engine interfaces that take a *domain config* rather than hardcoding job-application vocabulary. That precondition is what Phases 3–4 below deliver.

---

## 8. Technical Refactoring Roadmap

### Phase 1 — Minimal changes (unblock the current job-hunting product; no generalization yet)
- Build the missing `app/api/*` routes and `app/(auth)/login` + `/auth/callback` page — the frontend already expects these; this is finishing Phase 1's original scope, not new scope.
- Nothing renamed yet. Goal: get the existing single-vertical product actually running end-to-end, since right now it only runs in `NEXT_PUBLIC_DEV_PREVIEW` mode against a fake user.

### Phase 2 — Architecture improvements (still job-hunting-shaped, but cleaned up)
- Extract the `REPLY_TYPE_TO_STATUS` / `NOTIF_TYPE_MAP` / `DRAFT_TYPES` mapping objects (currently duplicated across `process-webhook.js` and `DraftPanel.jsx`) into one shared config module — the first step toward config-driven behavior instead of hardcoded branches.
- Introduce a `types/` (or JSDoc-typed) layer for the shapes Groq functions return, so downstream consumers don't parse ad hoc JSON contracts.
- Add a `contacts`/`organizations` normalization pass *without* changing the public shape of `applications` yet — i.e., `applications.recipient_email` becomes a FK to a new `contacts` row, additively.

### Phase 3 — Generalize job-specific logic (rename without breaking behavior)
- Rename the vocabulary, keep the mechanism: `applications` → `opportunities` (with a `type` discriminator column, initially always `'job'`), `company_name`/`role_title` → `organization_name`/`context_title`, `application_status` → a generic `opportunity_status` whose values are still job-shaped but now sit behind a per-`type` config rather than a hardcoded Postgres enum.
- Split the Groq prompt *content* (job-hunting framing) from the prompt *shape* (classify → structured fields; classify-reply → status mapping; generate-draft → context + scenario type). Prompt content becomes data (per opportunity type), not code.
- Rename routes/files accordingly (`/api/applications` → `/api/opportunities`, `classify-application.js` → `classify-signal.js`, etc.) — see Section 9 for the full naming table.

### Phase 4 — Introduce a reusable Opportunity Engine
- Formalize the six-engine module boundaries from Section 5 as actual `lib/<engine>/` packages with defined interfaces (e.g. `IntelligenceEngine.classify(signal, domainConfig)`, `PersonalizationEngine.draft(opportunity, contact, scenario, domainConfig)`).
- Opportunity type becomes a first-class config object (status enum values, draft scenario types, notification types, detection keywords/prompt) rather than being scattered across DB enums + JS constant objects in three files.
- Build the Research Engine and Learning Engine as new modules against this interface — they're additive, not refactors of existing code.

### Phase 5 — Support multiple opportunity domains
- Stand up a second opportunity type (sales or recruiting is the natural internal-first choice per Section 6) purely by adding a domain config + a second Gmail-search/detection strategy — no core schema or engine-interface changes, by construction of Phase 4.
- Add the `campaigns` grouping entity for multi-target outreach batches (needed for "Outbound Campaign Management" in Section 7).
- Multi-channel Outreach Engine support (beyond Gmail) becomes an additive channel adapter, not a rewrite of `process-webhook.js`'s matching logic — provided Phase 3's channel-agnostic contact/thread model is in place.

---

## 9. Naming Improvements

| Current | Proposed | Where |
|---|---|---|
| `applications` (table) | `opportunities` (+ `type` discriminator) | DB |
| `application_status` (enum) | `opportunity_status` (per-type config-driven) | DB |
| `company_name`, `role_title` | `organization_name`, `context_title` | DB / all consumers |
| `application_date` | `initiated_at` | DB |
| `ai_drafts` | `outreach_drafts` | DB |
| `draft_type` (enum) | `outreach_scenario` (per-type config-driven) | DB |
| `email_events` | `interaction_events` (+ `channel` column, currently implicit as "always Gmail") | DB |
| — (doesn't exist) | `contacts` | new table |
| — (doesn't exist) | `organizations` | new table |
| — (doesn't exist) | `campaigns` | new table (Phase 5) |
| — (doesn't exist) | `research_notes` / `signals` | new table (Research Engine) |
| `classify-application.js` | `classify-signal.js` | `lib/intelligence/` |
| `classify-reply.js` | `classify-response.js` | `lib/intelligence/` |
| `generate-draft.js` | `generate-outreach.js` | `lib/personalization/` |
| `scanSentMail()` | `discoverOpportunities()` | `lib/opportunity/` |
| `processWebhookEvent()` | `processInboundSignal()` | `lib/pipeline/` (or `lib/outreach/`) |
| `/api/applications` | `/api/opportunities` | routes (not yet built — free rename) |
| `/api/drafts` | `/api/outreach` | routes (not yet built) |
| `ApplicationsTable`, `ApplicationMeta` | `OpportunitiesTable`, `OpportunityMeta` | components |
| `DraftPanel`, `DraftEditor` | `OutreachPanel`, `OutreachEditor` | components |
| `StatusBadge`'s `STATUS_MAP` | domain-config-driven, not a hardcoded map | components |
| `follow_up_delay_days` | `stale_threshold_days` | DB / settings |

General principle applied above: **generic nouns replace job-specific ones (`Opportunity`, `Target`, `Contact`, `Organization`, `Campaign`, `Research`, `Insight`, `Signal`, `Strategy`, `Interaction`)**, and every rename is scoped to a phase where it's cheap (routes and API layer, since none exist yet, are free to name correctly from the start in Phase 1/3; DB renames wait for Phase 3 since they touch live schema).

---

## 10. Summary

Nothing in this document has been implemented. The existing codebase is a solid, correctly-sequenced reference implementation of one opportunity type (job applications) over one channel (Gmail) — strong on the mechanical backbone (OAuth lifecycle, incremental sync via `historyId` cursors, SSE-streamed scanning, realtime dashboard, MIME threading), incomplete on the HTTP layer (no `app/api/*` routes exist yet), and tightly coupled to job-hunting vocabulary in roughly six predictable places per concept (DB enum, pipeline mapping object, prompt text, UI constant, route name, table/column name). The roadmap above is sequenced so that Phase 1 finishes the job-hunting product as originally scoped, Phases 2–4 collapse that six-places-per-concept coupling into config-driven engine interfaces, and Phase 5 proves generalization by standing up a second opportunity domain without touching the core schema or engine contracts.
