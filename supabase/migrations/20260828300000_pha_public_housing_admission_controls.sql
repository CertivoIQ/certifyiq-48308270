-- Public Housing admission controls under 24 CFR 960.202, 960.206, 960.407 and 24 CFR part 903.
-- Local preference ranking does not by itself establish a lawful final unit offer.

create table if not exists public.pha_public_housing_admission_year_controls (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  fiscal_year integer not null check (fiscal_year between 2000 and 2200),
  acop_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
  public_housing_waiting_list_admissions integer not null default 0 check (public_housing_waiting_list_admissions >= 0),
  public_housing_eli_admissions integer not null default 0 check (public_housing_eli_admissions >= 0),
  hcv_waiting_list_admissions integer not null default 0 check (hcv_waiting_list_admissions >= 0),
  hcv_eli_admissions integer not null default 0 check (hcv_eli_admissions >= 0),
  hcv_excess_eli_admissions integer not null default 0 check (hcv_excess_eli_admissions >= 0),
  qualifying_high_poverty_low_income_occupancies integer not null default 0 check (qualifying_high_poverty_low_income_occupancies >= 0),
  targeting_strategy_reference text,
  deconcentration_policy_reference text,
  annual_plan_source_id uuid references public.pha_source_library(id),
  validated boolean not null default false,
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_user_id,fiscal_year)
);

create table if not exists public.pha_public_housing_development_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  fiscal_year integer not null check (fiscal_year between 2000 and 2200),
  development_reference text not null,
  occupancy_type text not null default 'general' check (occupancy_type in ('general','mixed_population','designated_elderly','designated_disabled','designated_elderly_disabled')),
  covered_by_deconcentration boolean not null default true,
  average_family_income numeric(14,2),
  established_income_range_status text not null default 'not_determined' check (established_income_range_status in ('below','within','above','exempt','not_determined')),
  deconcentration_strategy text,
  special_accessibility_features text[] not null default '{}',
  designation_authority_reference text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_user_id,fiscal_year,development_reference)
);

create table if not exists public.pha_public_housing_unit_offers (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  applicant_id uuid not null references public.pha_waiting_list_applicants(id) on delete cascade,
  admission_control_id uuid not null references public.pha_public_housing_admission_year_controls(id),
  development_profile_id uuid not null references public.pha_public_housing_development_profiles(id),
  unit_reference text not null,
  offer_date date not null default current_date,
  bedroom_count integer not null check (bedroom_count >= 0),
  unit_accessibility_features text[] not null default '{}',
  family_annual_income numeric(14,2) check (family_annual_income is null or family_annual_income >= 0),
  applicant_is_eli boolean not null default false,
  family_type text not null default 'other' check (family_type in ('elderly','disabled','elderly_disabled','other')),
  single_person boolean not null default false,
  required_accessibility_features text[] not null default '{}',
  mixed_population_priority_satisfied boolean not null default false,
  no_higher_priority_accessibility_match_confirmed boolean not null default false,
  targeting_status text not null default 'not_determined' check (targeting_status in ('satisfied','sequence_review','not_determined')),
  targeting_sequence_rationale text,
  deconcentration_status text not null default 'not_determined' check (deconcentration_status in ('within_range','strategy_documented','exempt','not_determined')),
  final_selection_status text not null default 'pending' check (final_selection_status in ('pending','ready','blocked')),
  block_reason text,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(applicant_id,unit_reference,offer_date)
);

alter table public.pha_public_housing_admission_year_controls enable row level security;
alter table public.pha_public_housing_development_profiles enable row level security;
alter table public.pha_public_housing_unit_offers enable row level security;
grant select,insert,update on public.pha_public_housing_admission_year_controls,public.pha_public_housing_development_profiles,public.pha_public_housing_unit_offers to authenticated;
grant all on public.pha_public_housing_admission_year_controls,public.pha_public_housing_development_profiles,public.pha_public_housing_unit_offers to service_role;

