-- Strengthen NSPIRE activation around HUD's current downloadable standards bundle.
-- The official HUD standards page currently lists 63 standards and exposes a ZIP bundle.

alter table public.pha_nspire_standard_releases
  add column if not exists bundle_url text,
  add column if not exists expected_standard_count integer check (expected_standard_count is null or expected_standard_count > 0),
  add column if not exists imported_standard_count integer not null default 0 check (imported_standard_count >= 0),
  add column if not exists imported_deficiency_count integer not null default 0 check (imported_deficiency_count >= 0),
  add column if not exists import_completed_at timestamptz;

create table if not exists public.pha_nspire_source_artifacts (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.pha_nspire_standard_releases(id) on delete cascade,
  artifact_name text not null,
  artifact_type text not null check (artifact_type in ('bundle_zip','standard_pdf','changelog_pdf','manifest')),
  source_url text not null,
  sha256 text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  import_status text not null default 'pending' check (import_status in ('pending','verified','parsed','blocked')),
  parsed_row_count integer not null default 0 check (parsed_row_count >= 0),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(release_id, artifact_name)
);

alter table public.pha_nspire_source_artifacts enable row level security;
grant select on public.pha_nspire_source_artifacts to authenticated;
grant all on public.pha_nspire_source_artifacts to service_role;
create policy "PHA users read NSPIRE source artifacts" on public.pha_nspire_source_artifacts for select to authenticated using (true);
create policy "Staff manage NSPIRE source artifacts" on public.pha_nspire_source_artifacts for all to authenticated using (public.has_role(auth.uid(),'staff')) with check (public.has_role(auth.uid(),'staff'));

create or replace function public.refresh_pha_nspire_release_counts(target_release_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare standard_count integer; deficiency_count integer;
begin
  if not public.has_role(auth.uid(),'staff') then raise exception 'Staff authority required to refresh NSPIRE release counts'; end if;
  select count(distinct standard_name),count(*) into standard_count,deficiency_count
    from public.pha_nspire_deficiency_standards where release_id=target_release_id;
  update public.pha_nspire_standard_releases
     set imported_standard_count=standard_count, imported_deficiency_count=deficiency_count,
         import_completed_at=case when deficiency_count>0 then coalesce(import_completed_at,now()) else null end,
         updated_at=now()
   where id=target_release_id;
end; $$;
grant execute on function public.refresh_pha_nspire_release_counts(uuid) to authenticated;

create or replace function public.activate_pha_nspire_standard_release(target_release_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.pha_nspire_standard_releases%rowtype; standard_count integer; deficiency_count integer; bundle_ok boolean;
begin
  if not public.has_role(auth.uid(),'staff') then raise exception 'Staff authority required to activate NSPIRE standards'; end if;
  select * into r from public.pha_nspire_standard_releases where id=target_release_id;
  if not found then raise exception 'NSPIRE standards release not found'; end if;
  if r.verified_by is null or r.verified_at is null or coalesce(trim(r.source_checksum),'')='' then raise exception 'NSPIRE release verification is incomplete'; end if;
  if r.expected_standard_count is null then raise exception 'NSPIRE release requires the expected HUD standard count before activation'; end if;
  if coalesce(trim(r.bundle_url),'')='' or (r.bundle_url not like 'https://www.hud.gov/%' and r.bundle_url not like 'https://hud.gov/%') then raise exception 'NSPIRE release requires an official HUD bundle URL'; end if;
  select count(distinct standard_name),count(*) into standard_count,deficiency_count from public.pha_nspire_deficiency_standards where release_id=r.id;
  if deficiency_count=0 then raise exception 'NSPIRE release cannot activate with an empty deficiency registry'; end if;
  if standard_count<>r.expected_standard_count then raise exception 'NSPIRE release standard count does not match the controlled HUD manifest'; end if;
  select exists(select 1 from public.pha_nspire_source_artifacts a where a.release_id=r.id and a.artifact_type='bundle_zip' and a.import_status='verified' and coalesce(trim(a.sha256),'')<>'') into bundle_ok;
  if not bundle_ok then raise exception 'Verified HUD NSPIRE bundle artifact and checksum are required before activation'; end if;
  if exists(select 1 from public.pha_nspire_deficiency_standards s where s.release_id=r.id and (coalesce(trim(s.standard_name),'')='' or coalesce(trim(s.deficiency_reference),'')='' or coalesce(trim(s.source_url),'')='')) then raise exception 'NSPIRE deficiency rows are incomplete'; end if;
  update public.pha_nspire_standard_releases set status='superseded' where status='current' and id<>r.id;
  update public.pha_nspire_deficiency_standards set source_status='superseded',active=false where source_status='current' and release_id is distinct from r.id;
  update public.pha_nspire_deficiency_standards set source_status='current',active=true,source_version=r.source_version,source_checksum=r.source_checksum,updated_at=now() where release_id=r.id;
  update public.pha_nspire_standard_releases set status='current',imported_standard_count=standard_count,imported_deficiency_count=deficiency_count,activated_at=now(),updated_at=now() where id=r.id;
end; $$;

do $$
declare rid uuid;
begin
  select id into rid from public.pha_nspire_standard_releases where release_key='HUD-NSPIRE-FINAL-STANDARDS';
  if rid is not null then
    update public.pha_nspire_standard_releases
       set bundle_url='https://www.hud.gov/sites/dfiles/PIH/documents/NSPIRE-Standards-ALL-STANDARDS.zip',
           expected_standard_count=63,
           source_version='HUD current NSPIRE standards bundle — controlled retrieval 2026-08-28',
           notes='Official HUD standards page lists 63 current standards and exposes the downloadable ZIP bundle. Activation remains blocked until the bundle checksum, parsed deficiency rows, count reconciliation, and independent verification are complete.',
           updated_at=now()
     where id=rid;
    insert into public.pha_nspire_source_artifacts(release_id,artifact_name,artifact_type,source_url,import_status)
    values(rid,'NSPIRE-Standards-ALL-STANDARDS.zip','bundle_zip','https://www.hud.gov/sites/dfiles/PIH/documents/NSPIRE-Standards-ALL-STANDARDS.zip','pending')
    on conflict (release_id,artifact_name) do update set source_url=excluded.source_url,updated_at=now();
  end if;
end $$;
