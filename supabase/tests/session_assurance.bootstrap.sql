-- Isolated CI only. Reuses the paid-license rehearsal auth users/roles.
create schema private;
grant usage on schema private to authenticated;
create or replace function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
$$;
create table auth.sessions (
 id uuid primary key, user_id uuid references auth.users(id),
 created_at timestamptz, updated_at timestamptz, not_after timestamptz
);
create table auth.mfa_factors (
 id uuid primary key, user_id uuid references auth.users(id), factor_type text,
 status text, created_at timestamptz, updated_at timestamptz
);
create schema storage;
create table storage.objects (id uuid primary key, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
create policy "Fixture owner" on storage.objects for all to authenticated
 using (owner=auth.uid()) with check (owner=auth.uid());
