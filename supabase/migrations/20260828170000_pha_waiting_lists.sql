-- Controlled HCV and Public Housing waiting-list operations.
-- PBV is intentionally excluded until its program-specific waiting-list authority is separately activated.

create table if not exists public.pha_waiting_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  program_code text not null check (program_code in ('hcv','public_housing')),
  list_name text not null,
  geographic_scope text not null default 'agency',
  selection_method text not null check (selection_method in ('date_time','random')),
  policy_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
  status text not null default 'closed' check (status in ('open','closed','suspended')),
  opened_at timestamptz,
  closed_at timestamptz,
  source_status text not null default 'current' check (source_status in ('current','pending_source','superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pha_waiting_lists_active_scope_uidx on public.pha_waiting_lists(workspace_user_id, program_code, geographic_scope) where status in ('open','closed');

create table if not exists public.pha_waiting_list_preferences (
  id uuid primary key default gen_random_uuid(),
  waiting_list_id uuid not null references public.pha_waiting_lists(id) on delete cascade,
  preference_code text not null,
  preference_label text not null,
  priority integer not null check (priority >= 0),
  policy_rule_reference text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(waiting_list_id, preference_code)
);

create table if not exists public.pha_waiting_list_applicants (
  id uuid primary key default gen_random_uuid(),
  waiting_list_id uuid not null references public.pha_waiting_lists(id) on delete cascade,
  applicant_reference text not null,
  applicant_name text not null,
  family_unit_size integer not null check (family_unit_size > 0),
  application_received_at timestamptz not null,
  racial_ethnic_designation text,
  preference_codes text[] not null default '{}',
  preference_priority integer not null default 999999,
  preference_verified boolean not null default false,
  accessibility_features_required text,
  status text not null default 'active' check (status in ('active','selected','withdrawn','removed','admitted')),
  removal_reason text,
  reasonable_accommodation_review_required boolean not null default false,
  reinstated_from_applicant_id uuid references public.pha_waiting_list_applicants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(waiting_list_id, applicant_reference)
);

create table if not exists public.pha_waiting_list_selection_events (
  id uuid primary key default gen_random_uuid(),
  waiting_list_id uuid not null references public.pha_waiting_lists(id) on delete cascade,
  applicant_id uuid not null references public.pha_waiting_list_applicants(id),
  selected_by uuid not null references auth.users(id),
  selection_method text not null check (selection_method in ('date_time','random')),
  preference_priority integer not null,
  candidate_count integer not null,
  candidate_snapshot jsonb not null,
  policy_snapshot jsonb not null,
  selected_at timestamptz not null default now()
);

alter table public.pha_waiting_lists enable row level security;
alter table public.pha_waiting_list_preferences enable row level security;
alter table public.pha_waiting_list_applicants enable row level security;
alter table public.pha_waiting_list_selection_events enable row level security;
grant select,insert,update,delete on public.pha_waiting_lists, public.pha_waiting_list_preferences, public.pha_waiting_list_applicants to authenticated;
grant select on public.pha_waiting_list_selection_events to authenticated;
grant all on public.pha_waiting_lists, public.pha_waiting_list_preferences, public.pha_waiting_list_applicants, public.pha_waiting_list_selection_events to service_role;

create policy "PHA users read waiting lists" on public.pha_waiting_lists for select to authenticated using (public.pha_program_access(workspace_user_id, program_code, false));
create policy "PHA admins write waiting lists" on public.pha_waiting_lists for all to authenticated using (public.pha_program_access(workspace_user_id, program_code, true)) with check (public.pha_program_access(workspace_user_id, program_code, true));
create policy "PHA users read waiting preferences" on public.pha_waiting_list_preferences for select to authenticated using (exists (select 1 from public.pha_waiting_lists l where l.id=waiting_list_id and public.pha_program_access(l.workspace_user_id,l.program_code,false)));
create policy "PHA admins write waiting preferences" on public.pha_waiting_list_preferences for all to authenticated using (exists (select 1 from public.pha_waiting_lists l where l.id=waiting_list_id and public.pha_program_access(l.workspace_user_id,l.program_code,true))) with check (exists (select 1 from public.pha_waiting_lists l where l.id=waiting_list_id and public.pha_program_access(l.workspace_user_id,l.program_code,true)));
create policy "PHA users read waiting applicants" on public.pha_waiting_list_applicants for select to authenticated using (exists (select 1 from public.pha_waiting_lists l where l.id=waiting_list_id and public.pha_program_access(l.workspace_user_id,l.program_code,false)));
create policy "PHA admins write waiting applicants" on public.pha_waiting_list_applicants for all to authenticated using (exists (select 1 from public.pha_waiting_lists l where l.id=waiting_list_id and public.pha_program_access(l.workspace_user_id,l.program_code,true))) with check (exists (select 1 from public.pha_waiting_lists l where l.id=waiting_list_id and public.pha_program_access(l.workspace_user_id,l.program_code,true)));
create policy "PHA users read waiting selection audit" on public.pha_waiting_list_selection_events for select to authenticated using (exists (select 1 from public.pha_waiting_lists l where l.id=waiting_list_id and public.pha_program_access(l.workspace_user_id,l.program_code,false)));

create or replace function public.prepare_pha_waiting_list()
returns trigger language plpgsql security invoker as $$
declare overlay_row public.pha_notice_policy_overlays%rowtype; expected_policy text;
begin
  expected_policy := case when new.program_code='public_housing' then 'acop' else 'administrative_plan' end;
  select * into overlay_row from public.pha_notice_policy_overlays where id=new.policy_overlay_id and workspace_user_id=new.workspace_user_id and program_code=new.program_code and policy_type=expected_policy and active=true and validated=true;
  if not found then raise exception 'Validated current agency policy overlay is required for waiting-list operations'; end if;
  if new.source_status <> 'current' then raise exception 'Current controlled waiting-list authority is required'; end if;
  if new.status='open' and new.opened_at is null then new.opened_at:=now(); end if;
  if new.status='closed' and tg_op='UPDATE' and old.status='open' and new.closed_at is null then new.closed_at:=now(); end if;
  new.updated_at:=now(); return new;
end;
$$;
create trigger pha_waiting_list_prepare_before_write before insert or update on public.pha_waiting_lists for each row execute function public.prepare_pha_waiting_list();

create or replace function public.prepare_pha_waiting_list_applicant()
returns trigger language plpgsql security invoker as $$
declare list_row public.pha_waiting_lists%rowtype; derived_priority integer;
begin
  select * into list_row from public.pha_waiting_lists where id=new.waiting_list_id;
  if not found then raise exception 'Waiting list not found'; end if;
  if list_row.status <> 'open' and tg_op='INSERT' then raise exception 'Applicants can only be added to an open waiting list'; end if;
  if array_length(new.preference_codes,1) is null then new.preference_priority:=999999; new.preference_verified:=true;
  else
    select min(p.priority) into derived_priority from public.pha_waiting_list_preferences p where p.waiting_list_id=new.waiting_list_id and p.active=true and p.preference_code=any(new.preference_codes);
    if derived_priority is null then raise exception 'Applicant preference code is not an active controlled preference'; end if;
    new.preference_priority:=derived_priority;
  end if;
  if new.status='removed' and new.removal_reason is null then raise exception 'Waiting-list removal requires a documented reason'; end if;
  if new.reasonable_accommodation_review_required and new.status='removed' then raise exception 'Applicant cannot be removed while reasonable-accommodation review is required'; end if;
  new.updated_at:=now(); return new;
end;
$$;
create trigger pha_waiting_list_applicant_prepare_before_write before insert or update on public.pha_waiting_list_applicants for each row execute function public.prepare_pha_waiting_list_applicant();

create or replace function public.select_next_pha_waiting_list_applicant(target_waiting_list_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare list_row public.pha_waiting_lists%rowtype; overlay_row public.pha_notice_policy_overlays%rowtype; selected_row public.pha_waiting_list_applicants%rowtype; minimum_priority integer; candidates jsonb; candidate_total integer;
begin
  select * into list_row from public.pha_waiting_lists where id=target_waiting_list_id;
  if not found then raise exception 'Waiting list not found'; end if;
  if not public.pha_program_access(list_row.workspace_user_id,list_row.program_code,true) then raise exception 'Not authorized to select from this waiting list'; end if;
  if list_row.status <> 'closed' then raise exception 'Waiting list must be closed before selection to preserve the candidate pool'; end if;
  select * into overlay_row from public.pha_notice_policy_overlays where id=list_row.policy_overlay_id and active=true and validated=true;
  if not found then raise exception 'Validated agency admission policy is required before selection'; end if;
  select min(preference_priority) into minimum_priority from public.pha_waiting_list_applicants where waiting_list_id=target_waiting_list_id and status='active' and preference_verified=true;
  if minimum_priority is null then raise exception 'No verified active applicants are available for selection'; end if;
  select count(*), jsonb_agg(jsonb_build_object('applicant_id',id,'application_received_at',application_received_at,'preference_priority',preference_priority) order by application_received_at,id)
    into candidate_total,candidates from public.pha_waiting_list_applicants where waiting_list_id=target_waiting_list_id and status='active' and preference_verified=true and preference_priority=minimum_priority;
  if list_row.selection_method='date_time' then
    select * into selected_row from public.pha_waiting_list_applicants where waiting_list_id=target_waiting_list_id and status='active' and preference_verified=true and preference_priority=minimum_priority order by application_received_at,id limit 1 for update;
  else
    select * into selected_row from public.pha_waiting_list_applicants where waiting_list_id=target_waiting_list_id and status='active' and preference_verified=true and preference_priority=minimum_priority order by random() limit 1 for update;
  end if;
  update public.pha_waiting_list_applicants set status='selected',updated_at=now() where id=selected_row.id;
  insert into public.pha_waiting_list_selection_events(waiting_list_id,applicant_id,selected_by,selection_method,preference_priority,candidate_count,candidate_snapshot,policy_snapshot)
  values(list_row.id,selected_row.id,auth.uid(),list_row.selection_method,minimum_priority,candidate_total,candidates,jsonb_build_object('policy_overlay_id',overlay_row.id,'policy_version',overlay_row.policy_version,'source_reference',overlay_row.source_reference,'program_code',list_row.program_code));
  return selected_row.id;
end;
$$;
grant execute on function public.select_next_pha_waiting_list_applicant(uuid) to authenticated;
