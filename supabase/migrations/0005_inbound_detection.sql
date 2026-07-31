-- ============================================================
-- MIGRATION 0005: Two-sided detection + cross-thread identity.
--
-- Detection used to be sent-mail-only, so an "Easy Apply" on
-- LinkedIn/Indeed — or any ATS-submitted application (Greenhouse,
-- Lever, Workday, ...) — produced no sent email and therefore no
-- opportunity at all. Once inbound confirmations also create
-- opportunities, a single real-world application can surface across
-- several unrelated Gmail threads:
--
--   1. the board/ATS confirmation  ("Your application was sent to Acme")
--   2. an email you sent directly  (thread #2, different participants)
--   3. the recruiter's eventual reply (thread #3, yet another address)
--
-- `channel_thread_id` (unique per user) stays the *originating* thread
-- so existing upserts and the thread-lookup path keep working;
-- `channel_thread_ids` accumulates every thread that has been linked to
-- the opportunity, and is what inbound matching searches.
--
-- `dedup_key` is the normalized organization + role identity computed by
-- lib/opportunity/identity.js — the indexed fast path for "have we already
-- got this application?". It is deliberately NOT unique: applying twice to
-- the same role at the same company is legitimate, and a unique index here
-- would turn that into a failed write. Duplicate suppression is the app's
-- job (lib/opportunity/link.js), which also handles near-miss titles that
-- an exact key cannot ("Sr. Software Engineer" vs "Senior Software Engineer").
--
-- Existing rows are intentionally left with a NULL dedup_key: the value is
-- backfilled by the app the next time each row is written, and the matcher
-- falls back to a scan-and-fuzzy-match over recent rows, so NULL keys still
-- participate in deduplication.
-- ============================================================

-- `source_email` exists because `recipient_email` is the *reply target*:
-- app/api/gmail/send/route.js sends outreach to it. A board confirmation comes
-- from an unmonitored no-reply address, so writing that into recipient_email
-- would aim outreach at a black hole. Inbound-detected rows keep
-- recipient_email NULL until a real human replies (the webhook fills it in) and
-- record the confirmation sender here as provenance only.
alter table public.opportunities
  add column channel_thread_ids text[] not null default '{}',
  add column detection_source   text   not null default 'sent',
  add column dedup_key          text,
  add column source_email       text;

comment on column public.opportunities.channel_thread_ids is
  'Every channel thread linked to this opportunity, including channel_thread_id.';
comment on column public.opportunities.detection_source is
  'How the opportunity was first detected: ''sent'' (outgoing application) or ''inbound'' (board/ATS confirmation).';
comment on column public.opportunities.dedup_key is
  'Normalized organization+role identity from lib/opportunity/identity.js; used to link threads belonging to one application.';
comment on column public.opportunities.source_email is
  'Address the detecting email came from. Provenance only — never a send target; see recipient_email for that.';

update public.opportunities
   set channel_thread_ids = array[channel_thread_id]
 where channel_thread_id is not null
   and channel_thread_ids = '{}';

create index opportunities_thread_ids_idx on public.opportunities using gin (channel_thread_ids);

create index opportunities_dedup_idx on public.opportunities(user_id, type, dedup_key)
  where dedup_key is not null;
