-- HCV voucher issuance, RFTA, tenancy approval, lease-up and HAP controls.
-- Authority: 24 CFR 982.302, 982.305, 982.308 and related current inspection/rent controls.

create table if not exists public.pha_hcv_vouchers (
 id uuid primary key default gen_random_uuid(),
 workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
 family_action_id uuid not null references public.pha_family_actions(id) on delete cascade,
 administrative_plan_overlay_id uuid not null references public.pha_notice_policy_overlays(id),
 voucher_number text not null,
 issued_at date not null,
 expires_at date not null,
 extension_expires_at date,
 status text not null default 'issued' check (status in ('issued','searching','rfta_submitted','leased','expired','cancelled')),
 source_snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(workspace_user_id,voucher_number)
);

create table if not exists public.pha_hcv_rfta_requests (
 id uuid primary key default gen_random_uuid(),
 workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
 voucher_id uuid not null references public.pha_hcv_vouchers(id) on delete cascade,
 owner_reference text not null,unit_reference text not null,
 submitted_at timestamptz not null default now(),
 proposed_lease_start date not null,
 lease_copy_received boolean not null default false,
 tenancy_addendum_included boolean not null default false,
 unit_eligible boolean not null default false,
 inspection_id uuid references public.pha_inspections(id),
 inspection_clearance text not null default 'pending' check (inspection_clearance in ('pending','pass','nlt_option_clear','alternative_inspection_clear','fail')),
 rent_to_owner numeric(12,2) not null check (rent_to_owner>=0),
 gross_rent numeric(12,2) not null check (gross_rent>=0),
 payment_standard numeric(12,2) not null check (payment_standard>=0),
 monthly_adjusted_income numeric(12,2) not null check (monthly_adjusted_income>=0),
 family_share numeric(12,2) not null check (family_share>=0),
 rent_reasonable boolean not null default false,
 initial_assistance boolean not null default true,
 family_share_40_percent_clear boolean not null default false,
 lease_executed boolean not null default false,
 decision_status text not null default 'pending' check (decision_status in ('pending','approved','denied','blocked')),
 block_reason text,
 decided_at timestamptz,
 source_snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table if not exists public.pha_hcv_hap_contracts (
 id uuid primary key default gen_random_uuid(),
 workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
 rfta_request_id uuid not null unique references public.pha_hcv_rfta_requests(id) on delete cascade,
 lease_start date not null,
 execution_deadline date not null,
 executed_at timestamptz,
 hud_extension_requested_at timestamptz,
 hud_extension_request_reference text,
 hud_extension_approved boolean not null default false,
 hud_extension_approval_reference text,
 payment_authorized boolean not null default false,
 status text not null default 'pending' check (status in ('pending','executed','extension_requested','void','ended')),
 source_snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

alter table public.pha_hcv_vouchers enable row level security;
alter table public.pha_hcv_rfta_requests enable row level security;
alter table public.pha_hcv_hap_contracts enable row level security;
grant select,insert,update on public.pha_hcv_vouchers,public.pha_hcv_rfta_requests,public.pha_hcv_hap_contracts to authenticated;
grant all on public.pha_hcv_vouchers,public.pha_hcv_rfta_requests,public.pha_hcv_hap_contracts to service_role;

create policy "PHA HCV users read vouchers" on public.pha_hcv_vouchers for select to authenticated using (public.pha_program_access(workspace_user_id,'hcv',false));
create policy "PHA HCV users manage vouchers" on public.pha_hcv_vouchers for all to authenticated using (public.pha_program_access(workspace_user_id,'hcv',true)) with check (public.pha_program_access(workspace_user_id,'hcv',true));
create policy "PHA HCV users read RFTA" on public.pha_hcv_rfta_requests for select to authenticated using (public.pha_program_access(workspace_user_id,'hcv',false));
create policy "PHA HCV users manage RFTA" on public.pha_hcv_rfta_requests for all to authenticated using (public.pha_program_access(workspace_user_id,'hcv',true)) with check (public.pha_program_access(workspace_user_id,'hcv',true));
create policy "PHA HCV users read HAP contracts" on public.pha_hcv_hap_contracts for select to authenticated using (public.pha_program_access(workspace_user_id,'hcv',false));
create policy "PHA HCV users manage HAP contracts" on public.pha_hcv_hap_contracts for all to authenticated using (public.pha_program_access(workspace_user_id,'hcv',true)) with check (public.pha_program_access(workspace_user_id,'hcv',true));

create or replace function public.prepare_pha_hcv_voucher() returns trigger language plpgsql security invoker as $$
declare f public.pha_family_actions%rowtype;
begin
 select * into f from public.pha_family_actions where id=new.family_action_id;
 if not found or f.program_code<>'hcv' then raise exception 'HCV voucher requires an HCV family action'; end if;
 perform public.assert_pha_policy_overlay(new.administrative_plan_overlay_id,new.workspace_user_id,'hcv','administrative_plan');
 if new.expires_at<new.issued_at then raise exception 'Voucher expiration cannot precede issuance'; end if;
 if new.extension_expires_at is not null and new.extension_expires_at<new.expires_at then raise exception 'Voucher extension cannot shorten the voucher term'; end if;
 if current_date>coalesce(new.extension_expires_at,new.expires_at) and new.status not in ('leased','cancelled') then new.status:='expired'; end if;
 new.source_snapshot:=jsonb_build_object('authority','24 CFR 982.302','issued_at',new.issued_at,'expires_at',new.expires_at,'extension_expires_at',new.extension_expires_at);
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_hcv_voucher_prepare before insert or update on public.pha_hcv_vouchers for each row execute function public.prepare_pha_hcv_voucher();

create or replace function public.prepare_pha_hcv_rfta() returns trigger language plpgsql security invoker as $$
declare v public.pha_hcv_vouchers%rowtype; i public.pha_inspections%rowtype; term_end date; max_share numeric(12,2);
begin
 select * into v from public.pha_hcv_vouchers where id=new.voucher_id;
 if not found then raise exception 'HCV voucher not found'; end if;
 if v.workspace_user_id<>new.workspace_user_id then raise exception 'HCV RFTA workspace mismatch'; end if;
 term_end:=coalesce(v.extension_expires_at,v.expires_at);
 if new.submitted_at::date<v.issued_at or new.submitted_at::date>term_end then raise exception 'RFTA must be submitted during the voucher term'; end if;
 if new.inspection_id is not null then
   select * into i from public.pha_inspections where id=new.inspection_id and workspace_user_id=new.workspace_user_id and program_code='hcv';
   if not found then raise exception 'RFTA inspection must be an HCV inspection in the same workspace'; end if;
 end if;
 max_share:=round(new.monthly_adjusted_income*0.40,2);
 new.family_share_40_percent_clear:=not(new.initial_assistance and new.gross_rent>new.payment_standard) or new.family_share<=max_share;
 if new.decision_status='approved' then
   if not new.unit_eligible then raise exception 'HCV tenancy approval requires eligible unit'; end if;
   if new.inspection_clearance not in ('pass','nlt_option_clear','alternative_inspection_clear') then raise exception 'HCV tenancy approval requires controlled initial inspection clearance'; end if;
   if not new.lease_copy_received or not new.tenancy_addendum_included then raise exception 'HCV tenancy approval requires lease copy and HUD tenancy addendum'; end if;
   if not new.rent_reasonable then raise exception 'HCV tenancy approval requires rent reasonableness'; end if;
   if not new.family_share_40_percent_clear then raise exception 'Initial HCV family share exceeds 40 percent of monthly adjusted income'; end if;
   if not new.lease_executed then raise exception 'HCV lease must be executed before assisted tenancy approval'; end if;
   new.decided_at:=coalesce(new.decided_at,now()); new.block_reason:=null;
 else
   if not new.unit_eligible then new.decision_status:='blocked'; new.block_reason:='Unit eligibility unresolved';
   elsif new.inspection_clearance in ('pending','fail') then new.decision_status:='blocked'; new.block_reason:='Initial inspection clearance unresolved';
   elsif not new.rent_reasonable then new.decision_status:='blocked'; new.block_reason:='Rent reasonableness unresolved';
   elsif not new.family_share_40_percent_clear then new.decision_status:='blocked'; new.block_reason:='Initial family-share cap unresolved'; end if;
 end if;
 new.source_snapshot:=jsonb_build_object('authority','24 CFR 982.305','voucher_id',v.id,'voucher_term_end',term_end,'inspection_clearance',new.inspection_clearance,'rent_reasonable',new.rent_reasonable,'family_share_40_percent_clear',new.family_share_40_percent_clear);
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_hcv_rfta_prepare before insert or update on public.pha_hcv_rfta_requests for each row execute function public.prepare_pha_hcv_rfta();

create or replace function public.prepare_pha_hcv_hap_contract() returns trigger language plpgsql security invoker as $$
declare r public.pha_hcv_rfta_requests%rowtype;
begin
 select * into r from public.pha_hcv_rfta_requests where id=new.rfta_request_id and workspace_user_id=new.workspace_user_id;
 if not found then raise exception 'HCV RFTA request not found'; end if;
 if r.decision_status<>'approved' then raise exception 'HCV HAP contract requires approved assisted tenancy'; end if;
 new.lease_start:=r.proposed_lease_start;
 new.execution_deadline:=new.lease_start+60;
 if new.executed_at is not null then
   if new.executed_at::date<=new.execution_deadline then new.status:='executed'; new.payment_authorized:=true;
   elsif new.hud_extension_approved and coalesce(trim(new.hud_extension_approval_reference),'')<>'' then new.status:='executed'; new.payment_authorized:=true;
   else new.status:='void'; new.payment_authorized:=false; end if;
 elsif current_date>new.execution_deadline then
   if new.hud_extension_requested_at is not null and new.hud_extension_requested_at::date<=new.execution_deadline+14 and coalesce(trim(new.hud_extension_request_reference),'')<>'' then new.status:='extension_requested';
   else new.status:='void'; end if; new.payment_authorized:=false;
 else new.status:='pending'; new.payment_authorized:=false; end if;
 new.source_snapshot:=jsonb_build_object('authority','24 CFR 982.305(c)','lease_start',new.lease_start,'execution_deadline',new.execution_deadline,'hud_extension_approved',new.hud_extension_approved,'payment_authorized',new.payment_authorized);
 new.updated_at:=now(); return new;
end; $$;
create trigger pha_hcv_hap_contract_prepare before insert or update on public.pha_hcv_hap_contracts for each row execute function public.prepare_pha_hcv_hap_contract();
