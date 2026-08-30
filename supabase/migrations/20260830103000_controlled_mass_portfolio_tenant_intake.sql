-- Client-controlled mass property/unit/tenant intake and opt-in certification review queue.

create table if not exists public.portfolio_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null check (char_length(trim(external_id)) between 1 and 120),
  name text not null check (char_length(trim(name)) between 1 and 240),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  address_line1 text,
  city text,
  postal_code text,
  latest_import_job_id uuid references public.certification_import_jobs(id) on delete set null,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, external_id)
);

create table if not exists public.portfolio_units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.portfolio_properties(id) on delete cascade,
  external_id text not null check (char_length(trim(external_id)) between 1 and 120),
  unit_number text not null check (char_length(trim(unit_number)) between 1 and 80),
  bedrooms integer check (bedrooms is null or bedrooms between 0 and 20),
  latest_import_job_id uuid references public.certification_import_jobs(id) on delete set null,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, property_id, external_id)
);

create table if not exists public.portfolio_tenant_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.portfolio_properties(id) on delete cascade,
  unit_id uuid not null references public.portfolio_units(id) on delete restrict,
  external_id text not null check (char_length(trim(external_id)) between 1 and 160),
  household_name text not null check (char_length(trim(household_name)) between 1 and 240),
  move_in_date date,
  certification_type text check (certification_type is null or certification_type in ('INITIAL','ANNUAL','INTERIM')),
  certification_effective_date date,
  program_codes text[] not null default '{}'::text[],
  latest_import_job_id uuid references public.certification_import_jobs(id) on delete set null,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, external_id)
);

alter table public.certification_import_jobs
  add column if not exists intake_type text not null default 'certification_documents',
  add column if not exists parsed_property_count integer not null default 0,
  add column if not exists parsed_unit_count integer not null default 0,
  add column if not exists parsed_tenant_count integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.certification_import_jobs'::regclass and conname='certification_import_jobs_intake_type_check') then
    alter table public.certification_import_jobs add constraint certification_import_jobs_intake_type_check
      check (intake_type in ('certification_documents','portfolio_tenant_intake'));
  end if;
end $$;

alter table public.certification_import_items
  add column if not exists property_id uuid references public.portfolio_properties(id) on delete set null,
  add column if not exists unit_id uuid references public.portfolio_units(id) on delete set null,
  add column if not exists tenant_profile_id uuid references public.portfolio_tenant_profiles(id) on delete set null,
  add column if not exists upload_sequence integer,
  add column if not exists certification_type text,
  add column if not exists jurisdiction text,
  add column if not exists program_codes text[] not null default '{}'::text[],
  add column if not exists review_queue_status text not null default 'not_queued',
  add column if not exists review_order bigint,
  add column if not exists queued_for_review_at timestamptz,
  add column if not exists review_started_at timestamptz,
  add column if not exists review_finished_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.certification_import_items'::regclass and conname='certification_import_items_upload_sequence_check') then
    alter table public.certification_import_items add constraint certification_import_items_upload_sequence_check check (upload_sequence is null or upload_sequence >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.certification_import_items'::regclass and conname='certification_import_items_certification_type_check') then
    alter table public.certification_import_items add constraint certification_import_items_certification_type_check check (certification_type is null or certification_type in ('INITIAL','ANNUAL','INTERIM'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.certification_import_items'::regclass and conname='certification_import_items_jurisdiction_check') then
    alter table public.certification_import_items add constraint certification_import_items_jurisdiction_check check (jurisdiction is null or jurisdiction ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.certification_import_items'::regclass and conname='certification_import_items_review_queue_status_check') then
    alter table public.certification_import_items add constraint certification_import_items_review_queue_status_check check (review_queue_status in ('not_queued','queued','processing','completed','failed'));
  end if;
end $$;

create table if not exists public.portfolio_tenant_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_profile_id uuid not null references public.portfolio_tenant_profiles(id) on delete cascade,
  certification_import_item_id uuid unique references public.certification_import_items(id) on delete set null,
  storage_path text not null,
  original_file_name text not null,
  document_category text not null default 'certification_support',
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, tenant_profile_id, storage_path)
);

create index if not exists portfolio_properties_user_idx on public.portfolio_properties(user_id, created_at desc);
create index if not exists portfolio_units_property_idx on public.portfolio_units(user_id, property_id, unit_number);
create index if not exists portfolio_tenant_profiles_unit_idx on public.portfolio_tenant_profiles(user_id, unit_id, household_name);
create index if not exists portfolio_tenant_documents_tenant_idx on public.portfolio_tenant_documents(user_id, tenant_profile_id, created_at desc);
create index if not exists certification_import_items_review_queue_idx on public.certification_import_items(user_id, review_queue_status, queued_for_review_at, review_order);
create unique index if not exists certification_import_items_job_sequence_uidx on public.certification_import_items(job_id, upload_sequence) where upload_sequence is not null;

alter table public.portfolio_properties enable row level security;
alter table public.portfolio_units enable row level security;
alter table public.portfolio_tenant_profiles enable row level security;
alter table public.portfolio_tenant_documents enable row level security;

revoke all on public.portfolio_properties, public.portfolio_units, public.portfolio_tenant_profiles, public.portfolio_tenant_documents from anon;
grant select, insert, update, delete on public.portfolio_properties, public.portfolio_units, public.portfolio_tenant_profiles, public.portfolio_tenant_documents to authenticated;
grant all on public.portfolio_properties, public.portfolio_units, public.portfolio_tenant_profiles, public.portfolio_tenant_documents to service_role;

drop policy if exists "users manage own portfolio properties" on public.portfolio_properties;
create policy "users manage own portfolio properties" on public.portfolio_properties for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "users manage own portfolio units" on public.portfolio_units;
create policy "users manage own portfolio units" on public.portfolio_units for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.portfolio_properties p where p.id=portfolio_units.property_id and p.user_id=(select auth.uid())
));

drop policy if exists "users manage own tenant profiles" on public.portfolio_tenant_profiles;
create policy "users manage own tenant profiles" on public.portfolio_tenant_profiles for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.portfolio_units u where u.id=portfolio_tenant_profiles.unit_id and u.property_id=portfolio_tenant_profiles.property_id and u.user_id=(select auth.uid())
));

drop policy if exists "users manage own tenant documents" on public.portfolio_tenant_documents;
create policy "users manage own tenant documents" on public.portfolio_tenant_documents for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.portfolio_tenant_profiles t where t.id=portfolio_tenant_documents.tenant_profile_id and t.user_id=(select auth.uid())
));

drop trigger if exists t_portfolio_properties_updated on public.portfolio_properties;
create trigger t_portfolio_properties_updated before update on public.portfolio_properties for each row execute function public.touch_updated_at();
drop trigger if exists t_portfolio_units_updated on public.portfolio_units;
create trigger t_portfolio_units_updated before update on public.portfolio_units for each row execute function public.touch_updated_at();
drop trigger if exists t_portfolio_tenant_profiles_updated on public.portfolio_tenant_profiles;
create trigger t_portfolio_tenant_profiles_updated before update on public.portfolio_tenant_profiles for each row execute function public.touch_updated_at();

comment on column public.certification_import_items.review_queue_status is 'Explicit client-controlled review queue state; upload never queues review automatically.';