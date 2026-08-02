# AI Opportunity Intelligence Platform — Roadmap & Team Split

Status as of this document: **Phases 1-4 and 6 done. Phase 5 deliberately deferred (no data-source decision yet). Phases 7-8 not started.**

---

## 1. What this project is

Repositioning "Job Hunt Email Intelligence" (a single-purpose Gmail-to-job-tracker) into a generalized **AI Opportunity Intelligence Platform** — an opportunity can be a job, a sales lead, a partnership, etc. The data model, API, and UI are being rebuilt in phases so the app stays working and testable after every step instead of one giant rewrite.

Stack: Next.js 16 (App Router/Turbopack), Supabase (Postgres/Auth/Realtime/RLS), Groq (LLM), Gmail API, Tailwind 4 + shadcn, Framer Motion.

---

## 2. Full Roadmap

| # | Phase | Status |
|---|---|---|
| 1 | **Foundation** — design system (light/dark toggle, motion), full nav IA, Organizations + Contacts entities | ✅ Done |
| 2 | **Mission Control Dashboard** — AI daily briefing, priority ranking, funnel, follow-ups, replies, activity feed, quick actions | ✅ Done |
| 3 | **Opportunity Engine v2** — formal priority/score field, tabbed opportunity detail page | ✅ Done |
| 4 | **Real-Data Pages** — Interactions, Signals, Knowledge, Analytics (buildable with the existing schema, no new AI agent needed) | ✅ Done |
| 5 | **Research Engine** — org/contact intelligence gathering | ⏸ Deliberately deferred (no data-source decision yet) |
| 6 | **Campaigns** — sequence/step outreach model, email-only, drafts-not-auto-send | ✅ Done |
| 7 | **AI Workspace** — Cursor-style contextual AI chat (Knowledge base already exists to draw on) | ⬜ Not started |
| 8 | **Command palette + motion/polish pass** — cross-cutting, done last | ⬜ Not started |

---

## 3. What's Done So Far

### Phase 1 — Foundation
- Light/dark theme toggle (`next-themes`), Framer Motion baseline (page transitions, staggered list rows, animated sidebar active-indicator).
- Sidebar shows the full 12-section IA; sections not built yet are visibly marked "Soon" instead of dead links.
- **Organizations** and **Contacts** are real now: DB tables existed but were dormant — now have full CRUD API routes (`app/api/organizations`, `app/api/contacts`), list + detail pages, and Gmail scanning links `opportunities.organization_id` to a real organization row instead of just a text field.

### Phase 2 — Mission Control Dashboard
- `/dashboard` rebuilt around `components/dashboard/mission-control/`: AI-generated **Today's Briefing** (`lib/groq/generate-briefing.js`, strictly grounded in real data — never invents companies/events), **Quick Actions** (rescan Gmail inline), **Opportunity Funnel**, **Priority Opportunities** (interim heuristic in `lib/opportunity/priority.js`), **Upcoming Follow-ups**, **Recent Replies**, **Activity Feed**.
- Old `StatsCards` deleted (superseded by the funnel widget).

### Phase 3 — Opportunity Engine v2
- **Priority scoring engine** (`lib/opportunity/priority.js`): per-type status weight (from `domain-config`) + recency bonus + capped overdue bonus. Persisted to `opportunities.priority_score` / `priority_reason` (migration `0004`) at every write path — discovery scan, reply webhook, stale-follow-up cron, and manual `PATCH /api/opportunities/[id]` status edits.
- **Tabbed opportunity detail page** (`components/opportunity/OpportunityTabs.jsx`): Overview (meta + live priority meter), Thread (live Gmail), Timeline (stored `interaction_events`), Contacts, AI Drafts, Notes. Active tab mirrors to `?tab=` via `replaceState`; inactive panels stay mounted so unsaved draft/note edits survive a tab switch. Full keyboard tablist semantics (arrows/Home/End, roving tabindex).
- Only tabs with real data behind them were built — Research/Campaigns arrive with Phases 5-6 rather than shipping as stubs.
- Fixed: the detail page previously loaded its thread by `fetch`ing its own API route with an absolute URL, which forwards no auth cookies and would 401 in production. It now calls `fetchThread` directly; the route remains for client-side consumers.

### Phase 4 — Real-Data Pages
- Of the 7 sidebar sections still marked "Soon", 4 didn't actually need to stay that way — `interaction_events` and `opportunities`/`outreach_drafts` already had everything needed, no new AI agent or external data source required. The other 3 (Research, Campaigns, AI Workspace) genuinely do need those and stayed "Soon".
- **Interactions** (`/interactions`) — cross-opportunity timeline over stored `interaction_events`, reusing the same visual language as the opportunity detail page's Timeline tab.
- **Signals** (`/signals`) — same data, filtered to rows with a non-null `signal_type` (i.e. only AI-classified replies). Scoped explicitly as *your own detected reply signals*, not external market/hiring signals — that's a different, unbuilt capability.
- **Knowledge** (`/knowledge`) — a personal template/playbook/snippet library. New table (migration `0005`, `knowledge_items`), full CRUD API + card-grid UI. Doesn't hook into an AI agent's context yet — that wiring is Phase 7's job once AI Workspace exists.
- **Analytics** (`/analytics`) — real computed insights (`lib/analytics/compute-insights.js`, pure functions, no AI call): reply rate, avg. days-to-first-reply, priority score distribution, best day-of-week for replies, opportunities-over-time trend, AI draft usage. Every insight with a meaningful sample-size threshold (e.g. day-of-week needs ≥10 data points) renders a plain "not enough data yet" state below it instead of a misleading stat off a handful of rows — same trust discipline as the Phase 2 AI briefing.

