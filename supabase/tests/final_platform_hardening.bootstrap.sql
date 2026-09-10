create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema storage;

create table public.customer_records (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  payload jsonb not null default '{}'::jsonb
);
alter table public.customer_records enable row level security;
grant all on public.customer_records to anon, authenticated;
grant all on public.customer_records to service_role;

create table storage.objects (
  id uuid primary key,
  owner_id uuid not null
);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated;
grant all on storage.objects to service_role;
