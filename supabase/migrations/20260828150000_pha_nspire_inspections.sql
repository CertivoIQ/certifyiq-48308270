-- PHA inspection and NSPIRE transition controls.
-- Voucher programs may continue HQS as previously defined through 2027-01-31,
-- while Public Housing remains on NSPIRE. Reinspections inherit the originating standard.

create table if not exists public.pha_inspection_transition_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null references auth.users(id) on delete cascade,
  program_code text not null check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  current_standard text not null check (current_standard in ('hqs_previous','nspire')),
  planned_nspire_date date,
  hud_notification_status text not null default 'not_recorded' check (hud_notification_status in ('not_recorded','planned','sent','confirmed')),
  hud_notified_at timestamptz,
  hud_confirmation_reference text,
  owner_family_notification_complete boolean not null default false,
  inspector_training_complete boolean not null default false,
  source_authority text not null default 'PIH 2026-18',
  source_status text not null default 'current' check (source_status in ('current','pending_source','superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_user_id, program_code),
  check (
    (program_code = 'public_housing' and current_standard = 'nspire')
    or program_code <> 'public_housing'
  ),
  check (
    program_code = 'public_housing'
    or planned_nspire_date is null
    or planned_nspire_date <= date '2027-02-01'
  )
);

create table if not exists public.pha_inspections (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  program_code text not null check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  family_action_id uuid references public.pha_family_actions(id) on delete set null,
  unit_reference text not null,
  inspection_type text not null check (inspection_type in ('initial','periodic','special','quality_control','reinspection')),
  parent_inspection_id uuid references public.pha_inspections(id) on delete set null,
  scheduled_for date,
  inspected_at timestamptz,
  standard_used text not null check (standard_used in ('hqs_previous','nspire')),
  result text not null default 'scheduled' check (result in ('scheduled','in_progress','pass','fail','cancelled')),
  inspector_name text,
  transition_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pha_inspection_deficiencies (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.pha_inspections(id) on delete cascade,
  inspectable_area text not null check (inspectable_area in ('unit','inside','outside')),
  standard_name text not null,
  deficiency_reference text,
  severity text check (severity in ('life_threatening','severe','moderate','low')),
  failed boolean not null default true,
  correction_due_at timestamptz,
  corrected_at timestamptz,
  correction_verified boolean not null default false,
  evidence_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pha_inspection_transition_profiles enable row level security;
alter table public.pha_inspections enable row level security;
alter table public.pha_inspection_deficiencies enable row level security;
grant select, insert, update, delete on public.pha_inspection_transition_profiles to authenticated;
grant select, insert, update, delete on public.pha_inspections to authenticated;
grant select, insert, update, delete on public.pha_inspection_deficiencies to authenticated;
grant all on public.pha_inspection_transition_profiles, public.pha_inspections, public.pha_inspection_deficiencies to service_role;

create policy "PHA users read inspection transition profiles" on public.pha_inspection_transition_profiles
for select to authenticated using (public.pha_program_access(workspace_user_id, program_code, false));
create policy "PHA admins manage inspection transition profiles" on public.pha_inspection_transition_profiles
for all to authenticated
using (
  public.is_pha_workspace_owner(workspace_user_id)
  or public.has_role(auth.uid(), 'staff')
  or exists (
    select 1 from public.pha_workspace_memberships m
    where m.workspace_user_id = pha_inspection_transition_profiles.workspace_user_id
      and m.member_user_id = auth.uid() and m.active = true
      and m.agency_role in ('agency_admin','compliance_admin')
  )
)
with check (
  public.is_pha_workspace_owner(workspace_user_id)
  or public.has_role(auth.uid(), 'staff')
  or exists (
    select 1 from public.pha_workspace_memberships m
    where m.workspace_user_id = pha_inspection_transition_profiles.workspace_user_id
      and m.member_user_id = auth.uid() and m.active = true
      and m.agency_role in ('agency_admin','compliance_admin')
  )
);

create policy "PHA users read inspections" on public.pha_inspections
for select to authenticated using (
  public.pha_program_access(workspace_user_id, program_code, false)
  or exists (
    select 1 from public.pha_workspace_memberships m
    where m.workspace_user_id = pha_inspections.workspace_user_id
      and m.member_user_id = auth.uid() and m.active = true and m.agency_role = 'inspection_staff'
  )
);
create policy "PHA inspection staff write inspections" on public.pha_inspections
for all to authenticated
using (
  public.pha_program_access(workspace_user_id, program_code, true)
  or exists (
    select 1 from public.pha_workspace_memberships m
    where m.workspace_user_id = pha_inspections.workspace_user_id
      and m.member_user_id = auth.uid() and m.active = true and m.agency_role = 'inspection_staff'
  )
)
with check (
  public.pha_program_access(workspace_user_id, program_code, true)
  or exists (
    select 1 from public.pha_workspace_memberships m
    where m.workspace_user_id = pha_inspections.workspace_user_id
      and m.member_user_id = auth.uid() and m.active = true and m.agency_role = 'inspection_staff'
  )
);

create policy "PHA users read inspection deficiencies" on public.pha_inspection_deficiencies
for select to authenticated using (
  exists (select 1 from public.pha_inspections i where i.id = inspection_id and (
    public.pha_program_access(i.workspace_user_id, i.program_code, false)
    or exists (select 1 from public.pha_workspace_memberships m where m.workspace_user_id = i.workspace_user_id and m.member_user_id = auth.uid() and m.active = true and m.agency_role = 'inspection_staff')
  ))
);
create policy "PHA inspection staff write deficiencies" on public.pha_inspection_deficiencies
for all to authenticated
using (
  exists (select 1 from public.pha_inspections i where i.id = inspection_id and (
    public.pha_program_access(i.workspace_user_id, i.program_code, true)
    or exists (select 1 from public.pha_workspace_memberships m where m.workspace_user_id = i.workspace_user_id and m.member_user_id = auth.uid() and m.active = true and m.agency_role = 'inspection_staff')
  ))
)
with check (
  exists (select 1 from public.pha_inspections i where i.id = inspection_id and (
    public.pha_program_access(i.workspace_user_id, i.program_code, true)
    or exists (select 1 from public.pha_workspace_memberships m where m.workspace_user_id = i.workspace_user_id and m.member_user_id = auth.uid() and m.active = true and m.agency_role = 'inspection_staff')
  ))
);

create or replace function public.prepare_pha_inspection_transition()
returns trigger language plpgsql security invoker as $$
begin
  if new.program_code = 'public_housing' then
    new.current_standard := 'nspire';
    new.planned_nspire_date := null;
  elsif new.current_standard = 'hqs_previous' and new.planned_nspire_date is null then
    raise exception 'Voucher programs remaining on previous HQS require a planned NSPIRE transition date';
  elsif new.planned_nspire_date > date '2027-02-01' then
    raise exception 'Voucher-program NSPIRE transition date cannot be later than February 1, 2027';
  end if;
  if new.hud_notification_status in ('sent','confirmed') and new.hud_notified_at is null then
    new.hud_notified_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger pha_inspection_transition_prepare_before_write
before insert or update on public.pha_inspection_transition_profiles
for each row execute function public.prepare_pha_inspection_transition();

create or replace function public.prepare_pha_inspection()
returns trigger language plpgsql security invoker as $$
declare profile_row public.pha_inspection_transition_profiles%rowtype; parent_row public.pha_inspections%rowtype; target_date date;
begin
  if new.inspection_type = 'reinspection' then
    if new.parent_inspection_id is null then raise exception 'Reinspection requires the originating inspection'; end if;
    select * into parent_row from public.pha_inspections where id = new.parent_inspection_id and workspace_user_id = new.workspace_user_id;
    if not found then raise exception 'Originating inspection not found'; end if;
    new.program_code := parent_row.program_code;
    new.unit_reference := parent_row.unit_reference;
    new.standard_used := parent_row.standard_used;
    new.transition_snapshot := parent_row.transition_snapshot || jsonb_build_object('reinspection_of', parent_row.id);
  else
    select * into profile_row from public.pha_inspection_transition_profiles where workspace_user_id = new.workspace_user_id and program_code = new.program_code;
    if not found then raise exception 'Inspection transition profile is required before scheduling an inspection'; end if;
    if profile_row.source_status <> 'current' then raise exception 'Current controlled inspection authority is required'; end if;
    target_date := coalesce(new.scheduled_for, new.inspected_at::date, current_date);
    if new.program_code = 'public_housing' then new.standard_used := 'nspire';
    elsif profile_row.current_standard = 'nspire' then new.standard_used := 'nspire';
    elsif target_date >= coalesce(profile_row.planned_nspire_date, date '2027-02-01') then new.standard_used := 'nspire';
    else new.standard_used := 'hqs_previous'; end if;
    new.transition_snapshot := jsonb_build_object(
      'source_authority', profile_row.source_authority,
      'source_status', profile_row.source_status,
      'planned_nspire_date', profile_row.planned_nspire_date,
      'hud_notification_status', profile_row.hud_notification_status,
      'owner_family_notification_complete', profile_row.owner_family_notification_complete,
      'inspector_training_complete', profile_row.inspector_training_complete,
      'standard_at_scheduling', new.standard_used
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger pha_inspection_prepare_before_write
before insert or update on public.pha_inspections
for each row execute function public.prepare_pha_inspection();

create or replace function public.sync_pha_inspection_result_from_deficiencies()
returns trigger language plpgsql security invoker as $$
declare target_id uuid; has_failed boolean;
begin
  target_id := case when tg_op = 'DELETE' then old.inspection_id else new.inspection_id end;
  select exists (select 1 from public.pha_inspection_deficiencies d where d.inspection_id = target_id and d.failed = true and d.correction_verified = false) into has_failed;
  update public.pha_inspections set result = case when has_failed then 'fail' else case when inspected_at is not null then 'pass' else result end end, updated_at = now() where id = target_id;
  return null;
end;
$$;
create trigger pha_inspection_deficiency_refresh_after_write
after insert or update or delete on public.pha_inspection_deficiencies
for each row execute function public.sync_pha_inspection_result_from_deficiencies();