create policy "PHA PH users read admission controls" on public.pha_public_housing_admission_year_controls for select to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',false));
create policy "PHA PH admins manage admission controls" on public.pha_public_housing_admission_year_controls for all to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',true)) with check (public.pha_program_access(workspace_user_id,'public_housing',true));
create policy "PHA PH users read development profiles" on public.pha_public_housing_development_profiles for select to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',false));
create policy "PHA PH users manage development profiles" on public.pha_public_housing_development_profiles for all to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',true)) with check (public.pha_program_access(workspace_user_id,'public_housing',true));
create policy "PHA PH users read unit offers" on public.pha_public_housing_unit_offers for select to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',false));
create policy "PHA PH users manage unit offers" on public.pha_public_housing_unit_offers for all to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',true)) with check (public.pha_program_access(workspace_user_id,'public_housing',true));

create or replace function public.prepare_pha_ph_admission_year_control() returns trigger language plpgsql security invoker as $$
declare src public.pha_source_library%rowtype;
begin
  perform public.assert_pha_policy_overlay(new.acop_overlay_id,new.workspace_user_id,'public_housing','acop');
  if new.validated then
    if new.validated_by is null then new.validated_by:=auth.uid(); end if;
    new.validated_at:=coalesce(new.validated_at,now());
    if coalesce(trim(new.targeting_strategy_reference),'')='' then raise exception 'Validated Public Housing admission control requires a targeting strategy reference'; end if;
    if coalesce(trim(new.deconcentration_policy_reference),'')='' then raise exception 'Validated Public Housing admission control requires a deconcentration policy reference'; end if;
    if new.annual_plan_source_id is null then raise exception 'Validated Public Housing admission control requires a controlled PHA Annual Plan source'; end if;
    select * into src from public.pha_source_library where id=new.annual_plan_source_id and workspace_user_id=new.workspace_user_id and source_scope='agency' and status='current';
    if not found then raise exception 'PHA Annual Plan source must be current and workspace-controlled'; end if;
  end if;
  new.updated_at:=now(); return new;
end; $$;
create trigger pha_ph_admission_year_control_prepare before insert or update on public.pha_public_housing_admission_year_controls for each row execute function public.prepare_pha_ph_admission_year_control();

create or replace function public.prepare_pha_ph_development_profile() returns trigger language plpgsql security invoker as $$
begin
  if new.occupancy_type like 'designated_%' and coalesce(trim(new.designation_authority_reference),'')='' then raise exception 'Designated Public Housing development requires designation authority reference'; end if;
  if new.covered_by_deconcentration and new.established_income_range_status in ('below','above') and coalesce(trim(new.deconcentration_strategy),'')='' then raise exception 'Out-of-range covered development requires a documented deconcentration strategy'; end if;
  new.updated_at:=now(); return new;
end; $$;
create trigger pha_ph_development_profile_prepare before insert or update on public.pha_public_housing_development_profiles for each row execute function public.prepare_pha_ph_development_profile();

create or replace function public.prepare_pha_ph_unit_offer() returns trigger language plpgsql security invoker as $$
declare
  a public.pha_waiting_list_applicants%rowtype; l public.pha_waiting_lists%rowtype;
  c public.pha_public_housing_admission_year_controls%rowtype; d public.pha_public_housing_development_profiles%rowtype;
  credit_cap integer; projected_required integer; projected_eli integer;