**Current test/build state**: 26 suites / 115 tests passing, production build compiles clean (36 routes). Migration `0005` applied to the live Supabase project.

### Phase 5 — Research Engine (deferred)
Deliberately not started — Groq has no live web access, so this phase needs a real decision on an enrichment data source (external search API, structured company-data API, or LLM-knowledge-only with its accuracy tradeoffs) before any code gets written. Revisit once that's picked.

### Phase 6 — Campaigns
- **Schema** (migration `0006`): `campaigns`, `campaign_steps` (ordered, each with a `scenario` + `delay_days`), `campaign_enrollments` (tracks `current_step_index`/`status`/`next_step_due_at` per opportunity; a partial unique index allows re-enrollment after a campaign completes/cancels but never two active campaigns on one opportunity at once).
- **Execution, not auto-send**: `lib/campaigns/process-due-steps.js` finds due enrollments, generates an `outreach_drafts` row via the existing `generateOutreach()` (same call `/api/outreach` already makes) and a notification — it never sends. The user reviews/edits/sends through the existing AI Drafts tab, exactly like any other draft. This was a deliberate trust-discipline call, not a limitation: nothing acts on the user's behalf unseen.
- **Runs without Netlify**: exposed both as a `CRON_SECRET`-protected route (`/api/cron/process-campaign-steps`, same pattern as the other three cron routes — a Netlify Scheduled Function shim can wrap it later) *and* a session-authenticated route (`/api/campaigns/process-due`) wired to a "Process Due Campaign Steps" button in dashboard Quick Actions, so the whole phase is testable locally today.
- **UI**: `/campaigns` list + detail (name/description, ordered step editor, enrolled-opportunities list), a new **Campaign** tab on the opportunity detail page (enroll/pause/resume/cancel, shows step progress).

**Current test/build state**: 29 suites / 130 tests passing, production build compiles clean (46 routes). Migration `0006` applied to the live Supabase project.

---

## 4. Team Split

Two tracks, going forward from Phase 3:

### Track A — Backend + AI
**Owns**: `lib/groq/*`, `lib/gmail/*`, `lib/pipeline/*`, `lib/opportunity/*` (domain-config, priority/scoring logic), `app/api/cron/*`, `app/api/webhooks/*`, and all AI agent design (Research/Strategy/Writing/Learning/Analysis/Recommendation agents as they're introduced in Phases 5-7).

### Track B — Frontend + API + Data
**Owns**: `app/(app)/*` pages, `components/*`, the non-cron/webhook `app/api/*` route handlers (opportunities/organizations/contacts/outreach/notifications/dashboard), the Supabase data queries inside those pages/routes, and design-system/motion polish.

### Shared / needs coordination
- **DB migrations** (`supabase/migrations/*`) touch a live, shared database — whoever needs a new column/table drafts the SQL, the other reviews before it's applied. Don't apply migrations solo without a heads-up.
- **`lib/opportunity/domain-config.js`** is the contract boundary: Track A authors the vocab (statuses/scenarios/prompts), Track B consumes it in UI. Track B shouldn't hardcode status labels that already exist there.

### Phase-by-phase breakdown

| Phase | Track A (Backend + AI) | Track B (Frontend + API + Data) |
|---|---|---|
| **3. Opportunity Engine v2** | Replace the interim heuristic in `lib/opportunity/priority.js` with a real scoring engine | Tabbed detail page (Overview/Timeline/Contacts/AI/Notes); API routes to serve each tab; `priority_score`/`priority_reason` migration (draft together) |
| **4. Real-Data Pages** | — (no backend/AI work needed; all data already existed) | Interactions, Signals, Knowledge (+ `knowledge_items` migration), Analytics — pages, API routes, `lib/analytics/compute-insights.js` |
| **5. Research Engine** | Pick + integrate an enrichment data source; build the Research Agent | Research tab UI; API routes exposing research results; `research_notes` table |
| **6. Campaigns** *(done)* | Sequence/step execution logic — built solo while Track A was unreachable; scheduling logic lives in `lib/campaigns/process-due-steps.js`, flag for review | Campaign builder + sequence view UI; `campaigns`/`campaign_steps`/`campaign_enrollments` tables |
| **7. AI Workspace** | Contextual chat agent (assembles opportunity/org/research/knowledge context) | AI Workspace chat UI |
| **8. Command palette + polish** | Search index/API for palette queries across entities (if needed) | Command palette UI + keybindings; motion/visual polish pass across the whole app |

---

## 5. Open decisions (not yet made)
- **Phase 5 (Research Engine) data source**: Groq alone has no live web access — Research needs a real enrichment API (search/scraping) picked before that phase starts. Options considered: LLM-knowledge-only (free, but stale/unreliable), a real search API like Perplexity/Tavily/SerpAPI (live data, usage-based cost), or a structured company-data API like Clearbit/Apollo (most reliable for firmographics, priciest). Deliberately not picked yet.
- **Netlify deployment status**: unclear whether the site is actually live at a public URL yet — needed before Gmail Pub/Sub (real-time reply detection) can work at all. `GMAIL_PUBSUB_TOPIC`/`GMAIL_WEBHOOK_SECRET` are unset and no Pub/Sub topic has been created as of this writing; the `gmail_watches` table is confirmed empty (zero rows ever).
