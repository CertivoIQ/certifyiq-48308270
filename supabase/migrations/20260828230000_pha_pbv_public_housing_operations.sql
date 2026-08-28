-- Program-specific PBV and Public Housing operational controls.
-- Authority current through 2026-08-25: 24 CFR part 983 and 24 CFR 960.253 / 960.507.

create table if not exists public.pha_pbv_hap_contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  project_reference text not null, owner_reference text not null, contract_reference text not null,
  effective_date date not null, annual_anniversary date not null,
  rent_adjustment_method text not null check (rent_adjustment_method in ('owner_request','ocaf')),
  administrative_plan_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
  status text not null default 'active' check (status in ('active','suspended','ended')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_user_id, contract_reference)
);
create table if not exists public.pha_pbv_rent_actions (
  id uuid primary key default gen_random_uuid(), hap_contract_id uuid not null references public.pha_pbv_hap_contracts(id) on delete cascade,
  action_type text not null check (action_type in ('initial','owner_request','ocaf','decrease','correction')),
  requested_rent numeric(12,2), approved_rent numeric(12,2), reasonable_rent numeric(12,2), applicable_cap numeric(12,2),
  hqs_compliant boolean not null default false, owner_request_received_at date, effective_date date,
  written_notice_issued boolean not null default false,
  determination_status text not null default 'pending' check (determination_status in ('pending','approved','denied','blocked')),
  block_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.pha_pbv_move_requests (
  id uuid primary key default gen_random_uuid(), workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  family_action_id uuid not null references public.pha_family_actions(id) on delete cascade,
  assisted_lease_start date not null, request_received_at date not null default current_date,
  owner_notice_documented boolean not null default false, vawa_emergency_transfer boolean not null default false,
  one_year_requirement_satisfied boolean not null default false,
  assistance_offer_type text check (assistance_offer_type in ('tenant_based_voucher','comparable_tenant_based_assistance','other')),
  offer_status text not null default 'pending' check (offer_status in ('pending','eligible','offered','completed','blocked')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.pha_public_housing_rent_elections (
  id uuid primary key default gen_random_uuid(), workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  family_action_id uuid not null references public.pha_family_actions(id) on delete cascade,
  acop_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
  election_year integer not null, rent_option text not null check (rent_option in ('income_based','flat_rent')),
  income_based_rent numeric(12,2) not null check (income_based_rent >= 0), flat_rent numeric(12,2) not null check (flat_rent >= 0), selected_rent numeric(12,2) not null check (selected_rent >= 0),
  hardship_review_required boolean not null default false, notice_issued boolean not null default false,
  elected_at timestamptz not null default now(), unique(family_action_id,election_year)
);
create table if not exists public.pha_public_housing_over_income_cases (
  id uuid primary key default gen_random_uuid(), workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  family_action_id uuid not null references public.pha_family_actions(id) on delete cascade,
  acop_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
  over_income_limit numeric(12,2) not null check (over_income_limit >= 0), first_over_income_determination date not null,
  consecutive_months integer not null default 0 check (consecutive_months between 0 and 120),
  notice_stage text not null default 'initial' check (notice_stage in ('initial','twelve_month','twenty_four_month','post_24_month')),
  pha_post_24_policy text check (pha_post_24_policy in ('terminate','alternative_non_public_housing_rent')),
  alternative_rent numeric(12,2), non_public_housing_lease_executed_at date, termination_deadline date,
  status text not null default 'monitoring' check (status in ('monitoring','below_limit','alternative_rent','termination_pending','closed','blocked')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(family_action_id)
);

alter table public.pha_pbv_hap_contracts enable row level security; alter table public.pha_pbv_rent_actions enable row level security; alter table public.pha_pbv_move_requests enable row level security; alter table public.pha_public_housing_rent_elections enable row level security; alter table public.pha_public_housing_over_income_cases enable row level security;
grant select,insert,update,delete on public.pha_pbv_hap_contracts,public.pha_pbv_rent_actions,public.pha_pbv_move_requests,public.pha_public_housing_rent_elections,public.pha_public_housing_over_income_cases to authenticated;
grant all on public.pha_pbv_hap_contracts,public.pha_pbv_rent_actions,public.pha_pbv_move_requests,public.pha_public_housing_rent_elections,public.pha_public_housing_over_income_cases to service_role;

create policy "PHA PBV users read HAP contracts" on public.pha_pbv_hap_contracts for select to authenticated using (public.pha_program_access(workspace_user_id,'pbv',false));
create policy "PHA PBV users manage HAP contracts" on public.pha_pbv_hap_contracts for all to authenticated using (public.pha_program_access(workspace_user_id,'pbv',true)) with check (public.pha_program_access(workspace_user_id,'pbv',true));
create policy "PHA PBV users read rent actions" on public.pha_pbv_rent_actions for select to authenticated using (exists(select 1 from public.pha_pbv_hap_contracts h where h.id=hap_contract_id and public.pha_program_access(h.workspace_user_id,'pbv',false)));
create policy "PHA PBV users manage rent actions" on public.pha_pbv_rent_actions for all to authenticated using (exists(select 1 from public.pha_pbv_hap_contracts h where h.id=hap_contract_id and public.pha_program_access(h.workspace_user_id,'pbv',true))) with check (exists(select 1 from public.pha_pbv_hap_contracts h where h.id=hap_contract_id and public.pha_program_access(h.workspace_user_id,'pbv',true)));
create policy "PHA PBV users read move requests" on public.pha_pbv_move_requests for select to authenticated using (public.pha_program_access(workspace_user_id,'pbv',false));
create policy "PHA PBV users manage move requests" on public.pha_pbv_move_requests for all to authenticated using (public.pha_program_access(workspace_user_id,'pbv',true)) with check (public.pha_program_access(workspace_user_id,'pbv',true));
create policy "PHA PH users read rent elections" on public.pha_public_housing_rent_elections for select to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',false));
create policy "PHA PH users manage rent elections" on public.pha_public_housing_rent_elections for all to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',true)) with check (public.pha_program_access(workspace_user_id,'public_housing',true));
create policy "PHA PH users read over income" on public.pha_public_housing_over_income_cases for select to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',false));
create policy "PHA PH users manage over income" on public.pha_public_housing_over_income_cases for all to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',true)) with check (public.pha_program_access(workspace_user_id,'public_housing',true));

create or replace function public.assert_pha_policy_overlay(target_overlay_id uuid,target_workspace uuid,target_program text,target_policy_type text) returns void language plpgsql security invoker as $$ begin
 if not exists(select 1 from public.pha_notice_policy_overlays o where o.id=target_overlay_id and o.workspace_user_id=target_workspace and o.program_code=target_program and o.policy_type=target_policy_type and o.active=true and o.validated=true) then raise exception 'Current validated agency policy overlay is required'; end if;
end; $$;
create or replace function public.prepare_pha_pbv_hap_contract() returns trigger language plpgsql security invoker as $$ begin perform public.assert_pha_policy_overlay(new.administrative_plan_overlay_id,new.workspace_user_id,'pbv','administrative_plan'); new.updated_at:=now(); return new; end; $$;
create trigger pha_pbv_hap_contract_prepare before insert or update on public.pha_pbv_hap_contracts for each row execute function public.prepare_pha_pbv_hap_contract();
create or replace function public.prepare_pha_pbv_rent_action() returns trigger language plpgsql security invoker as $$ declare h public.pha_pbv_hap_contracts%rowtype; begin select * into h from public.pha_pbv_hap_contracts where id=new.hap_contract_id; if not found then raise exception 'PBV HAP contract not found'; end if; perform public.assert_pha_policy_overlay(h.administrative_plan_overlay_id,h.workspace_user_id,'pbv','administrative_plan'); if new.action_type in ('owner_request','ocaf') and not new.hqs_compliant then new.determination_status:='blocked'; new.block_reason:='PBV rent increase requires HAP contract compliance including HQS'; end if; if new.determination_status='approved' then if new.approved_rent is null or new.reasonable_rent is null or new.applicable_cap is null then raise exception 'PBV approved rent requires approved rent, reasonable rent, and applicable cap'; end if; if new.approved_rent > least(new.reasonable_rent,new.applicable_cap) then raise exception 'PBV approved rent exceeds controlled rent limit'; end if; if not new.written_notice_issued then raise exception 'PBV rent change requires written notice to owner'; end if; end if; new.updated_at:=now(); return new; end; $$;
create trigger pha_pbv_rent_action_prepare before insert or update on public.pha_pbv_rent_actions for each row execute function public.prepare_pha_pbv_rent_action();
create or replace function public.prepare_pha_pbv_move_request() returns trigger language plpgsql security invoker as $$ declare f public.pha_family_actions%rowtype; begin select * into f from public.pha_family_actions where id=new.family_action_id; if not found or f.program_code <> 'pbv' then raise exception 'PBV move request requires a PBV family action'; end if; new.one_year_requirement_satisfied := new.request_received_at >= (new.assisted_lease_start + interval '1 year')::date; if not new.one_year_requirement_satisfied and not new.vawa_emergency_transfer then new.offer_status:='blocked'; end if; if new.offer_status in ('offered','completed') and new.assistance_offer_type is null then raise exception 'PBV move assistance offer type is required'; end if; new.updated_at:=now(); return new; end; $$;
create trigger pha_pbv_move_request_prepare before insert or update on public.pha_pbv_move_requests for each row execute function public.prepare_pha_pbv_move_request();
create or replace function public.prepare_pha_ph_rent_election() returns trigger language plpgsql security invoker as $$ declare f public.pha_family_actions%rowtype; begin select * into f from public.pha_family_actions where id=new.family_action_id; if not found or f.program_code <> 'public_housing' then raise exception 'Public Housing rent election requires a Public Housing family action'; end if; perform public.assert_pha_policy_overlay(new.acop_overlay_id,new.workspace_user_id,'public_housing','acop'); new.selected_rent:=case new.rent_option when 'flat_rent' then new.flat_rent else new.income_based_rent end; return new; end; $$;
create trigger pha_ph_rent_election_prepare before insert or update on public.pha_public_housing_rent_elections for each row execute function public.prepare_pha_ph_rent_election();
create or replace function public.prepare_pha_ph_over_income_case() returns trigger language plpgsql security invoker as $$ declare f public.pha_family_actions%rowtype; begin select * into f from public.pha_family_actions where id=new.family_action_id; if not found or f.program_code <> 'public_housing' then raise exception 'Public Housing over-income case requires a Public Housing family action'; end if; perform public.assert_pha_policy_overlay(new.acop_overlay_id,new.workspace_user_id,'public_housing','acop'); if new.consecutive_months >= 24 then new.notice_stage:='post_24_month'; if new.pha_post_24_policy is null then new.status:='blocked'; elsif new.pha_post_24_policy='alternative_non_public_housing_rent' then if new.alternative_rent is null then raise exception 'Alternative non-public housing rent is required'; end if; new.status:='alternative_rent'; else new.status:='termination_pending'; end if; elsif new.consecutive_months >= 12 then new.notice_stage:='twelve_month'; else new.notice_stage:='initial'; end if; new.updated_at:=now(); return new; end; $$;
create trigger pha_ph_over_income_prepare before insert or update on public.pha_public_housing_over_income_cases for each row execute function public.prepare_pha_ph_over_income_case();
