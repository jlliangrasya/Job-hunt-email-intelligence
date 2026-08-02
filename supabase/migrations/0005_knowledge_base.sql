-- ============================================================
-- MIGRATION 0005: Knowledge base (personal template/notes library).
--
-- Additive only. This is a plain CRUD table for now — it doesn't
-- hook into any AI agent's context yet; that wiring happens once
-- the AI Workspace phase exists and can draw on these items.
-- ============================================================

create table public.knowledge_items (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      text not null default 'template', -- 'template' | 'playbook' | 'snippet' | 'note'
  title         text not null,
  body_markdown text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index knowledge_items_user_idx on public.knowledge_items(user_id, category);

alter table public.knowledge_items enable row level security;

create policy "users can crud own knowledge items"
  on public.knowledge_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger knowledge_items_updated_at before update on public.knowledge_items
  for each row execute function public.handle_updated_at();
