-- PBV waiting-list operations under current 24 CFR 983.251.

create table if not exists public.pha_pbv_waiting_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  list_name text not null,
  list_structure text not null check (list_structure in ('central_pbv','shared_hcv_pbv','project_specific')),
  project_reference text,
  owner_reference text,
  owner_maintained boolean not null default false,
  preliminary_eligibility_actor text not null default 'pha' check (preliminary_eligibility_actor in ('pha','owner')),
  administrative_plan_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
  owner_waiting_list_policy_source_id uuid references public.pha_source_library(id),
  oversight_procedures text,
  good_cause_policy text not null,
  selection_method text not null default 'date_time' check (selection_method in ('date_time','random')),
  status text not null default 'closed' check (status in ('open','closed','suspended')),
  public_notice_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((list_structure='project_specific' and project_reference is not null) or list_structure<>'project_specific'),
  check ((owner_maintained=false) or (list_structure='project_specific' and owner_reference is not null))
);

create table if not exists public.pha_pbv_waiting_list_applicants (
  id uuid primary key default gen_random_uuid(),
  waiting_list_id uuid not null references public.pha_pbv_waiting_lists(id) on delete cascade,
  family_reference text not null,
  applied_at timestamptz not null default now(),
  in_place_family boolean not null default false,
  absolute_preference boolean not null default false,
  preference_priority integer not null default 999999,
  preference_verified boolean not null default false,
  accessibility_features text[] not null default '{}',
  preliminary_eligibility_status text not null default 'pending' check (preliminary_eligibility_status in ('pending','eligible','ineligible')),
  selected_at timestamptz,
  final_pha_eligibility_status text not null default 'pending' check (final_pha_eligibility_status in ('pending','eligible','ineligible')),
  final_eligibility_determined_at timestamptz,
  ttp_less_than_gross_rent boolean,
  unit_offer_allowed boolean not null default false,
  status text not null default 'active' check (status in ('active','selected','referred_to_pha','eligible_for_offer','ineligible','removed','closed')),
  removal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(waiting_list_id,family_reference)
);

