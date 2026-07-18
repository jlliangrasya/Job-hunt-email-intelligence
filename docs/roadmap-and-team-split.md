# AI Opportunity Intelligence Platform — Roadmap & Team Split

Status as of this document: **Phases 1-2 done, Phases 3-8 not started.**

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
| 3 | **Opportunity Engine v2** — formal priority/score field, tabbed opportunity detail page | ⬜ Not started |
| 4 | **Research Engine** — org/contact intelligence gathering (needs an enrichment data-source decision) | ⬜ Not started |
| 5 | **Signals + Analytics** — live intelligence feed, generated-insight analytics | ⬜ Not started |
| 6 | **Campaigns + unified Interactions** — sequence/step outreach model, multi-channel-shaped | ⬜ Not started |
| 7 | **Knowledge base + AI Workspace** — Cursor-style contextual AI chat, template library | ⬜ Not started |
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

**Current test/build state**: 17 suites / 61 tests passing, production build compiles clean (25 routes).

---

## 4. Team Split

Two tracks, going forward from Phase 3:

### Track A — Backend + AI
**Owns**: `lib/groq/*`, `lib/gmail/*`, `lib/pipeline/*`, `lib/opportunity/*` (domain-config, priority/scoring logic), `app/api/cron/*`, `app/api/webhooks/*`, and all AI agent design (Research/Strategy/Writing/Learning/Analysis/Recommendation agents as they're introduced in Phases 4-7).

### Track B — Frontend + API + Data
**Owns**: `app/(app)/*` pages, `components/*`, the non-cron/webhook `app/api/*` route handlers (opportunities/organizations/contacts/outreach/notifications/dashboard), the Supabase data queries inside those pages/routes, and design-system/motion polish.

### Shared / needs coordination
- **DB migrations** (`supabase/migrations/*`) touch a live, shared database — whoever needs a new column/table drafts the SQL, the other reviews before it's applied. Don't apply migrations solo without a heads-up.
- **`lib/opportunity/domain-config.js`** is the contract boundary: Track A authors the vocab (statuses/scenarios/prompts), Track B consumes it in UI. Track B shouldn't hardcode status labels that already exist there.

### Phase-by-phase breakdown

| Phase | Track A (Backend + AI) | Track B (Frontend + API + Data) |
|---|---|---|
| **3. Opportunity Engine v2** | Replace the interim heuristic in `lib/opportunity/priority.js` with a real scoring engine | Tabbed detail page (Overview/Research/Timeline/Contacts/Campaigns/Interactions/AI/Notes); API routes to serve each tab; `priority_score`/`priority_reason` migration (draft together) |
| **4. Research Engine** | Pick + integrate an enrichment data source; build the Research Agent | Research tab UI; API routes exposing research results; `research_notes` table |
| **5. Signals + Analytics** | Signals ingestion logic; Groq-based insight generation (not generic charts) | Signals feed UI; Analytics page; `signals`/`insights` tables |
| **6. Campaigns + Interactions** | Sequence/step execution logic; channel-adapter interface | Campaign builder + sequence view UI; unified Interactions timeline; `campaigns`/`campaign_steps` tables |
| **7. Knowledge + AI Workspace** | Contextual chat agent (assembles opportunity/org/research/campaign context); prompt/template storage logic | Knowledge base UI (templates/playbooks CRUD); AI Workspace chat UI; `knowledge_items` table |
| **8. Command palette + polish** | Search index/API for palette queries across entities (if needed) | Command palette UI + keybindings; motion/visual polish pass across the whole app |

---

## 5. Open decisions (not yet made)
- **Phase 4 data source**: Groq alone has no live web access — Research needs a real enrichment API (search/scraping) picked before that phase starts.
- **Product rename**: still called "Job Hunt Intel" in the UI — cosmetic, not blocking, whenever the team wants to decide on a name.
