-- Versioned NSPIRE deficiency registry. Correction deadlines are derived from the controlled HUD standard, not guessed from severity.

create table if not exists public.pha_nspire_deficiency_standards (
  id uuid primary key default gen_random_uuid(),
  standard_name text not null,
  inspectable_area text not null check (inspectable_area in ('unit','inside','outside')),
  deficiency_reference text not null,
  deficiency_description text not null,
  severity text not null check (severity in ('life_threatening','severe','moderate','low')),
  correction_hours integer not null check (correction_hours > 0),
  hcv_correction_hours integer not null check (hcv_correction_hours > 0),
  hcv_pass_fail text not null check (hcv_pass_fail in ('pass','fail')),
  source_url text not null,
  source_version text not null,
  source_status text not null default 'pending_source' check (source_status in ('current','pending_source','superseded')),
  effective_from date not null,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(standard_name, inspectable_area, deficiency_reference, source_version)
);

alter table public.pha_nspire_deficiency_standards enable row level security;
grant select on public.pha_nspire_deficiency_standards to authenticated;
grant all on public.pha_nspire_deficiency_standards to service_role;
create policy "Authenticated users read NSPIRE deficiency standards" on public.pha_nspire_deficiency_standards for select to authenticated using (true);
create policy "Staff manage NSPIRE deficiency standards" on public.pha_nspire_deficiency_standards for all to authenticated using (public.has_role(auth.uid(),'staff')) with check (public.has_role(auth.uid(),'staff'));

alter table public.pha_inspection_deficiencies
  add column if not exists nspire_standard_id uuid references public.pha_nspire_deficiency_standards(id),
  add column if not exists correction_timeframe_hours integer,
  add column if not exists hcv_pass_fail text check (hcv_pass_fail in ('pass','fail')),
  add column if not exists source_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists mitigation_recorded_at timestamptz,
  add column if not exists permanent_repair_due_at timestamptz;

create or replace function public.prepare_pha_inspection_deficiency()
returns trigger language plpgsql security invoker as $$
declare
  inspection_row public.pha_inspections%rowtype;
  standard_row public.pha_nspire_deficiency_standards%rowtype;
  hours_to_correct integer;
begin
  select * into inspection_row from public.pha_inspections where id=new.inspection_id;
  if not found then raise exception 'Inspection not found for deficiency'; end if;

  if inspection_row.standard_used='nspire' then
    select * into standard_row from public.pha_nspire_deficiency_standards s
     where s.standard_name=new.standard_name
       and s.inspectable_area=new.inspectable_area
       and s.deficiency_reference=new.deficiency_reference
       and s.active=true and s.source_status='current'
       and s.effective_from <= coalesce(inspection_row.inspected_at::date,inspection_row.scheduled_for,current_date)
       and (s.effective_to is null or s.effective_to >= coalesce(inspection_row.inspected_at::date,inspection_row.scheduled_for,current_date))
     order by s.effective_from desc limit 1;
    if not found then raise exception 'Current controlled NSPIRE deficiency standard is required before recording this deficiency'; end if;
    new.nspire_standard_id:=standard_row.id;
    new.severity:=standard_row.severity;
    new.hcv_pass_fail:=standard_row.hcv_pass_fail;
    hours_to_correct:=case when inspection_row.program_code in ('hcv','pbv','mod_rehab') then standard_row.hcv_correction_hours else standard_row.correction_hours end;
    new.correction_timeframe_hours:=hours_to_correct;
    if new.correction_due_at is null then new.correction_due_at:=coalesce(inspection_row.inspected_at,now()) + make_interval(hours=>hours_to_correct); end if;
    new.source_snapshot:=jsonb_build_object('standard_id',standard_row.id,'source_url',standard_row.source_url,'source_version',standard_row.source_version,'severity',standard_row.severity,'correction_hours',hours_to_correct,'hcv_pass_fail',standard_row.hcv_pass_fail);
  else
    new.nspire_standard_id:=null;
    new.correction_timeframe_hours:=null;
    new.hcv_pass_fail:=null;
    new.source_snapshot:=jsonb_build_object('standard_used','hqs_previous');
  end if;

  if new.correction_verified and new.corrected_at is null then new.corrected_at:=now(); end if;
  new.updated_at:=now(); return new;
end;
$$;
drop trigger if exists pha_inspection_deficiency_prepare_before_write on public.pha_inspection_deficiencies;
create trigger pha_inspection_deficiency_prepare_before_write before insert or update on public.pha_inspection_deficiencies for each row execute function public.prepare_pha_inspection_deficiency();
