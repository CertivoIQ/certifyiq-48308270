-- Isolated CI only: minimum auth and Evidence Record surface for graph rehearsal.
create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean language sql stable as $$ select false; $$;
create table if not exists public.evidence_manifests (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  manifest_sha256 text not null
);
grant usage on schema public, auth to authenticated, anon, service_role;
