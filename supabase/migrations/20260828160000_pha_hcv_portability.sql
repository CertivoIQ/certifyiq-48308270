-- HCV portability workflow grounded in 24 CFR 982.353-.355 and HUD-52665.
-- Portability is HCV tenant-based assistance only. Non-HCV family actions fail closed.

create table if not exists public.pha_portability_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null default public.current_pha_workspace_user_id() references auth.users(id) on delete cascade,
  family_action_id uuid not null references public.pha_family_actions(id) on delete cascade,
  direction text not null default 'outgoing' check (direction in ('outgoing','incoming')),
  family_status text not null default 'participant' check (family_status in ('applicant','participant')),
  requested_destination text not null,
  family_request_date date not null,
  initial_pha_name text,
  initial_pha_contact text,
  receiving_pha_name text,
  receiving_pha_contact text,
  receiving_pha_selected_by text check (receiving_pha_selected_by in ('family','initial_pha')),
  move_eligibility_status text not null default 'pending' check (move_eligibility_status in ('pending','eligible','ineligible')),
  nonresident_first_12_months boolean not null default false,
  initial_pha_early_portability_approval boolean not null default false,
  vawa_portability_exception boolean not null default false,
  income_redetermination_required boolean not null default false,
  receiving_pha_contacted_at timestamptz,
  receiving_pha_contact_delivery_reference text,
  absorption_decision text not null default 'pending' check (absorption_decision in ('pending','absorb','bill')),
  absorption_decision_received_at timestamptz,
  absorption_decision_reference text,
  absorption_reversal_consent_reference text,
  voucher_issued_for_move boolean not null default false,
  hud_52665_part_i_complete boolean not null default false,
  hud_52665_reference text,
  hud_50058_reference text,
  verification_packet_reference text,
  packet_sent_at timestamptz,
  packet_delivery_reference text,
  special_purpose_voucher_code text,
  status text not null default 'requested' check (status in ('requested','eligibility_review','receiving_pha_contact','decision_received','packet_ready','sent','active','closed','blocked')),
  authority_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(family_action_id)
);