begin
  select * into a from public.pha_waiting_list_applicants where id=new.applicant_id;
  if not found then raise exception 'Public Housing waiting-list applicant not found'; end if;
  select * into l from public.pha_waiting_lists where id=a.waiting_list_id;
  if not found or l.program_code<>'public_housing' then raise exception 'Final Public Housing unit offer requires a Public Housing waiting-list applicant'; end if;
  if a.status<>'selected' then raise exception 'Public Housing applicant must be selected from the controlled waiting list before unit offer'; end if;
  select * into c from public.pha_public_housing_admission_year_controls where id=new.admission_control_id and workspace_user_id=new.workspace_user_id and validated=true;
  if not found then raise exception 'Validated Public Housing fiscal-year admission control is required'; end if;
  select * into d from public.pha_public_housing_development_profiles where id=new.development_profile_id and workspace_user_id=new.workspace_user_id and fiscal_year=c.fiscal_year and active=true;
  if not found then raise exception 'Current Public Housing development profile is required'; end if;

  credit_cap:=least(
    floor((c.public_housing_waiting_list_admissions + 1) * 0.10)::integer,
    floor(c.hcv_waiting_list_admissions * 0.10)::integer,
    c.qualifying_high_poverty_low_income_occupancies,
    c.hcv_excess_eli_admissions
  );
  projected_eli:=c.public_housing_eli_admissions + case when new.applicant_is_eli then 1 else 0 end;
  projected_required:=greatest(0,ceil((c.public_housing_waiting_list_admissions + 1) * 0.40)::integer-credit_cap);
  if projected_eli>=projected_required then new.targeting_status:='satisfied';
  else new.targeting_status:='sequence_review';
    if coalesce(trim(new.targeting_sequence_rationale),'')='' then new.final_selection_status:='blocked'; new.block_reason:='40 percent ELI targeting sequence requires documented PHA strategy before this non-ELI admission'; end if;
  end if;

  if not d.covered_by_deconcentration or d.established_income_range_status='exempt' then new.deconcentration_status:='exempt';
  elsif d.established_income_range_status='within' then new.deconcentration_status:='within_range';
  elsif d.established_income_range_status in ('below','above') and coalesce(trim(d.deconcentration_strategy),'')<>'' then new.deconcentration_status:='strategy_documented';
  else new.deconcentration_status:='not_determined'; new.final_selection_status:='blocked'; new.block_reason:=coalesce(new.block_reason,'Covered development deconcentration status is unresolved'); end if;

  if d.occupancy_type='designated_elderly' and new.family_type not in ('elderly','elderly_disabled') then new.final_selection_status:='blocked'; new.block_reason:='Family does not match elderly-designated development'; end if;
  if d.occupancy_type='designated_disabled' and new.family_type not in ('disabled','elderly_disabled') then new.final_selection_status:='blocked'; new.block_reason:='Family does not match disabled-designated development'; end if;
  if d.occupancy_type='designated_elderly_disabled' and new.family_type='other' then new.final_selection_status:='blocked'; new.block_reason:='Family does not match elderly/disabled designated development'; end if;
  if d.occupancy_type='mixed_population' and new.family_type in ('elderly','disabled','elderly_disabled') and not new.mixed_population_priority_satisfied then new.final_selection_status:='blocked'; new.block_reason:='Mixed-population elderly/disabled equal-priority control is not confirmed'; end if;

  if cardinality(new.unit_accessibility_features)>0 and cardinality(new.required_accessibility_features)=0 and not new.no_higher_priority_accessibility_match_confirmed then new.final_selection_status:='blocked'; new.block_reason:='Accessible unit requires confirmation that no higher-priority family needs the features'; end if;
  if new.single_person and new.family_type='other' and new.bedroom_count>=2 then new.final_selection_status:='blocked'; new.block_reason:='Non-elderly/non-disabled single person may not receive a two-or-more-bedroom Public Housing unit'; end if;

  if new.final_selection_status<>'blocked' then new.final_selection_status:='ready'; new.block_reason:=null; end if;
  new.source_snapshot:=jsonb_build_object('authority',jsonb_build_array('24 CFR 960.202','24 CFR 960.206','24 CFR 960.407','24 CFR part 903'),'fiscal_year',c.fiscal_year,'projected_eli',projected_eli,'projected_required_eli',projected_required,'voucher_credit',credit_cap,'development',d.development_reference,'income_range_status',d.established_income_range_status,'occupancy_type',d.occupancy_type);
  new.updated_at:=now(); return new;
end; $$;
create trigger pha_ph_unit_offer_prepare before insert or update on public.pha_public_housing_unit_offers for each row execute function public.prepare_pha_ph_unit_offer();
