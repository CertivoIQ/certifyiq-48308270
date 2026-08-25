-- Separate fail-closed storage and release ledger for the official FY2026
-- USDA Rural Development MFH income-limit PDF. This does not weaken or alter
-- the XLSX-only HUD workbook trust boundary.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('federal-source-pdfs', 'federal-source-pdfs', false, 5242880, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.operations_fy2026_usda_rd_pdf_releases (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references public.operations_source_versions(id) on delete restrict,
  dataset_id text not null check (dataset_id = 'USDA_RD_INCOME_LIMITS_FY2026'),
  official_url text not null check (
    official_url = 'https://www.rd.usda.gov/media/file/download/rd-mfhlimitmap.pdf'
  ),
  file_name text not null check (file_name = 'rd-mfhlimitmap.pdf'),
  storage_bucket text not null default 'federal-source-pdfs'
    check (storage_bucket = 'federal-source-pdfs'),
  storage_path text not null,
  sha256 text not null check (
    sha256 = 'd3ee9999dd37075382216cf6cdb9dd702ad9113b526acf18849864c80e997e1f'
  ),
  byte_size bigint not null check (byte_size = 2215833),
  expected_page_count integer not null check (expected_page_count = 390),
  effective_date date not null check (effective_date = date '2026-07-13'),
  parser_build text,
  parsed_page_count integer,
  normalized_records_sha256 text check (
    normalized_records_sha256 is null or normalized_records_sha256 ~ '^[0-9a-f]{64}$'
  ),
  geography_coverage_sha256 text check (
    geography_coverage_sha256 is null or geography_coverage_sha256 ~ '^[0-9a-f]{64}$'
  ),
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
  check (storage_path = 'fy2026/' || dataset_id || '/' || sha256 || '/' || file_name),
  check (status not in ('verified','approval_pending','approved','active') or (
    verified_at is not null
    and parser_build ~ '^fy2026-usda-rd-pdf-parser-'
    and parsed_page_count = expected_page_count
    and normalized_records_sha256 is not null
    and geography_coverage_sha256 is not null
  )),
  check (status not in ('approved','active') or (approval_id is not null and approved_at is not null)),
  check (status <> 'active' or activated_at is not null)
);

create unique index if not exists operations_fy2026_usda_rd_one_active_idx
  on public.operations_fy2026_usda_rd_pdf_releases(dataset_id)
  where status = 'active';

alter table public.operations_fy2026_usda_rd_pdf_releases enable row level security;
grant select on public.operations_fy2026_usda_rd_pdf_releases to authenticated;
grant all on public.operations_fy2026_usda_rd_pdf_releases to service_role;

create policy "staff read controlled USDA RD PDF releases"
on public.operations_fy2026_usda_rd_pdf_releases for select to authenticated
using (public.has_role(auth.uid(), 'staff'::public.app_role));

-- No storage.objects policy is created. Only the service role can access bytes.

create or replace function public.validate_fy2026_usda_rd_pdf_release_transition()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  approval public.operations_approvals;
  object_size bigint;
begin
  new.updated_at := now();

  if tg_op = 'INSERT' and new.status not in ('staged','quarantined') then
    raise exception 'new USDA RD PDF releases must begin staged';
  end if;
  if tg_op = 'UPDATE' and not (
    new.status = old.status
    or (old.status = 'staged' and new.status in ('verified','quarantined'))
    or (old.status = 'verified' and new.status in ('approval_pending','quarantined'))
    or (old.status = 'approval_pending' and new.status in ('approved','quarantined'))
    or (old.status = 'approved' and new.status in ('active','quarantined'))
    or (old.status = 'active' and new.status = 'quarantined')
  ) then
    raise exception 'invalid USDA RD PDF release transition';
  end if;

  if new.status in ('approved','active') then
    select * into approval from public.operations_approvals where id = new.approval_id;
    if approval.id is null
       or approval.status <> 'approved'
       or approval.action_type <> 'activate_fy2026_usda_rd_pdf'
       or approval.requested_by = approval.decided_by
       or approval.expires_at <= now()
       or not (approval.action_snapshot @> jsonb_build_object(
         'release_id', new.id::text,
         'dataset_id', new.dataset_id,
         'sha256', new.sha256,
         'storage_path', new.storage_path,
         'normalized_records_sha256', new.normalized_records_sha256,
         'geography_coverage_sha256', new.geography_coverage_sha256,
         'expected_page_count', new.expected_page_count
       )) then
      raise exception 'bound two-person USDA RD PDF activation approval required';
    end if;
    new.approved_at := coalesce(new.approved_at, approval.decided_at);
  end if;

  if new.status = 'active' then
    select case when metadata->>'size' ~ '^[0-9]+$'
      then (metadata->>'size')::bigint else null end
    into object_size from storage.objects
    where bucket_id = new.storage_bucket and name = new.storage_path;
    if object_size is null or object_size <> new.byte_size then
      raise exception 'private USDA RD PDF object missing or size conflict';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_fy2026_usda_rd_pdf_release_transition
  on public.operations_fy2026_usda_rd_pdf_releases;
create trigger validate_fy2026_usda_rd_pdf_release_transition
before insert or update on public.operations_fy2026_usda_rd_pdf_releases
for each row execute function public.validate_fy2026_usda_rd_pdf_release_transition();

revoke all on function public.validate_fy2026_usda_rd_pdf_release_transition() from public;
comment on table public.operations_fy2026_usda_rd_pdf_releases is
  'Private, parser-bound FY2026 USDA RD PDF ledger requiring independent two-person activation approval.';
notify pgrst, 'reload schema';
