-- ============================================================
-- MIGRATION 0002: Generalize job-application schema into a
-- domain-agnostic Opportunity model.
--
-- No production rows depend on the old names yet, so this is a
-- straight rename/restructure rather than a dual-write migration.
-- Status/scenario/notification vocabularies move from Postgres
-- ENUMs to app-validated TEXT columns so each opportunity `type`
-- can define its own vocabulary in lib/opportunity/domain-config.js
-- without a future schema migration.
-- ============================================================

-- ============================================================
-- NEW TABLE: organizations
-- ============================================================
create table public.organizations (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  domain      text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint organizations_user_name_key unique (user_id, name)
);

alter table public.organizations enable row level security;

create policy "users can crud own organizations"
  on public.organizations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.handle_updated_at();

-- ============================================================
-- NEW TABLE: contacts
-- ============================================================
create table public.contacts (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  organization_id  uuid references public.organizations(id) on delete set null,
  email            text,
  name             text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index contacts_user_email_key on public.contacts(user_id, email) where email is not null;
create index contacts_organization_idx on public.contacts(organization_id);

alter table public.contacts enable row level security;

create policy "users can crud own contacts"
  on public.contacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.handle_updated_at();

-- ============================================================
-- TABLE: applications -> opportunities
-- ============================================================
alter table public.applications rename to opportunities;

alter table public.opportunities
  add column type text not null default 'job',
  add column organization_id uuid references public.organizations(id) on delete set null,
  add column contact_id uuid references public.contacts(id) on delete set null,
  add column channel text not null default 'email';

alter table public.opportunities rename column company_name to organization_name;
alter table public.opportunities rename column role_title to context_title;
alter table public.opportunities rename column application_date to initiated_at;
alter table public.opportunities rename column gmail_thread_id to channel_thread_id;
alter table public.opportunities rename column gmail_message_id to channel_message_id;

-- status moves from a fixed ENUM to app-validated TEXT (see lib/opportunity/domain-config.js)
alter table public.opportunities alter column status drop default;
alter table public.opportunities alter column status type text using status::text;
drop type public.application_status;

alter table public.opportunities alter column type drop default;

alter table public.opportunities rename constraint applications_pkey to opportunities_pkey;
alter table public.opportunities rename constraint applications_user_thread_key to opportunities_user_thread_key;
alter index applications_user_id_idx rename to opportunities_user_id_idx;
alter index applications_status_idx rename to opportunities_status_idx;
alter index applications_follow_up_idx rename to opportunities_follow_up_idx;
create index opportunities_type_idx on public.opportunities(user_id, type);

alter policy "users can crud own applications" on public.opportunities
  rename to "users can crud own opportunities";

alter trigger applications_updated_at on public.opportunities rename to opportunities_updated_at;

-- ============================================================
-- TABLE: email_events -> interaction_events
-- ============================================================
alter table public.email_events rename to interaction_events;

alter table public.interaction_events
  add column channel text not null default 'email';

alter table public.interaction_events rename column application_id to opportunity_id;
alter table public.interaction_events rename column gmail_message_id to channel_message_id;
alter table public.interaction_events rename column gmail_thread_id to channel_thread_id;
alter table public.interaction_events rename column groq_reply_type to signal_type;
alter table public.interaction_events rename column groq_raw_response to signal_raw;

alter table public.interaction_events alter column direction type text using direction::text;
drop type public.email_direction;

alter table public.interaction_events rename constraint email_events_pkey to interaction_events_pkey;
alter table public.interaction_events rename constraint email_events_user_message_key to interaction_events_user_message_key;
alter index email_events_application_idx rename to interaction_events_opportunity_idx;
alter index email_events_thread_idx rename to interaction_events_thread_idx;

alter policy "users can crud own email events" on public.interaction_events
  rename to "users can crud own interaction events";

-- ============================================================
-- TABLE: ai_drafts -> outreach_drafts
-- ============================================================
alter table public.ai_drafts rename to outreach_drafts;

alter table public.outreach_drafts rename column application_id to opportunity_id;
alter table public.outreach_drafts rename column groq_model to ai_model;
alter table public.outreach_drafts rename column groq_prompt_tokens to ai_prompt_tokens;
alter table public.outreach_drafts rename column groq_completion_tokens to ai_completion_tokens;
alter table public.outreach_drafts rename column gmail_sent_message_id to channel_sent_message_id;

alter table public.outreach_drafts rename column draft_type to scenario;
alter table public.outreach_drafts alter column scenario type text using scenario::text;
drop type public.draft_type;

alter table public.outreach_drafts rename constraint ai_drafts_pkey to outreach_drafts_pkey;
alter index ai_drafts_application_idx rename to outreach_drafts_opportunity_idx;

alter policy "users can crud own drafts" on public.outreach_drafts
  rename to "users can crud own outreach drafts";

alter trigger ai_drafts_updated_at on public.outreach_drafts rename to outreach_drafts_updated_at;

-- ============================================================
-- TABLE: notifications — generalize application_id + type
-- ============================================================
alter table public.notifications rename column application_id to opportunity_id;

alter table public.notifications alter column type type text using type::text;
drop type public.notification_type;

-- ============================================================
-- TABLE: user_settings — generalize job-specific preference names
-- ============================================================
alter table public.user_settings rename column follow_up_delay_days to stale_threshold_days;
alter table public.user_settings rename column scan_lookback_days to detection_lookback_days;
alter table public.user_settings rename column initial_scan_completed to initial_discovery_completed;
alter table public.user_settings rename column initial_scan_started_at to initial_discovery_started_at;

-- ============================================================
-- Note: table renames (applications -> opportunities, etc.) are
-- tracked automatically by supabase_realtime since publications
-- follow table OIDs, not names — no publication changes needed.
-- ============================================================