create table if not exists public.pha_portability_billing (
  id uuid primary key default gen_random_uuid(),
  portability_case_id uuid not null unique references public.pha_portability_cases(id) on delete cascade,
  initial_pha_admin_fee numeric(12,2),
  receiving_pha_admin_fee numeric(12,2),
  agreed_admin_fee numeric(12,2),
  calculated_admin_fee numeric(12,2),
  monthly_hap numeric(12,2),
  billing_start_date date,
  initial_billing_due_date date,
  reimbursement_status text not null default 'not_applicable' check (reimbursement_status in ('not_applicable','pending','current','delinquent','closed')),
  financial_procedure_source_status text not null default 'pending_source' check (financial_procedure_source_status in ('current','pending_source','superseded')),
  billing_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pha_portability_cases enable row level security;
alter table public.pha_portability_billing enable row level security;
grant select, insert, update, delete on public.pha_portability_cases, public.pha_portability_billing to authenticated;
grant all on public.pha_portability_cases, public.pha_portability_billing to service_role;

create policy "PHA HCV users read portability cases" on public.pha_portability_cases
for select to authenticated using (public.pha_program_access(workspace_user_id, 'hcv', false));
create policy "PHA HCV users write portability cases" on public.pha_portability_cases
for all to authenticated using (public.pha_program_access(workspace_user_id, 'hcv', true)) with check (public.pha_program_access(workspace_user_id, 'hcv', true));
create policy "PHA HCV users read portability billing" on public.pha_portability_billing
for select to authenticated using (exists (select 1 from public.pha_portability_cases c where c.id = portability_case_id and public.pha_program_access(c.workspace_user_id, 'hcv', false)));
create policy "PHA HCV admins write portability billing" on public.pha_portability_billing
for all to authenticated using (exists (select 1 from public.pha_portability_cases c where c.id = portability_case_id and public.pha_program_access(c.workspace_user_id, 'hcv', true)))
with check (exists (select 1 from public.pha_portability_cases c where c.id = portability_case_id and public.pha_program_access(c.workspace_user_id, 'hcv', true)));

create or replace function public.enforce_hcv_portability_family_action()
returns trigger language plpgsql security invoker as $$
begin
  if new.action_type = 'portability' and new.program_code <> 'hcv' then
    raise exception 'Portability family actions are supported only for HCV tenant-based assistance';
  end if;
  return new;
end;
$$;
drop trigger if exists pha_family_action_hcv_portability_before_write on public.pha_family_actions;
create trigger pha_family_action_hcv_portability_before_write
before insert or update on public.pha_family_actions
for each row execute function public.enforce_hcv_portability_family_action();

create or replace function public.prepare_pha_portability_case()
returns trigger language plpgsql security invoker as $$
declare action_row public.pha_family_actions%rowtype; prior_decision text;
begin
  select * into action_row from public.pha_family_actions where id = new.family_action_id and user_id = new.workspace_user_id;
  if not found then raise exception 'Portability case requires a family action in the same PHA workspace'; end if;
  if action_row.program_code <> 'hcv' or action_row.action_type <> 'portability' then
    raise exception 'Portability case requires an HCV portability family action';
  end if;

  -- A current participant does not undergo a new income-eligibility determination merely because of portability.
  if new.family_status = 'participant' then new.income_redetermination_required := false; end if;

  if new.family_status = 'applicant' and new.nonresident_first_12_months
     and not new.initial_pha_early_portability_approval and not new.vawa_portability_exception then
    new.move_eligibility_status := 'ineligible';
  end if;

  if new.move_eligibility_status = 'eligible' and (new.receiving_pha_name is null or new.receiving_pha_selected_by is null) then
    raise exception 'Eligible portability case requires a selected receiving PHA';
  end if;

  if tg_op = 'UPDATE' then
    prior_decision := old.absorption_decision;
    if prior_decision = 'absorb' and new.absorption_decision <> 'absorb' and new.absorption_reversal_consent_reference is null then
      raise exception 'Receiving PHA absorption decision cannot be reversed without initial PHA consent';
    end if;
  end if;

  if new.absorption_decision <> 'pending' then
    if new.receiving_pha_contacted_at is null or new.receiving_pha_contact_delivery_reference is null then
      raise exception 'Absorb or bill decision requires confirmed receiving-PHA contact';
    end if;
    if new.absorption_decision_received_at is null or new.absorption_decision_reference is null then
      raise exception 'Absorb or bill decision requires written receiving-PHA confirmation';
    end if;
  end if;

  if new.status in ('packet_ready','sent','active','closed') then
    if new.move_eligibility_status <> 'eligible' then raise exception 'Eligible move determination is required before portability packet release'; end if;
    if new.absorption_decision = 'pending' then raise exception 'Receiving PHA absorb or bill decision is required before portability packet release'; end if;
    if not new.voucher_issued_for_move then raise exception 'Voucher for the portability move must be issued before packet release'; end if;
    if not new.hud_52665_part_i_complete or new.hud_52665_reference is null then raise exception 'HUD-52665 Part I is required before portability packet release'; end if;
    if new.hud_50058_reference is null or new.verification_packet_reference is null then raise exception 'Current HUD-50058 and related verification packet are required before portability packet release'; end if;
  end if;

  if new.status in ('sent','active','closed') and (new.packet_sent_at is null or new.packet_delivery_reference is null) then
    raise exception 'Confirmed portability packet delivery is required before sent or active status';
  end if;

  new.authority_snapshot := jsonb_build_object(
    'portability_scope','HCV tenant-based assistance only',
    'eligibility_authority','24 CFR 982.353',
    'administration_authority','24 CFR 982.355',
    'participant_income_redetermination',case when new.family_status='participant' then 'not required merely due to portability' else 'applicant admission rules apply' end,
    'receiving_pha_selection',new.receiving_pha_selected_by,
    'absorption_decision',new.absorption_decision,
    'hud_52665_required',true,
    'hud_50058_required',true,
    'special_purpose_voucher_code',new.special_purpose_voucher_code
  );

  new.status := case
    when new.status in ('sent','active','closed','blocked') then new.status
    when new.hud_52665_part_i_complete and new.hud_50058_reference is not null and new.verification_packet_reference is not null and new.voucher_issued_for_move and new.absorption_decision <> 'pending' then 'packet_ready'
    when new.absorption_decision <> 'pending' then 'decision_received'
    when new.receiving_pha_contacted_at is not null then 'receiving_pha_contact'
    when new.move_eligibility_status <> 'pending' then 'eligibility_review'
    else 'requested' end;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists pha_portability_case_prepare_before_write on public.pha_portability_cases;
create trigger pha_portability_case_prepare_before_write before insert or update on public.pha_portability_cases
for each row execute function public.prepare_pha_portability_case();

create or replace function public.prepare_pha_portability_billing()
returns trigger language plpgsql security invoker as $$
declare case_row public.pha_portability_cases%rowtype; eighty_percent numeric(12,2);
begin
  select * into case_row from public.pha_portability_cases where id = new.portability_case_id;
  if not found then raise exception 'Portability case not found'; end if;
  if case_row.absorption_decision <> 'bill' then
    new.reimbursement_status := 'not_applicable';
    new.calculated_admin_fee := null;
  else
    if new.initial_pha_admin_fee is not null and new.receiving_pha_admin_fee is not null then
      eighty_percent := round(new.initial_pha_admin_fee * 0.80, 2);
      new.calculated_admin_fee := coalesce(new.agreed_admin_fee, least(eighty_percent, new.receiving_pha_admin_fee));
    end if;
    if new.financial_procedure_source_status <> 'current' then
      new.reimbursement_status := 'pending';
    elsif new.reimbursement_status = 'not_applicable' then new.reimbursement_status := 'pending'; end if;
  end if;
  new.billing_snapshot := jsonb_build_object(
    'authority','24 CFR 982.355(e)',
    'hap_reimbursement','full HAP paid by receiving PHA',
    'administrative_fee_rule','lesser of 80% initial ongoing fee or 100% receiving ongoing fee unless mutually agreed otherwise',
    'calculated_admin_fee',new.calculated_admin_fee,
    'financial_procedure_source_status',new.financial_procedure_source_status
  );
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists pha_portability_billing_prepare_before_write on public.pha_portability_billing;
create trigger pha_portability_billing_prepare_before_write before insert or update on public.pha_portability_billing
for each row execute function public.prepare_pha_portability_billing();
