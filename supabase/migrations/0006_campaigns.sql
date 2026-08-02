-- ============================================================
-- MIGRATION 0006: Campaigns — sequence/step outreach model.
--
-- A campaign is an ordered list of steps (scenario + delay). Enrolling an
-- opportunity in a campaign schedules its first step; a due-step processor
-- (app/api/cron/process-campaign-steps) generates an outreach_drafts row
-- for review when a step comes due — it never sends automatically.
-- ============================================================

create table public.campaigns (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create policy "users can crud own campaigns"
  on public.campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.handle_updated_at();

-- ============================================================
create table public.campaign_steps (
  id          uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  step_order  integer not null,
  label       text not null,
  scenario    text not null,
  delay_days  integer not null default 3,
  created_at  timestamptz not null default now(),
  constraint campaign_steps_order_key unique (campaign_id, step_order)
);

alter table public.campaign_steps enable row level security;

create policy "users can crud own campaign steps"
  on public.campaign_steps for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
create table public.campaign_enrollments (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  campaign_id        uuid not null references public.campaigns(id) on delete cascade,
  opportunity_id     uuid not null references public.opportunities(id) on delete cascade,
  current_step_index integer not null default 0,
  status             text not null default 'active', -- 'active' | 'completed' | 'paused' | 'cancelled'
  next_step_due_at   timestamptz,
  enrolled_at        timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Only one active campaign per opportunity at a time; re-enrollment after
-- completion/cancellation is fine, hence a partial index rather than a
-- plain unique constraint on opportunity_id.
create unique index campaign_enrollments_active_opportunity_key
  on public.campaign_enrollments(opportunity_id) where status = 'active';

create index campaign_enrollments_due_idx
  on public.campaign_enrollments(next_step_due_at) where status = 'active';

alter table public.campaign_enrollments enable row level security;

create policy "users can crud own campaign enrollments"
  on public.campaign_enrollments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger campaign_enrollments_updated_at before update on public.campaign_enrollments
  for each row execute function public.handle_updated_at();
