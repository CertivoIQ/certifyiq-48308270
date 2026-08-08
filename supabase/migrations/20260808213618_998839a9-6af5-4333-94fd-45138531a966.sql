-- 1. Coverage status
create type public.coverage_status as enum ('federal_baseline','in_review','validated','suspended');

-- 2. Archived controlling sources
create table public.state_rule_sources (
  id uuid primary key default gen_random_uuid(),
  state_code text not null,
  program text not null,
  authority_name text not null,
  source_url text not null,
  source_sha256 text not null,
  published_at timestamptz,
  effective_from date not null,
  effective_to date,
  retrieved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state_code, program, source_sha256)
);
grant select on public.state_rule_sources to authenticated;
grant all on public.state_rule_sources to service_role;
alter table public.state_rule_sources enable row level security;
create policy "Staff can view rule sources" on public.state_rule_sources
  for select to authenticated using (public.has_role(auth.uid(), 'staff'));
create trigger t_state_rule_sources_updated before update on public.state_rule_sources
  for each row execute function public.touch_updated_at();

-- 3. Versioned state pack releases
create table public.state_rule_pack_releases (
  id uuid primary key default gen_random_uuid(),
  state_code text not null,
  version text not null,
  status public.coverage_status not null default 'in_review',
  effective_from date not null,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  validation_report_id uuid,
  validated_rule_count integer not null default 0,
  limitations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state_code, version)
);
grant select on public.state_rule_pack_releases to authenticated;
grant all on public.state_rule_pack_releases to service_role;
alter table public.state_rule_pack_releases enable row level security;
create policy "Signed-in users can view pack releases" on public.state_rule_pack_releases
  for select to authenticated using (true);
create trigger t_state_rule_pack_releases_updated before update on public.state_rule_pack_releases
  for each row execute function public.touch_updated_at();

-- A pack may only be marked validated with an approver, approval time and rules.
create or replace function public.validate_pack_release()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'validated' and (
       new.approved_by is null
    or new.approved_at is null
    or new.validation_report_id is null
    or new.validated_rule_count < 1
  ) then
    raise exception 'A validated state pack requires an approver, approval time, validation report and at least one rule.';
  end if;
  return new;
end;
$$;
create trigger t_state_rule_pack_releases_validate
  before insert or update on public.state_rule_pack_releases
  for each row execute function public.validate_pack_release();

-- 4. Immutable evidence manifests
create table public.evidence_manifests (
  id uuid primary key default gen_random_uuid(),
  review_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id text not null,
  property_id text,
  certification_id text,
  outcome text not null,
  engine_build text not null,
  manifest jsonb not null,
  manifest_sha256 text not null,
  created_at timestamptz not null default now(),
  unique (review_id, manifest_sha256)
);
grant select on public.evidence_manifests to authenticated;
grant all on public.evidence_manifests to service_role;
alter table public.evidence_manifests enable row level security;
create policy "Users can view own evidence manifests" on public.evidence_manifests
  for select to authenticated using (auth.uid() = user_id);
create policy "Staff can view all evidence manifests" on public.evidence_manifests
  for select to authenticated using (public.has_role(auth.uid(), 'staff'));

create or replace function public.block_manifest_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Evidence manifests are immutable.';
end;
$$;
create trigger t_evidence_manifests_immutable
  before update or delete on public.evidence_manifests
  for each row execute function public.block_manifest_mutation();

-- 5. PMS integration state (no credentials stored here)
create table public.pms_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text not null default 'not_configured',
  credential_secret_name text,
  last_successful_sync_at timestamptz,
  sync_cursor text,
  records_imported integer not null default 0,
  records_reconciled integer not null default 0,
  records_failed integer not null default 0,
  last_error text,
  entity_mappings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
grant select, insert, update on public.pms_connections to authenticated;
grant all on public.pms_connections to service_role;
alter table public.pms_connections enable row level security;
create policy "Users manage own PMS connections" on public.pms_connections
  for select to authenticated using (auth.uid() = user_id);
create policy "Users create own PMS connections" on public.pms_connections
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own PMS connections" on public.pms_connections
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Staff can view all PMS connections" on public.pms_connections
  for select to authenticated using (public.has_role(auth.uid(), 'staff'));
create trigger t_pms_connections_updated before update on public.pms_connections
  for each row execute function public.touch_updated_at();

revoke execute on function public.validate_pack_release() from public, anon, authenticated;
revoke execute on function public.block_manifest_mutation() from public, anon, authenticated;