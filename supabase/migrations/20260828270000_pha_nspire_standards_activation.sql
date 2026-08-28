-- Controlled NSPIRE standards release activation. An empty registry can never be treated as active.

create table if not exists public.pha_nspire_standard_releases (
  id uuid primary key default gen_random_uuid(),
  release_key text not null unique,
  source_url text not null,
  source_version text not null,
  published_date date,
  source_checksum text,
  status text not null default 'pending' check (status in ('pending','current','superseded','blocked')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  activated_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pha_nspire_deficiency_standards
  add column if not exists release_id uuid references public.pha_nspire_standard_releases(id),
  add column if not exists source_checksum text;

alter table public.pha_nspire_standard_releases enable row level security;
grant select on public.pha_nspire_standard_releases to authenticated;
grant all on public.pha_nspire_standard_releases to service_role;

create policy "PHA users read NSPIRE standard releases" on public.pha_nspire_standard_releases
  for select to authenticated using (true);
create policy "Staff manage NSPIRE standard releases" on public.pha_nspire_standard_releases
  for all to authenticated using (public.has_role(auth.uid(),'staff')) with check (public.has_role(auth.uid(),'staff'));

create or replace function public.prepare_pha_nspire_standard_release()
returns trigger language plpgsql security invoker as $$
begin
  if new.status='current' then
    if new.verified_by is null or new.verified_at is null or coalesce(trim(new.source_checksum),'')='' then
      raise exception 'Current NSPIRE release requires checksum and verification record';
    end if;
    if new.source_url not like 'https://www.hud.gov/%' and new.source_url not like 'https://hud.gov/%' then
      raise exception 'Current NSPIRE release must use an official HUD source';
    end if;
    if not exists(select 1 from public.pha_nspire_deficiency_standards s where s.release_id=new.id) then
      raise exception 'NSPIRE release cannot activate with an empty deficiency registry';
    end if;
  end if;
  new.updated_at:=now();
  return new;
end; $$;
create trigger pha_nspire_standard_release_prepare
before insert or update on public.pha_nspire_standard_releases
for each row execute function public.prepare_pha_nspire_standard_release();

create or replace function public.activate_pha_nspire_standard_release(target_release_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.pha_nspire_standard_releases%rowtype; row_count integer;
begin
  if not public.has_role(auth.uid(),'staff') then raise exception 'Staff authority required to activate NSPIRE standards'; end if;
  select * into r from public.pha_nspire_standard_releases where id=target_release_id;
  if not found then raise exception 'NSPIRE standards release not found'; end if;
  if r.verified_by is null or r.verified_at is null or coalesce(trim(r.source_checksum),'')='' then raise exception 'NSPIRE release verification is incomplete'; end if;
  select count(*) into row_count from public.pha_nspire_deficiency_standards where release_id=r.id;
  if row_count=0 then raise exception 'NSPIRE release cannot activate with an empty deficiency registry'; end if;
  update public.pha_nspire_standard_releases set status='superseded' where status='current' and id<>r.id;
  update public.pha_nspire_deficiency_standards set source_status='superseded',active=false where source_status='current' and release_id is distinct from r.id;
  update public.pha_nspire_deficiency_standards set source_status='current',active=true,source_version=r.source_version,source_url=r.source_url,source_checksum=r.source_checksum,updated_at=now() where release_id=r.id;
  update public.pha_nspire_standard_releases set status='current',activated_at=now(),updated_at=now() where id=r.id;
end; $$;
grant execute on function public.activate_pha_nspire_standard_release(uuid) to authenticated;

insert into public.pha_nspire_standard_releases(release_key,source_url,source_version,published_date,status,notes)
values('HUD-NSPIRE-FINAL-STANDARDS','https://www.hud.gov/reac/nspire-standards','HUD NSPIRE Final Standards — June 22, 2023',date '2023-06-22','pending','Official HUD standards page reviewed 2026-08-28. Activation remains blocked until the complete deficiency dataset and source checksum are loaded and independently verified.')
on conflict (release_key) do update set source_url=excluded.source_url,source_version=excluded.source_version,published_date=excluded.published_date,notes=excluded.notes,updated_at=now();
