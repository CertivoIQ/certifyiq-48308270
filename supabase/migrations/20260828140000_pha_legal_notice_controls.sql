-- Controlled legal-notice authority for PHA family determinations.
-- Federal profiles are versioned separately from agency Administrative Plan/ACOP overlays.
-- Issuance fails closed when a required profile or local policy overlay is unresolved.

create table if not exists public.pha_notice_requirement_profiles (
  id uuid primary key default gen_random_uuid(),
  program_code text not null check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  action_type text not null check (action_type in ('admission','annual_reexamination','interim_reexamination','portability','other')),
  determination_outcome text not null check (determination_outcome in ('approval','denial','change','termination')),
  authority_code text not null,
  authority_url text not null,
  source_status text not null default 'current' check (source_status in ('current','pending_source','superseded')),
  required_elements jsonb not null default '[]'::jsonb,
  rights_snapshot jsonb not null default '{}'::jsonb,
  federal_timing_rule jsonb not null default '{}'::jsonb,
  requires_local_policy_overlay boolean not null default true,
  active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_code, action_type, determination_outcome, effective_from)
);

create table if not exists public.pha_notice_policy_overlays (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null references auth.users(id) on delete cascade,
  program_code text not null check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  policy_type text not null check (policy_type in ('administrative_plan','acop','mod_rehab_policy')),
  policy_version text not null,
  source_reference text not null,
  effective_date date not null,
  hearing_request_deadline_rule jsonb not null default '{}'::jsonb,
  delivery_requirements jsonb not null default '{}'::jsonb,
  language_access_requirements jsonb not null default '{}'::jsonb,
  accessibility_requirements jsonb not null default '{}'::jsonb,
  validated boolean not null default false,
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_user_id, program_code, policy_type, policy_version)
);

alter table public.pha_notice_requirement_profiles enable row level security;
alter table public.pha_notice_policy_overlays enable row level security;
grant select on public.pha_notice_requirement_profiles to authenticated;
grant all on public.pha_notice_requirement_profiles to service_role;
grant select, insert, update, delete on public.pha_notice_policy_overlays to authenticated;
grant all on public.pha_notice_policy_overlays to service_role;

create policy "Authenticated users read PHA legal notice profiles" on public.pha_notice_requirement_profiles
for select to authenticated using (true);
create policy "Staff manage PHA legal notice profiles" on public.pha_notice_requirement_profiles
for all to authenticated using (public.has_role(auth.uid(), 'staff')) with check (public.has_role(auth.uid(), 'staff'));

create policy "PHA users read agency notice policy overlays" on public.pha_notice_policy_overlays
for select to authenticated using (public.pha_program_access(workspace_user_id, program_code, false));
create policy "PHA admins manage agency notice policy overlays" on public.pha_notice_policy_overlays
for all to authenticated
using (
  public.is_pha_workspace_owner(workspace_user_id)
  or public.has_role(auth.uid(), 'staff')
  or exists (
    select 1 from public.pha_workspace_memberships m
    where m.workspace_user_id = pha_notice_policy_overlays.workspace_user_id
      and m.member_user_id = auth.uid() and m.active = true
      and m.agency_role in ('agency_admin','compliance_admin')
  )
)
with check (
  public.is_pha_workspace_owner(workspace_user_id)
  or public.has_role(auth.uid(), 'staff')
  or exists (
    select 1 from public.pha_workspace_memberships m
    where m.workspace_user_id = pha_notice_policy_overlays.workspace_user_id
      and m.member_user_id = auth.uid() and m.active = true
      and m.agency_role in ('agency_admin','compliance_admin')
  )
);

alter table public.pha_family_notices
  add column if not exists determination_outcome text check (determination_outcome in ('approval','denial','change','termination')),
  add column if not exists legal_profile_id uuid references public.pha_notice_requirement_profiles(id),
  add column if not exists legal_requirements_validated boolean not null default false,
  add column if not exists local_policy_overlay_status text not null default 'unresolved' check (local_policy_overlay_status in ('not_required','validated','unresolved')),
  add column if not exists legal_notice_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists response_deadline_at timestamptz;

