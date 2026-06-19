-- NextChapter history table for the current no-login MVP.
-- Run this in a fresh Supabase project's SQL Editor.
-- The app stores anonymous browser history by session_id.

create extension if not exists pgcrypto;

drop table if exists public.pathway_history;

create table public.pathway_history (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  current_condition text not null,
  dream text not null,
  pathways jsonb not null,
  title text,
  created_at timestamptz not null default now()
);

create index pathway_history_session_created_idx
  on public.pathway_history (session_id, created_at desc);

alter table public.pathway_history disable row level security;

notify pgrst, 'reload schema';
