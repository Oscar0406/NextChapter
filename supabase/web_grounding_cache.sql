-- NextChapter shared cache for public Gemini Google Search grounding.
-- Run this in the Supabase SQL Editor after pathway_history.sql.
-- This table must store sanitized search context only, not full user inputs.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.web_grounding_cache (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  query_normalized text not null,
  query_terms text[] not null default '{}'::text[],
  intent_key text not null,
  career_family text not null,
  location_scope text not null default 'malaysia',
  country_scope text not null default 'malaysia',
  summary text,
  sources jsonb not null default '[]'::jsonb,
  should_use_for_planning boolean not null default true,
  provider text not null default 'freellmapi-google',
  hit_count integer not null default 0,
  last_used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists web_grounding_cache_unique_context_idx
  on public.web_grounding_cache (query_normalized, intent_key, location_scope, country_scope);

create index if not exists web_grounding_cache_expires_idx
  on public.web_grounding_cache (expires_at);

create index if not exists web_grounding_cache_intent_location_idx
  on public.web_grounding_cache (intent_key, country_scope, location_scope);

create index if not exists web_grounding_cache_query_trgm_idx
  on public.web_grounding_cache using gin (query_normalized gin_trgm_ops);

create index if not exists web_grounding_cache_terms_idx
  on public.web_grounding_cache using gin (query_terms);

alter table public.web_grounding_cache disable row level security;

create or replace function public.normalise_web_grounding_query(value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', ' ', 'g'), '[[:space:]]+', ' ', 'g'));
$$;

create or replace function public.intent_is_web_grounding_compatible(left_intent text, right_intent text)
returns boolean
language sql
immutable
as $$
  select
    left_intent = right_intent
    or (
      left_intent in ('ai_engineer', 'machine_learning_engineer')
      and right_intent in ('ai_engineer', 'machine_learning_engineer')
    );
$$;

create or replace function public.web_grounding_location_score(cache_location text, search_location text)
returns numeric
language sql
immutable
as $$
  select case
    when cache_location = search_location then 1.0
    when cache_location = 'malaysia' or search_location = 'malaysia' then 0.75
    else 0.25
  end;
$$;

create or replace function public.web_grounding_keyword_overlap(cache_terms text[], search_terms text[])
returns numeric
language sql
stable
as $$
  select case
    when cardinality(coalesce(search_terms, '{}'::text[])) = 0 then 0
    else (
      select count(distinct cache_term)::numeric
      from unnest(coalesce(cache_terms, '{}'::text[])) as cache_term
      where cache_term = any(coalesce(search_terms, '{}'::text[]))
    ) / greatest(cardinality(coalesce(search_terms, '{}'::text[])), 1)
  end;
$$;

create or replace function public.match_web_grounding_cache(
  p_search_query text,
  p_search_terms text[],
  p_intent_key text,
  p_career_family text,
  p_location_scope text,
  p_country_scope text,
  p_min_score numeric default 0.55,
  p_max_age_days integer default 7
)
returns table (
  id uuid,
  query text,
  intent_key text,
  summary text,
  sources jsonb,
  provider text,
  created_at timestamptz,
  expires_at timestamptz,
  score numeric
)
language plpgsql
stable
as $$
begin
  if p_intent_key is null or p_intent_key = 'unknown' then
    return;
  end if;

  return query
  with scored as (
    select
      c.id,
      c.query,
      c.intent_key,
      c.summary,
      c.sources,
      c.provider,
      c.created_at,
      c.expires_at,
      (
        (case when c.intent_key = p_intent_key then 1.0 else 0.85 end * 0.45)
        + (similarity(c.query_normalized, public.normalise_web_grounding_query(p_search_query)) * 0.25)
        + (public.web_grounding_keyword_overlap(c.query_terms, p_search_terms) * 0.20)
        + (public.web_grounding_location_score(c.location_scope, p_location_scope) * 0.10)
      )::numeric as score
    from public.web_grounding_cache c
    where c.should_use_for_planning = true
      and c.expires_at > now()
      and c.created_at >= now() - make_interval(days => greatest(p_max_age_days, 1))
      and c.country_scope = p_country_scope
      and public.intent_is_web_grounding_compatible(c.intent_key, p_intent_key)
  )
  select
    scored.id,
    scored.query,
    scored.intent_key,
    scored.summary,
    scored.sources,
    scored.provider,
    scored.created_at,
    scored.expires_at,
    scored.score
  from scored
  where scored.score >= p_min_score
  order by scored.score desc, scored.created_at desc
  limit 1;
end;
$$;

create or replace function public.mark_web_grounding_cache_hit(p_cache_id uuid)
returns void
language sql
security definer
as $$
  update public.web_grounding_cache
  set hit_count = hit_count + 1,
      last_used_at = now()
  where id = p_cache_id;
$$;

notify pgrst, 'reload schema';
