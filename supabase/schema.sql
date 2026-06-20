-- Surfboard Sniper — storage table
-- Run this once in the Supabase SQL editor (or any Postgres).
-- The unique listing_id is what makes the pipeline idempotent: the n8n insert
-- uses "resolution=ignore-duplicates", so re-scanning the same listing never
-- alerts you twice.

create table if not exists public.surfboard_listings (
  listing_id      text primary key,
  title           text,
  price           integer,
  url             text,
  image_url       text,
  brand           text,
  brand_alias     text,
  length_in       integer,
  volume_l        numeric,
  distance_km     integer,
  region          text,
  confidence      text,                 -- 'high' or 'review'
  unknowns        jsonb,                -- fields that couldn't be parsed
  status          text default 'new',   -- 'new' -> 'alerted'
  alerted_at      timestamptz,
  created_at      timestamptz default now()
);

-- Handy for a "what's new and unalerted" view.
create index if not exists surfboard_listings_status_idx
  on public.surfboard_listings (status, created_at desc);

-- This pipeline talks to the table with the service_role key from inside n8n,
-- so Row Level Security can stay ON with no public policies. Only add policies
-- if you build a public read-only frontend on top of it.
alter table public.surfboard_listings enable row level security;
