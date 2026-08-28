-- Section 8 Moderate Rehabilitation contract/HAP operations.
-- Controlled authority: 24 CFR part 882 and HUD-50058 Section 13.

create table if not exists public.pha_mod_rehab_contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  owner_reference text not null,
  project_reference text not null,
  contract_reference text not null,
  contract_effective_date date not null,
  contract_end_date date,
  current_base_rent numeric(12,2) not null check (current_base_rent >= 0),
  monthly_rehab_debt_service numeric(12,2) not null check (monthly_rehab_debt_service >= 0),
  current_contract_rent numeric(12,2) not null check (current_contract_rent >= 0),
  source_status text not null default 'pending_source' check (source_status in ('pending_source','current','superseded','blocked')),
  policy_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
  status text not null default 'active' check (status in ('active','suspended','ended')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_user_id,contract_reference)
);

create table if not exists public.pha_mod_rehab_hap_actions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.pha_mod_rehab_contracts(id) on delete cascade,
  family_action_id uuid references public.pha_family_actions(id) on delete set null,
  action_type text not null check (action_type in ('monthly_hap','rent_adjustment_request','abatement','resume','correction')),
  tenant_rent numeric(12,2), utility_reimbursement numeric(12,2), hap_to_owner numeric(12,2),
  requested_adjustment numeric(12,2), approved_adjustment numeric(12,2),
  inspection_compliant boolean not null default false,
  audited_financial_support boolean not null default false,
  hud_field_office_approval boolean not null default false,
  effective_date date not null,
  status text not null default 'pending' check (status in ('pending','approved','blocked','abated','completed')),
  block_reason text,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.pha_mod_rehab_contracts enable row level security;
alter table public.pha_mod_rehab_hap_actions enable row level security;
grant select,insert,update,delete on public.pha_mod_rehab_contracts,public.pha_mod_rehab_hap_actions to authenticated;
grant all on public.pha_mod_rehab_contracts,public.pha_mod_rehab_hap_actions to service_role;

create policy "PHA Mod Rehab users read contracts" on public.pha_mod_rehab_contracts for select to authenticated using (public.pha_program_access(workspace_user_id,'mod_rehab',false));
create policy "PHA Mod Rehab users manage contracts" on public.pha_mod_rehab_contracts for all to authenticated using (public.pha_program_access(workspace_user_id,'mod_rehab',true)) with check (public.pha_program_access(workspace_user_id,'mod_rehab',true));
create policy "PHA Mod Rehab users read HAP actions" on public.pha_mod_rehab_hap_actions for select to authenticated using (exists(select 1 from public.pha_mod_rehab_contracts c where c.id=contract_id and public.pha_program_access(c.workspace_user_id,'mod_rehab',false)));
create policy "PHA Mod Rehab users manage HAP actions" on public.pha_mod_rehab_hap_actions for all to authenticated using (exists(select 1 from public.pha_mod_rehab_contracts c where c.id=contract_id and public.pha_program_access(c.workspace_user_id,'mod_rehab',true))) with check (exists(select 1 from public.pha_mod_rehab_contracts c where c.id=contract_id and public.pha_program_access(c.workspace_user_id,'mod_rehab',true)));

create or replace function public.prepare_pha_mod_rehab_contract() returns trigger language plpgsql security invoker as $$
begin
 perform public.assert_pha_policy_overlay(new.policy_overlay_id,new.workspace_user_id,'mod_rehab','mod_rehab_policy');
 if new.source_status <> 'current' then raise exception 'Current controlled Mod Rehab authority is required'; end if;
 new.current_contract_rent:=round(new.current_base_rent + new.monthly_rehab_debt_service,2);
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_mod_rehab_contract_prepare before insert or update on public.pha_mod_rehab_contracts for each row execute function public.prepare_pha_mod_rehab_contract();

create or replace function public.prepare_pha_mod_rehab_hap_action() returns trigger language plpgsql security invoker as $$
declare c public.pha_mod_rehab_contracts%rowtype; f public.pha_family_actions%rowtype;
begin
 select * into c from public.pha_mod_rehab_contracts where id=new.contract_id;
 if not found then raise exception 'Mod Rehab contract not found'; end if;
 perform public.assert_pha_policy_overlay(c.policy_overlay_id,c.workspace_user_id,'mod_rehab','mod_rehab_policy');
 if c.source_status <> 'current' then raise exception 'Current controlled Mod Rehab authority is required'; end if;
 if new.family_action_id is not null then
   select * into f from public.pha_family_actions where id=new.family_action_id;
   if not found or f.program_code <> 'mod_rehab' then raise exception 'Mod Rehab HAP action requires a Mod Rehab family action'; end if;
 end if;
 if new.action_type='rent_adjustment_request' then
   if not (new.inspection_compliant and new.audited_financial_support and new.hud_field_office_approval) then new.status:='blocked'; new.block_reason:='Mod Rehab rent adjustment requires inspection, audited financial support, and HUD Field Office approval'; end if;
 end if;
 if new.action_type='monthly_hap' and (new.tenant_rent is null or new.hap_to_owner is null) then raise exception 'Monthly Mod Rehab HAP requires tenant rent and HAP to owner'; end if;
 if new.action_type='abatement' then new.status:='abated'; end if;
 new.source_snapshot:=jsonb_build_object('contract_reference',c.contract_reference,'base_rent',c.current_base_rent,'rehab_debt_service',c.monthly_rehab_debt_service,'contract_rent',c.current_contract_rent,'authority','24 CFR part 882 / HUD-50058 Section 13');
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_mod_rehab_hap_action_prepare before insert or update on public.pha_mod_rehab_hap_actions for each row execute function public.prepare_pha_mod_rehab_hap_action();