-- Current federal baseline profiles. Local deadlines/process details remain agency-policy overlays unless federal law supplies the timing.
insert into public.pha_notice_requirement_profiles
(program_code, action_type, determination_outcome, authority_code, authority_url, source_status, required_elements, rights_snapshot, federal_timing_rule, requires_local_policy_overlay, effective_from)
values
('hcv','admission','denial','24 CFR 982.554','https://www.ecfr.gov/current/title-24/section-982.554','current','["brief reasons for denial","right to request informal review","how to obtain informal review"]','{"process":"informal_review","policy_source":"administrative_plan"}','{"notice":"prompt","request_deadline":"administrative_plan"}',true,'2026-08-28'),
('pbv','admission','denial','24 CFR 982.554 via 24 CFR 983.2','https://www.ecfr.gov/current/title-24/section-983.2','current','["brief reasons for denial","right to request informal review","how to obtain informal review"]','{"process":"informal_review","policy_source":"administrative_plan"}','{"notice":"prompt","request_deadline":"administrative_plan"}',true,'2026-08-28'),
('public_housing','admission','denial','24 CFR 960.208(a)','https://www.ecfr.gov/current/title-24/section-960.208','current','["basis for ineligibility","opportunity for informal hearing upon request"]','{"process":"informal_hearing","policy_source":"acop"}','{"notice":"prompt","hearing":"within reasonable time after determination"}',true,'2026-08-28'),
('public_housing','admission','approval','24 CFR 960.208(b)','https://www.ecfr.gov/current/title-24/section-960.208','current','["approximate date of occupancy when reasonably determinable"]','{"process":"none_required_by_this_profile"}','{}',true,'2026-08-28'),
('mod_rehab','admission','denial','24 CFR 882.514(f)','https://www.ecfr.gov/current/title-24/section-882.514','current','["determination of ineligibility","reasons","right to request informal hearing","reasonable request period specified in letter"]','{"process":"informal_hearing","standard":"preponderance_of_evidence"}','{"request_deadline":"reasonable time specified in letter"}',true,'2026-08-28'),
('mod_rehab','admission','approval','24 CFR 882.514(d)','https://www.ecfr.gov/current/title-24/section-882.514','current','["tenant rent and utility allowance information","required family briefing"]','{"process":"family_briefing"}','{}',true,'2026-08-28');

-- Participant determination profiles.
insert into public.pha_notice_requirement_profiles
(program_code, action_type, determination_outcome, authority_code, authority_url, source_status, required_elements, rights_snapshot, federal_timing_rule, requires_local_policy_overlay, effective_from)
select p.program_code, a.action_type, o.determination_outcome, p.authority_code, p.authority_url, p.source_status,
       p.required_elements, p.rights_snapshot, p.federal_timing_rule, true, '2026-08-28'::date
from (values
  ('hcv','24 CFR 982.555','https://www.ecfr.gov/current/title-24/section-982.555','current','["brief reasons for decision","right to request informal hearing","deadline to request hearing"]'::jsonb,'{"process":"informal_hearing","policy_source":"administrative_plan"}'::jsonb,'{"hearing":"reasonably expeditious","request_deadline":"administrative_plan"}'::jsonb),
  ('pbv','24 CFR 982.555 via 24 CFR 983.2','https://www.ecfr.gov/current/title-24/section-983.2','current','["brief reasons for decision","right to request informal hearing","deadline to request hearing"]'::jsonb,'{"process":"informal_hearing","policy_source":"administrative_plan"}'::jsonb,'{"hearing":"reasonably expeditious","request_deadline":"administrative_plan"}'::jsonb),
  ('public_housing','24 CFR 966.50-966.57','https://www.ecfr.gov/current/title-24/part-966/subpart-B','current','["basis for adverse action","applicable grievance/hearing procedure"]'::jsonb,'{"process":"public_housing_grievance","policy_source":"acop_or_grievance_procedure"}'::jsonb,'{"request_deadline":"agency_grievance_procedure"}'::jsonb),
  ('mod_rehab','24 CFR 882.514(f)','https://www.ecfr.gov/current/title-24/section-882.514','pending_source','["program-specific participant notice authority requires controlled resolution"]'::jsonb,'{"process":"pending_controlled_source"}'::jsonb,'{}'::jsonb)
) as p(program_code, authority_code, authority_url, source_status, required_elements, rights_snapshot, federal_timing_rule)
cross join (values ('annual_reexamination'),('interim_reexamination'),('portability'),('other')) as a(action_type)
cross join (values ('change'),('termination'),('denial')) as o(determination_outcome)
on conflict do nothing;