create table if not exists public.pha_pbv_waiting_list_decisions (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.pha_pbv_waiting_list_applicants(id) on delete cascade,
  decision_type text not null check (decision_type in ('owner_preliminary_ineligible','preference_denied','family_offer_rejected','owner_rejected_family','selected_for_referral')),
  decision_reason text,
  good_cause_claimed boolean not null default false,
  notice_required boolean not null default false,
  notice_issued_at timestamptz,
  informal_review_required boolean not null default false,
  informal_review_status text not null default 'not_required' check (informal_review_status in ('not_required','pending','scheduled','completed')),
  pbv_list_effect text not null default 'none' check (pbv_list_effect in ('none','remove_from_project_list','admin_plan_controlled')),
  tenant_based_list_protected boolean not null default true,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.pha_pbv_waiting_lists enable row level security;
alter table public.pha_pbv_waiting_list_applicants enable row level security;
alter table public.pha_pbv_waiting_list_decisions enable row level security;
grant select,insert,update on public.pha_pbv_waiting_lists,public.pha_pbv_waiting_list_applicants,public.pha_pbv_waiting_list_decisions to authenticated;
grant all on public.pha_pbv_waiting_lists,public.pha_pbv_waiting_list_applicants,public.pha_pbv_waiting_list_decisions to service_role;

create policy "PHA PBV users read waiting lists" on public.pha_pbv_waiting_lists for select to authenticated using (public.pha_program_access(workspace_user_id,'pbv',false));
create policy "PHA PBV users manage waiting lists" on public.pha_pbv_waiting_lists for all to authenticated using (public.pha_program_access(workspace_user_id,'pbv',true)) with check (public.pha_program_access(workspace_user_id,'pbv',true));
create policy "PHA PBV users read waiting applicants" on public.pha_pbv_waiting_list_applicants for select to authenticated using (exists(select 1 from public.pha_pbv_waiting_lists l where l.id=waiting_list_id and public.pha_program_access(l.workspace_user_id,'pbv',false)));
create policy "PHA PBV users manage waiting applicants" on public.pha_pbv_waiting_list_applicants for all to authenticated using (exists(select 1 from public.pha_pbv_waiting_lists l where l.id=waiting_list_id and public.pha_program_access(l.workspace_user_id,'pbv',true))) with check (exists(select 1 from public.pha_pbv_waiting_lists l where l.id=waiting_list_id and public.pha_program_access(l.workspace_user_id,'pbv',true)));
create policy "PHA PBV users read waiting decisions" on public.pha_pbv_waiting_list_decisions for select to authenticated using (exists(select 1 from public.pha_pbv_waiting_list_applicants a join public.pha_pbv_waiting_lists l on l.id=a.waiting_list_id where a.id=applicant_id and public.pha_program_access(l.workspace_user_id,'pbv',false)));
create policy "PHA PBV users manage waiting decisions" on public.pha_pbv_waiting_list_decisions for insert to authenticated with check (exists(select 1 from public.pha_pbv_waiting_list_applicants a join public.pha_pbv_waiting_lists l on l.id=a.waiting_list_id where a.id=applicant_id and public.pha_program_access(l.workspace_user_id,'pbv',true)));

create or replace function public.prepare_pha_pbv_waiting_list() returns trigger language plpgsql security invoker as $$
declare p public.pha_notice_policy_overlays%rowtype; s public.pha_source_library%rowtype;
begin
 select * into p from public.pha_notice_policy_overlays where id=new.administrative_plan_overlay_id and workspace_user_id=new.workspace_user_id and program_code='pbv' and active=true and validated=true;
 if not found then raise exception 'PBV waiting list requires an active validated Administrative Plan overlay'; end if;
 if new.owner_maintained then
   if new.list_structure<>'project_specific' then raise exception 'Owner-maintained PBV lists must be project-specific'; end if;
   if coalesce(trim(new.oversight_procedures),'')='' then raise exception 'PHA oversight procedures are required for owner-maintained PBV waiting lists'; end if;
   if new.owner_waiting_list_policy_source_id is null then raise exception 'Approved owner waiting-list policy source is required'; end if;
   select * into s from public.pha_source_library where id=new.owner_waiting_list_policy_source_id and workspace_user_id=new.workspace_user_id and source_scope='agency' and status='current';
   if not found then raise exception 'Owner waiting-list policy must be a current agency controlled source'; end if;
 end if;
 if new.status='open' and coalesce(trim(new.public_notice_reference),'')='' then raise exception 'Opening a PBV waiting list requires a public notice reference'; end if;
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_pbv_waiting_list_prepare before insert or update on public.pha_pbv_waiting_lists for each row execute function public.prepare_pha_pbv_waiting_list();

create or replace function public.prepare_pha_pbv_waiting_list_applicant() returns trigger language plpgsql security invoker as $$
declare l public.pha_pbv_waiting_lists%rowtype;
begin
 select * into l from public.pha_pbv_waiting_lists where id=new.waiting_list_id;
 if not found then raise exception 'PBV waiting list not found'; end if;
 if tg_op='INSERT' and l.status<>'open' and not new.in_place_family then raise exception 'PBV waiting list must be open for new applicants'; end if;
 new.absolute_preference:=new.in_place_family;
 if new.in_place_family then new.preference_priority:=0; new.preference_verified:=true; end if;
 if new.final_pha_eligibility_status='eligible' then
   if new.ttp_less_than_gross_rent is distinct from true then raise exception 'PBV final eligibility requires TTP below gross rent'; end if;
   new.final_eligibility_determined_at:=coalesce(new.final_eligibility_determined_at,now());
   new.unit_offer_allowed:=true;
   if new.status in ('selected','referred_to_pha','active') then new.status:='eligible_for_offer'; end if;
 else new.unit_offer_allowed:=false; end if;
 if new.status='removed' and coalesce(trim(new.removal_reason),'')='' then raise exception 'PBV waiting-list removal requires a documented reason'; end if;
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_pbv_waiting_list_applicant_prepare before insert or update on public.pha_pbv_waiting_list_applicants for each row execute function public.prepare_pha_pbv_waiting_list_applicant();

create or replace function public.prepare_pha_pbv_waiting_list_decision() returns trigger language plpgsql security invoker as $$
declare a public.pha_pbv_waiting_list_applicants%rowtype; l public.pha_pbv_waiting_lists%rowtype;
begin
 select * into a from public.pha_pbv_waiting_list_applicants where id=new.applicant_id; if not found then raise exception 'PBV applicant not found'; end if;
 select * into l from public.pha_pbv_waiting_lists where id=a.waiting_list_id;
 new.tenant_based_list_protected:=true;
 if new.decision_type in ('owner_preliminary_ineligible','preference_denied') and l.owner_maintained and l.preliminary_eligibility_actor='owner' then new.notice_required:=true; new.informal_review_required:=true; new.informal_review_status:=case when new.informal_review_status='not_required' then 'pending' else new.informal_review_status end; end if;
 if new.decision_type in ('family_offer_rejected','owner_rejected_family') then
   if l.list_structure='project_specific' then new.pbv_list_effect:='remove_from_project_list'; else new.pbv_list_effect:='admin_plan_controlled'; end if;
 end if;
 if new.notice_required and new.notice_issued_at is null and new.informal_review_status in ('scheduled','completed') then raise exception 'Required PBV waiting-list notice must be issued before informal review'; end if;
 new.snapshot:=jsonb_build_object('list_id',l.id,'list_structure',l.list_structure,'owner_maintained',l.owner_maintained,'project_reference',l.project_reference,'tenant_based_list_protected',true,'pbv_list_effect',new.pbv_list_effect);
 return new;
end; $$;
create trigger pha_pbv_waiting_list_decision_prepare before insert on public.pha_pbv_waiting_list_decisions for each row execute function public.prepare_pha_pbv_waiting_list_decision();
