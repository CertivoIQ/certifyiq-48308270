-- Production compatibility bootstrap for the controlled NSPIRE registry.
--
-- Some production projects predate the wider PHA schema migration family. The
-- NSPIRE release-control migrations only require this registry table; creating
-- it independently lets production restore task visibility without activating
-- standards or inventing inspection/customer data. The canonical PHA migration
-- can later add inspection integration with ALTER TABLE ... IF NOT EXISTS.

create table if not exists public.pha_nspire_deficiency_standards (
  id uuid primary key default gen_random_uuid(),
  standard_name text not null,
  inspectable_area text not null check (inspectable_area in ('unit','inside','outside')),
  deficiency_reference text not null,
  deficiency_description text not null,
  severity text not null check (severity in ('life_threatening','severe','moderate','low')),
  correction_hours integer not null check (correction_hours > 0),
  hcv_correction_hours integer check (hcv_correction_hours is null or hcv_correction_hours > 0),
  hcv_pass_fail text not null check (hcv_pass_fail in ('pass','fail')),
  source_url text not null,
  source_version text not null,
  source_status text not null default 'pending_source'
    check (source_status in ('current','pending_source','superseded')),
  effective_from date not null,
  effective_to date,
  active boolean not null default false,
  source_checksum text,
  release_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (standard_name, inspectable_area, deficiency_reference, source_version)
);

alter table public.pha_nspire_deficiency_standards enable row level security;

grant select on public.pha_nspire_deficiency_standards to authenticated;
grant all on public.pha_nspire_deficiency_standards to service_role;

drop policy if exists "Authenticated users read NSPIRE deficiency standards"
  on public.pha_nspire_deficiency_standards;
create policy "Authenticated users read NSPIRE deficiency standards"
  on public.pha_nspire_deficiency_standards
  for select to authenticated using (true);

drop policy if exists "Staff manage NSPIRE deficiency standards"
  on public.pha_nspire_deficiency_standards;
create policy "Staff manage NSPIRE deficiency standards"
  on public.pha_nspire_deficiency_standards
  for all to authenticated
  using (public.has_role(auth.uid(), 'staff'))
  with check (public.has_role(auth.uid(), 'staff'));

create index if not exists pha_nspire_deficiency_release_idx
  on public.pha_nspire_deficiency_standards(release_id);
create index if not exists pha_nspire_deficiency_lookup_idx
  on public.pha_nspire_deficiency_standards(
    standard_name, inspectable_area, deficiency_reference, active, source_status
  );

comment on table public.pha_nspire_deficiency_standards is
  'Fail-closed controlled HUD NSPIRE registry. Rows remain inactive until independent release attestations complete.';
