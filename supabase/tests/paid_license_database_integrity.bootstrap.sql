-- Minimal Supabase-compatible PostgreSQL 17 bootstrap for the isolated CI
-- migration rehearsal. This is not a production schema substitute.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = pg_catalog
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

create table public.crm_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Synthetic account',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text,
  price_id text,
  status text not null default 'trialing',
  environment text not null default 'sandbox',
  access_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_access enable row level security;

create policy "users read own access"
on public.account_access for select to authenticated
using ((select auth.uid()) = user_id);

grant select on public.account_access to authenticated;

