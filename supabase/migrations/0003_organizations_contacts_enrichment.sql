-- ============================================================
-- MIGRATION 0003: Enrichment columns for organizations/contacts.
--
-- Additive only. These are manually-entered fields for now;
-- automated enrichment (website scraping, funding/hiring signals)
-- is a later Research Engine phase, not this one.
-- ============================================================

alter table public.organizations
  add column website  text,
  add column industry text,
  add column size     text,
  add column location text;

alter table public.contacts
  add column role          text,
  add column department    text,
  add column linkedin_url  text,
  add column phone         text;
