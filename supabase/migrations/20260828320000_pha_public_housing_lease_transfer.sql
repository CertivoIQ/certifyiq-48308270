-- Public Housing occupancy lease and transfer operations.
-- Authority: current 24 CFR 966.4 lease requirements and 24 CFR 960.202(a)(2)(v) PHA transfer policy requirement.

create table if not exists public.pha_public_housing_leases (
 id uuid primary key default gen_random_uuid(),
 workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
 family_action_id uuid not null references public.pha_family_actions(id) on delete cascade,
 acop_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
 unit_reference text not null,
 tenant_reference text not null,
 lease_start date not null,
 lease_term_months integer not null default 12 check (lease_term_months>0),
 month_to_month_over_income boolean not null default false,
 household_composition_confirmed boolean not null default false,
 utilities_and_appliances_terms_confirmed boolean not null default false,
 grievance_procedure_included boolean not null default false,
 pha_obligations_included boolean not null default false,
 tenant_obligations_included boolean not null default false,
 vawa_provisions_included boolean not null default false,
 signature_clause_included boolean not null default false,
 tenant_signed_at timestamptz,
 pha_signed_at timestamptz,
 status text not null default 'draft' check (status in ('draft','ready','active','month_to_month_over_income','ended','blocked')),
 block_reason text,
 source_snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(workspace_user_id,family_action_id,unit_reference,lease_start)
);

create table if not exists public.pha_public_housing_transfer_requests (
 id uuid primary key default gen_random_uuid(),
 workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
 lease_id uuid not null references public.pha_public_housing_leases(id) on delete cascade,
 acop_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
 transfer_type text not null check (transfer_type in ('administrative','voluntary','reasonable_accommodation','vawa_emergency','accessibility','under_occupied','over_occupied','other')),
 requested_at timestamptz not null default now(),
 reason text not null,
 policy_eligibility_confirmed boolean not null default false,
 reasonable_accommodation_request_id uuid references public.pha_reasonable_accommodation_requests(id),
 current_unit_reference text not null,
 target_unit_reference text,
 target_development_reference text,
 target_accessibility_features text[] not null default '{}',
 priority_reason text,
 status text not null default 'pending' check (status in ('pending','eligible','unit_search','offered','completed','denied','blocked')),
 denial_reason text,
 source_snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

alter table public.pha_public_housing_leases enable row level security;
alter table public.pha_public_housing_transfer_requests enable row level security;
grant select,insert,update on public.pha_public_housing_leases,public.pha_public_housing_transfer_requests to authenticated;
grant all on public.pha_public_housing_leases,public.pha_public_housing_transfer_requests to service_role;
create policy "PHA PH users read leases" on public.pha_public_housing_leases for select to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',false));
create policy "PHA PH users manage leases" on public.pha_public_housing_leases for all to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',true)) with check (public.pha_program_access(workspace_user_id,'public_housing',true));
create policy "PHA PH users read transfers" on public.pha_public_housing_transfer_requests for select to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',false));
create policy "PHA PH users manage transfers" on public.pha_public_housing_transfer_requests for all to authenticated using (public.pha_program_access(workspace_user_id,'public_housing',true)) with check (public.pha_program_access(workspace_user_id,'public_housing',true));

create or replace function public.prepare_pha_ph_lease() returns trigger language plpgsql security invoker as $$
declare f public.pha_family_actions%rowtype;
begin
 select * into f from public.pha_family_actions where id=new.family_action_id;
 if not found or f.program_code<>'public_housing' then raise exception 'Public Housing lease requires a Public Housing family action'; end if;
 perform public.assert_pha_policy_overlay(new.acop_overlay_id,new.workspace_user_id,'public_housing','acop');
 if new.month_to_month_over_income then new.lease_term_months:=1; new.status:='month_to_month_over_income';
 elsif new.lease_term_months<>12 then raise exception 'Standard Public Housing lease must use a twelve-month term'; end if;
 if new.status in ('ready','active','month_to_month_over_income') then
   if not (new.household_composition_confirmed and new.utilities_and_appliances_terms_confirmed and new.grievance_procedure_included and new.pha_obligations_included and new.tenant_obligations_included and new.vawa_provisions_included and new.signature_clause_included) then raise exception 'Public Housing lease required provisions are incomplete'; end if;
   if new.tenant_signed_at is null or new.pha_signed_at is null then raise exception 'Public Housing lease requires tenant and PHA execution'; end if;
   if not new.month_to_month_over_income then new.status:='active'; end if;
 end if;
 new.source_snapshot:=jsonb_build_object('authority','24 CFR 966.4','lease_start',new.lease_start,'term_months',new.lease_term_months,'month_to_month_over_income',new.month_to_month_over_income);
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_ph_lease_prepare before insert or update on public.pha_public_housing_leases for each row execute function public.prepare_pha_ph_lease();

create or replace function public.prepare_pha_ph_transfer() returns trigger language plpgsql security invoker as $$
declare l public.pha_public_housing_leases%rowtype; ra public.pha_reasonable_accommodation_requests%rowtype;
begin
 select * into l from public.pha_public_housing_leases where id=new.lease_id and workspace_user_id=new.workspace_user_id;
 if not found or l.status not in ('active','month_to_month_over_income') then raise exception 'Public Housing transfer requires an active occupancy lease'; end if;
 perform public.assert_pha_policy_overlay(new.acop_overlay_id,new.workspace_user_id,'public_housing','acop');
 new.current_unit_reference:=l.unit_reference;
 if new.transfer_type='reasonable_accommodation' then
   if new.reasonable_accommodation_request_id is null then raise exception 'Reasonable-accommodation transfer requires the accommodation request'; end if;
   select * into ra from public.pha_reasonable_accommodation_requests where id=new.reasonable_accommodation_request_id and workspace_user_id=new.workspace_user_id and program_code='public_housing' and status in ('approved','approved_alternative','completed');
   if not found then raise exception 'Reasonable-accommodation transfer requires an approved Public Housing accommodation'; end if;
 end if;
 if new.status in ('eligible','unit_search','offered','completed') and not new.policy_eligibility_confirmed then raise exception 'Public Housing transfer requires ACOP policy eligibility confirmation'; end if;
 if new.status='offered' and coalesce(trim(new.target_unit_reference),'')='' then raise exception 'Public Housing transfer offer requires target unit'; end if;
 if new.status='denied' and coalesce(trim(new.denial_reason),'')='' then raise exception 'Denied Public Housing transfer requires a documented reason'; end if;
 new.source_snapshot:=jsonb_build_object('authority','24 CFR 960.202(a)(2)(v) / 24 CFR 966.4','lease_id',l.id,'transfer_type',new.transfer_type,'policy_eligibility_confirmed',new.policy_eligibility_confirmed,'target_unit',new.target_unit_reference);
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_ph_transfer_prepare before insert or update on public.pha_public_housing_transfer_requests for each row execute function public.prepare_pha_ph_transfer();
