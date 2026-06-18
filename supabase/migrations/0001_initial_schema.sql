-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE: user_tokens
-- ============================================================
create table public.user_tokens (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  google_access_token  text not null,
  google_refresh_token text,
  token_expires_at     timestamptz not null,
  gmail_address        text,
  scopes               text[] not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint user_tokens_user_id_key unique (user_id)
);

alter table public.user_tokens enable row level security;

create policy "users can read own tokens"    on public.user_tokens for select using (auth.uid() = user_id);
create policy "users can insert own tokens"  on public.user_tokens for insert with check (auth.uid() = user_id);
create policy "users can update own tokens"  on public.user_tokens for update using (auth.uid() = user_id);
create policy "users can delete own tokens"  on public.user_tokens for delete using (auth.uid() = user_id);

-- ============================================================
-- TABLE: gmail_watches
-- ============================================================
create table public.gmail_watches (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  history_id  text not null,
  expiration  timestamptz not null,
  topic_name  text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint gmail_watches_user_id_key unique (user_id)
);

alter table public.gmail_watches enable row level security;

create policy "users can read own watches"   on public.gmail_watches for select using (auth.uid() = user_id);
create policy "users can insert own watches" on public.gmail_watches for insert with check (auth.uid() = user_id);
create policy "users can update own watches" on public.gmail_watches for update using (auth.uid() = user_id);

-- ============================================================
-- TABLE: applications
-- ============================================================
create type application_status as enum (
  'applied', 'replied', 'interview', 'offer',
  'rejected', 'ghosted', 'follow_up_due', 'withdrawn'
);

create table public.applications (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  gmail_thread_id   text not null,
  gmail_message_id  text not null,
  company_name      text not null,
  role_title        text,
  status            application_status not null default 'applied',
  application_date  date not null,
  last_activity_at  timestamptz,
  follow_up_due_at  timestamptz,
  recipient_email   text,
  subject           text,
  ai_confidence     numeric(4,3),
  raw_snippet       text,
  notes             text,
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint applications_user_thread_key unique (user_id, gmail_thread_id)
);

create index applications_user_id_idx   on public.applications(user_id);
create index applications_status_idx    on public.applications(user_id, status);
create index applications_follow_up_idx on public.applications(follow_up_due_at)
  where follow_up_due_at is not null;

alter table public.applications enable row level security;

create policy "users can crud own applications"
  on public.applications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- TABLE: email_events
-- ============================================================
create type email_direction as enum ('sent', 'received');

create table public.email_events (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  application_id    uuid references public.applications(id) on delete set null,
  gmail_message_id  text not null,
  gmail_thread_id   text not null,
  direction         email_direction not null,
  from_address      text,
  to_addresses      text[],
  subject           text,
  snippet           text,
  received_at       timestamptz not null,
  groq_reply_type   text,
  groq_raw_response jsonb,
  created_at        timestamptz not null default now(),
  constraint email_events_user_message_key unique (user_id, gmail_message_id)
);

create index email_events_application_idx on public.email_events(application_id);
create index email_events_thread_idx      on public.email_events(user_id, gmail_thread_id);

alter table public.email_events enable row level security;

create policy "users can crud own email events"
  on public.email_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- TABLE: ai_drafts
-- ============================================================
create type draft_type as enum (
  'follow_up', 'interview_confirm', 'info_response',
  'offer_accept', 'offer_decline', 'general_reply'
);

create table public.ai_drafts (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  application_id          uuid not null references public.applications(id) on delete cascade,
  draft_type              draft_type not null,
  subject                 text not null,
  body_markdown           text not null,
  body_edited             text,
  groq_model              text not null,
  groq_prompt_tokens      integer,
  groq_completion_tokens  integer,
  was_sent                boolean not null default false,
  sent_at                 timestamptz,
  gmail_sent_message_id   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index ai_drafts_application_idx on public.ai_drafts(application_id);

alter table public.ai_drafts enable row level security;

create policy "users can crud own drafts"
  on public.ai_drafts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- TABLE: notifications
-- ============================================================
create type notification_type as enum (
  'follow_up_reminder', 'reply_received', 'interview_detected',
  'offer_detected', 'rejection_detected', 'scan_complete', 'watch_expiring'
);

create table public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  application_id  uuid references public.applications(id) on delete cascade,
  type            notification_type not null,
  title           text not null,
  body            text,
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications(user_id, is_read, created_at desc)
  where is_read = false;

alter table public.notifications enable row level security;

create policy "users can read own notifications"   on public.notifications for select using (auth.uid() = user_id);
create policy "users can update own notifications" on public.notifications for update using (auth.uid() = user_id);

-- ============================================================
-- TABLE: user_settings
-- ============================================================
create table public.user_settings (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  follow_up_delay_days     integer not null default 7,
  email_digest_enabled     boolean not null default false,
  keyword_overrides        text[],
  onboarding_completed     boolean not null default false,
  initial_scan_completed   boolean not null default false,
  initial_scan_started_at  timestamptz,
  scan_lookback_days       integer not null default 90,
  updated_at               timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "users can crud own settings"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- FUNCTION + TRIGGERS: updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_tokens_updated_at  before update on public.user_tokens  for each row execute function public.handle_updated_at();
create trigger gmail_watches_updated_at before update on public.gmail_watches for each row execute function public.handle_updated_at();
create trigger applications_updated_at  before update on public.applications  for each row execute function public.handle_updated_at();
create trigger ai_drafts_updated_at     before update on public.ai_drafts     for each row execute function public.handle_updated_at();
create trigger user_settings_updated_at before update on public.user_settings for each row execute function public.handle_updated_at();

-- ============================================================
-- REALTIME: enable for live dashboard updates
-- ============================================================
alter publication supabase_realtime add table public.applications;
alter publication supabase_realtime add table public.notifications;
