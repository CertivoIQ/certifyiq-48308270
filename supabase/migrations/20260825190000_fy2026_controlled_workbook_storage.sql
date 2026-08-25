-- Batch 3B: private, approval-bound storage for FY2026 federal source workbooks.
-- Workbook rows remain non-authoritative until verified bytes, geography
-- evidence, and a separate human approval are all bound to one release.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'federal-source-workbooks',
  'federal-source-workbooks',
  false,
  5242880,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.operations_fy2026_workbook_releases (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null check (dataset_id in (
    'HUD_MTSP_LIMITS_FY2026',
    'HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18',
    'HUD_HOME_RENT_LIMITS_FY2026',
    'HUD_HOME_INCOME_LIMITS_FY2026',
    'HUD_HTF_INCOME_LIMITS_FY2026',
    'HUD_SECTION8_INCOME_LIMITS_FY2026',
    'USDA_RD_INCOME_LIMITS_FY2026'
  )),
  source_version_id uuid not null
    references public.operations_source_versions(id) on delete restrict,
  official_url text not null
    check (official_url ~ '^https://(www\.)?huduser\.gov/'),
  file_name text not null check (file_name ~ '^[A-Za-z0-9._-]+\.xlsx$'),
  storage_bucket text not null default 'federal-source-workbooks'
    check (storage_bucket = 'federal-source-workbooks'),
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size between 1 and 5242880),
  effective_date date not null,
  expected_record_count integer not null check (expected_record_count > 0),
  expected_crosswalk_count integer not null default 0
    check (expected_crosswalk_count >= 0),
  verified_crosswalk_count integer not null default 0
    check (verified_crosswalk_count >= 0),
  parser_build text,
  normalized_records_sha256 text
    check (normalized_records_sha256 is null
      or normalized_records_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'staged'
    check (status in ('staged','verified','approval_pending','approved','active','quarantined')),
  approval_id uuid references public.operations_approvals(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz,
  approved_at timestamptz,
  activated_at timestamptz,
  quarantine_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(dataset_id, sha256),
  check (storage_path =
    'fy2026/' || dataset_id || '/' || sha256 || '/' || file_name),
  check (status not in ('verified','approval_pending','approved','active')
    or (verified_at is not null
      and parser_build ~ '^fy2026-xlsx-parser-'
      and normalized_records_sha256 is not null)),
  check (status not in ('approved','active')
    or (approval_id is not null and approved_at is not null)),
  check (status <> 'active'
    or (activated_at is not null
      and verified_crosswalk_count = expected_crosswalk_count))
);

create table if not exists public.operations_fy2026_geography_crosswalk (
  release_id uuid not null
    references public.operations_fy2026_workbook_releases(id) on delete restrict,
  source_geography_id text not null check (source_geography_id ~ '^[0-9]{10}$'),
  target_geography_id text not null check (target_geography_id ~ '^[0-9]{10}$'),
  authority_source_version_id uuid not null
    references public.operations_source_versions(id) on delete restrict,
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  rationale text not null check (length(trim(rationale)) >= 12),
  created_at timestamptz not null default now(),
  primary key (release_id, source_geography_id),
  unique(release_id, target_geography_id),
  check (source_geography_id <> target_geography_id)
);

create unique index if not exists operations_fy2026_one_active_release_idx
  on public.operations_fy2026_workbook_releases(dataset_id)
  where status = 'active';
create index if not exists operations_fy2026_release_status_idx
  on public.operations_fy2026_workbook_releases(status, dataset_id, effective_date desc);

alter table public.operations_fy2026_workbook_releases enable row level security;
alter table public.operations_fy2026_geography_crosswalk enable row level security;

grant select on public.operations_fy2026_workbook_releases,
  public.operations_fy2026_geography_crosswalk to authenticated;
grant all on public.operations_fy2026_workbook_releases,
  public.operations_fy2026_geography_crosswalk to service_role;

create policy "staff read controlled workbook releases"
on public.operations_fy2026_workbook_releases for select to authenticated
using (public.has_role(auth.uid(), 'staff'::public.app_role));

create policy "staff read controlled geography crosswalk"
on public.operations_fy2026_geography_crosswalk for select to authenticated
using (public.has_role(auth.uid(), 'staff'::public.app_role));

-- No storage.objects policy is created for this bucket. Only the service role
-- can upload or read its objects; authenticated and anonymous clients cannot.

create or replace function public.validate_fy2026_workbook_release_transition()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  approval public.operations_approvals;
  crosswalk_rows integer;
  object_size bigint;
begin
  new.updated_at := now();

  if tg_op = 'INSERT' and new.status not in ('staged','quarantined') then
    raise exception 'new FY2026 workbook releases must begin staged';
  end if;
  if tg_op = 'UPDATE' and not (
    new.status = old.status
    or (old.status = 'staged' and new.status in ('verified','quarantined'))
    or (old.status = 'verified' and new.status in ('approval_pending','quarantined'))
    or (old.status = 'approval_pending' and new.status in ('approved','quarantined'))
    or (old.status = 'approved' and new.status in ('active','quarantined'))
    or (old.status = 'active' and new.status = 'quarantined')
  ) then
    raise exception 'invalid FY2026 workbook release transition';
  end if;

  if new.status in ('approved','active') then
    select * into approval
    from public.operations_approvals
    where id = new.approval_id;
    if approval.id is null
       or approval.status <> 'approved'
       or approval.action_type <> 'activate_fy2026_income_limit_workbook'
       or approval.requested_by = approval.decided_by
       or approval.expires_at <= now()
       or not (approval.action_snapshot @> jsonb_build_object(
         'release_id', new.id::text,
         'dataset_id', new.dataset_id,
         'sha256', new.sha256,
         'storage_path', new.storage_path,
         'normalized_records_sha256', new.normalized_records_sha256,
         'expected_record_count', new.expected_record_count,
         'expected_crosswalk_count', new.expected_crosswalk_count
       )) then
      raise exception 'bound two-person FY2026 activation approval required';
    end if;
    new.approved_at := coalesce(new.approved_at, approval.decided_at);
  end if;

  if new.status = 'active' then
    select count(*) into crosswalk_rows
    from public.operations_fy2026_geography_crosswalk
    where release_id = new.id;
    if crosswalk_rows <> new.expected_crosswalk_count
       or new.verified_crosswalk_count <> crosswalk_rows then
      raise exception 'controlled FY2026 geography crosswalk incomplete';
    end if;

    select case
      when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint
      else null
    end into object_size
    from storage.objects
    where bucket_id = new.storage_bucket and name = new.storage_path;
    if object_size is null or object_size <> new.byte_size then
      raise exception 'private FY2026 workbook object missing or size conflict';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_fy2026_workbook_release_transition
  on public.operations_fy2026_workbook_releases;
create trigger validate_fy2026_workbook_release_transition
before insert or update on public.operations_fy2026_workbook_releases
for each row execute function public.validate_fy2026_workbook_release_transition();

create or replace function public.prevent_verified_fy2026_crosswalk_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare release_status text;
begin
  select status into release_status
  from public.operations_fy2026_workbook_releases
  where id = coalesce(new.release_id, old.release_id);
  if release_status <> 'staged' then
    raise exception 'verified FY2026 geography evidence is immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists prevent_verified_fy2026_crosswalk_mutation
  on public.operations_fy2026_geography_crosswalk;
create trigger prevent_verified_fy2026_crosswalk_mutation
before insert or update or delete on public.operations_fy2026_geography_crosswalk
for each row execute function public.prevent_verified_fy2026_crosswalk_mutation();

revoke all on function public.validate_fy2026_workbook_release_transition() from public;
revoke all on function public.prevent_verified_fy2026_crosswalk_mutation() from public;

comment on table public.operations_fy2026_workbook_releases is
  'Private FY2026 federal workbook ledger. Active rows require verified bytes, complete crosswalk evidence, and a separate bound approval.';
comment on table public.operations_fy2026_geography_crosswalk is
  'Immutable, source-evidenced legacy-to-FY2026 HUD geography mappings.';

notify pgrst, 'reload schema';
