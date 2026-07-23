-- ============================================================
-- MIGRATION 0004: Persisted priority scoring engine.
--
-- Phase 3 replaces the client-side-only priority heuristic with a
-- stored, per-type-configurable score computed in
-- lib/opportunity/priority.js and written at every status-changing
-- write path (discovery, reply webhook, stale follow-up cron).
-- Storing it lets future consumers (digests, agents, SQL views)
-- sort by priority without recomputing in JS on every read.
-- ============================================================

alter table public.opportunities
  add column priority_score  numeric(6,2) not null default 0,
  add column priority_reason text;

create index opportunities_priority_idx on public.opportunities(user_id, priority_score desc);