create or replace function public.prepare_pha_family_notice()
returns trigger language plpgsql security invoker as $$
declare
  action_row public.pha_family_actions%rowtype;
  calc_row public.pha_family_calculations%rowtype;
  profile_row public.pha_notice_requirement_profiles%rowtype;
  overlay_row public.pha_notice_policy_overlays%rowtype;
  calc_found boolean := false;
  profile_found boolean := false;
  overlay_found boolean := false;
  derived_template text;
  derived_summary text;
  expected_policy_type text;
begin
  if tg_op = 'UPDATE' and old.status = 'issued' and new.status <> 'issued' then
    raise exception 'Issued PHA family notices are immutable and cannot be reverted';
  end if;

  select * into action_row from public.pha_family_actions
   where id = new.family_action_id and user_id = new.user_id;
  if not found then raise exception 'PHA family action not found for notice'; end if;

  select * into calc_row from public.pha_family_calculations
   where family_action_id = new.family_action_id and user_id = new.user_id;
  calc_found := found;

  derived_template := case action_row.action_type
    when 'admission' then 'PHA_ADMISSION_DETERMINATION'
    when 'annual_reexamination' then 'PHA_ANNUAL_REEXAMINATION_DETERMINATION'
    when 'interim_reexamination' then 'PHA_INTERIM_REEXAMINATION_DETERMINATION'
    when 'portability' then 'PHA_PORTABILITY_DETERMINATION'
    else 'PHA_FAMILY_DETERMINATION' end;
  new.template_key := derived_template;
  new.source_validated := action_row.controlled_source_release_approved
    and action_row.current_rule_version_validated and not action_row.source_status_conflict;
  new.updated_at := now();

  if calc_found then
    new.determination_snapshot := jsonb_build_object(
      'program_code', action_row.program_code, 'action_type', action_row.action_type,
      'effective_date', action_row.effective_date, 'annual_income', calc_row.annual_income,
      'adjusted_income', calc_row.adjusted_income, 'total_tenant_payment', calc_row.total_tenant_payment,
      'tenant_rent', calc_row.tenant_rent, 'family_share', calc_row.family_share,
      'housing_assistance_payment', calc_row.housing_assistance_payment,
      'utility_reimbursement', calc_row.utility_reimbursement,
      'contract_rent_to_owner', calc_row.contract_rent_to_owner,
      'calculation_status', calc_row.calculation_status, 'engine_build', calc_row.engine_build);
    derived_summary := concat_ws(' ', 'Program:', upper(replace(action_row.program_code, '_', ' ')) || '.',
      'Action:', replace(action_row.action_type, '_', ' ') || '.', 'Effective date:', action_row.effective_date::text || '.',
      'TTP:', coalesce(calc_row.total_tenant_payment::text, 'not determined') || '.',
      'Tenant rent/share:', coalesce(calc_row.tenant_rent::text, calc_row.family_share::text, 'not determined') || '.',
      'HAP:', coalesce(calc_row.housing_assistance_payment::text, 'not applicable') || '.');
    new.notice_summary := derived_summary;
  else
    new.determination_snapshot := '{}'::jsonb;
    new.notice_summary := 'Calculation not yet validated.';
  end if;

  new.legal_profile_id := null;
  new.legal_requirements_validated := false;
  new.local_policy_overlay_status := 'unresolved';
  new.legal_notice_snapshot := '{}'::jsonb;
  new.response_deadline_at := null;

  if new.determination_outcome is not null then
    select * into profile_row from public.pha_notice_requirement_profiles p
     where p.program_code = action_row.program_code
       and p.action_type = action_row.action_type
       and p.determination_outcome = new.determination_outcome
       and p.active = true and p.effective_from <= action_row.effective_date
       and (p.effective_to is null or p.effective_to >= action_row.effective_date)
     order by p.effective_from desc limit 1;
    profile_found := found;
  end if;

  if profile_found then
    new.legal_profile_id := profile_row.id;
    expected_policy_type := case action_row.program_code
      when 'public_housing' then 'acop'
      when 'mod_rehab' then 'mod_rehab_policy'
      else 'administrative_plan' end;

    if profile_row.requires_local_policy_overlay then
      select * into overlay_row from public.pha_notice_policy_overlays o
       where o.workspace_user_id = action_row.user_id and o.program_code = action_row.program_code
         and o.policy_type = expected_policy_type and o.active = true and o.validated = true
         and o.effective_date <= action_row.effective_date
       order by o.effective_date desc limit 1;
      overlay_found := found;
      new.local_policy_overlay_status := case when overlay_found then 'validated' else 'unresolved' end;
    else
      new.local_policy_overlay_status := 'not_required';
      overlay_found := true;
    end if;

    new.legal_requirements_validated := profile_row.source_status = 'current' and overlay_found;
    new.legal_notice_snapshot := jsonb_build_object(
      'authority_code', profile_row.authority_code,
      'authority_url', profile_row.authority_url,
      'required_elements', profile_row.required_elements,
      'rights', profile_row.rights_snapshot,
      'federal_timing_rule', profile_row.federal_timing_rule,
      'local_policy_type', expected_policy_type,
      'local_policy_version', case when overlay_found and profile_row.requires_local_policy_overlay then overlay_row.policy_version else null end,
      'local_policy_source', case when overlay_found and profile_row.requires_local_policy_overlay then overlay_row.source_reference else null end,
      'local_deadline_rule', case when overlay_found and profile_row.requires_local_policy_overlay then overlay_row.hearing_request_deadline_rule else '{}'::jsonb end,
      'language_access_requirements', case when overlay_found and profile_row.requires_local_policy_overlay then overlay_row.language_access_requirements else '{}'::jsonb end,
      'accessibility_requirements', case when overlay_found and profile_row.requires_local_policy_overlay then overlay_row.accessibility_requirements else '{}'::jsonb end);
  end if;

  if new.status in ('ready','issued') then
    if not calc_found or calc_row.calculation_status <> 'validated' then
      raise exception 'A validated family calculation is required before a notice can be ready or issued';
    end if;
    if not new.source_validated then
      raise exception 'Approved current controlled sources are required before a notice can be ready or issued';
    end if;
    if new.determination_outcome is null then
      raise exception 'Determination outcome is required before legal notice issuance';
    end if;
    if not profile_found then
      raise exception 'No active controlled legal notice profile applies to this program, action, and outcome';
    end if;
    if profile_row.source_status <> 'current' then
      raise exception 'Controlled legal notice authority is not current for this determination';
    end if;
    if not new.legal_requirements_validated then
      raise exception 'Validated agency Administrative Plan, ACOP, or program policy overlay is required before legal notice issuance';
    end if;
  end if;

  if new.status = 'issued' then
    if new.delivery_method is null then raise exception 'Delivery method is required before notice issuance'; end if;
    if tg_op = 'UPDATE' and old.status = 'issued' then new.issued_at := old.issued_at;
    else new.issued_at := coalesce(new.issued_at, now()); end if;
  else new.issued_at := null; end if;
  return new;
end;
$$;

create or replace function public.refresh_pha_family_action_from_notice()
returns trigger language plpgsql security invoker as $$
declare action_id uuid; owner_id uuid; has_issued_notice boolean := false;
begin
  if tg_op = 'DELETE' then action_id := old.family_action_id; owner_id := old.user_id;
  else action_id := new.family_action_id; owner_id := new.user_id; end if;
  select exists (
    select 1 from public.pha_family_notices n
     where n.family_action_id = action_id and n.user_id = owner_id
       and n.status = 'issued' and n.issued_at is not null
       and n.source_validated = true and n.legal_requirements_validated = true
  ) into has_issued_notice;
  update public.pha_family_actions set notice_complete = has_issued_notice, updated_at = now()
   where id = action_id and user_id = owner_id;
  return null;
end;
$$;
