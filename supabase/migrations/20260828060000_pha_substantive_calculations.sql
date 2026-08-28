-- Deterministic PHA household calculation snapshots and fail-closed workflow gate.

create table if not exists public.pha_family_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  family_action_id uuid not null references public.pha_family_actions(id) on delete cascade,
  program_code text not null check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  annual_income numeric(14,2) not null check (annual_income >= 0),
  deductions numeric(14,2) not null default 0 check (deductions >= 0),
  minimum_rent numeric(14,2) not null default 0 check (minimum_rent >= 0),
  utility_allowance numeric(14,2) not null default 0 check (utility_allowance >= 0),
  welfare_housing_amount numeric(14,2) check (welfare_housing_amount >= 0),
  payment_standard numeric(14,2) check (payment_standard >= 0),
  gross_rent numeric(14,2) check (gross_rent >= 0),
  rent_to_owner numeric(14,2) check (rent_to_owner >= 0),
  public_housing_rent_choice text check (public_housing_rent_choice in ('income_based','flat_rent')),
  flat_rent_amount numeric(14,2) check (flat_rent_amount >= 0),
  alternative_non_public_housing_rent_applicable boolean not null default false,
  alternative_non_public_housing_rent numeric(14,2) check (alternative_non_public_housing_rent >= 0),
  adjusted_income numeric(14,2),
  monthly_income numeric(14,2),
  monthly_adjusted_income numeric(14,2),
  total_tenant_payment numeric(14,2),
  ttp_basis text,
  housing_assistance_payment numeric(14,2),
  family_share numeric(14,2),
  tenant_rent numeric(14,2),
  utility_reimbursement numeric(14,2),
  calculation_status text not null default 'pending' check (calculation_status in ('pending','validated','blocked')),
  reason_code text,
  reason text,
  engine_build text not null default 'pha-family-calculation-engine-2026.08.2',
  calculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_action_id)
);

alter table public.pha_family_calculations enable row level security;
create policy "Users manage own PHA family calculations" on public.pha_family_calculations
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.calculate_pha_family_determination()
returns trigger language plpgsql security invoker as $$
declare
  evidence_conflict boolean := false;
  source_conflict boolean := false;
  adjusted numeric(14,2);
  monthly numeric(14,2);
  monthly_adjusted numeric(14,2);
  c30 numeric(14,2);
  c10 numeric(14,2);
  cwelfare numeric(14,2);
  cminimum numeric(14,2);
  coverincome numeric(14,2);
  ttp numeric(14,2);
  basis text;
  hap numeric(14,2);
  pbv_tenant_rent numeric(14,2);
begin
  select a.source_status_conflict,
         exists (
           select 1 from public.pha_family_evidence e
           where e.family_action_id = new.family_action_id
             and e.user_id = new.user_id
             and e.conflict_detected = true
         )
    into source_conflict, evidence_conflict
    from public.pha_family_actions a
   where a.id = new.family_action_id and a.user_id = new.user_id;

  new.updated_at := now();
  new.calculated_at := now();
  new.engine_build := 'pha-family-calculation-engine-2026.08.2';
  new.adjusted_income := null;
  new.monthly_income := null;
  new.monthly_adjusted_income := null;
  new.total_tenant_payment := null;
  new.ttp_basis := null;
  new.housing_assistance_payment := null;
  new.family_share := null;
  new.tenant_rent := null;
  new.utility_reimbursement := null;

  if source_conflict or evidence_conflict then
    new.calculation_status := 'blocked';
    new.reason_code := 'PHA_CALC_EVIDENCE_CONFLICT';
    new.reason := 'Conflicting evidence or source status must be resolved before calculation can be validated.';
    return new;
  end if;

  adjusted := greatest(new.annual_income - new.deductions, 0);
  monthly := new.annual_income / 12;
  monthly_adjusted := adjusted / 12;
  c30 := round(monthly_adjusted * 0.30);
  c10 := round(monthly * 0.10);
  cminimum := round(new.minimum_rent);
  cwelfare := case when new.welfare_housing_amount is null then null else round(new.welfare_housing_amount) end;

  if new.program_code = 'public_housing'
     and new.alternative_non_public_housing_rent_applicable
     and new.alternative_non_public_housing_rent is null then
    new.calculation_status := 'blocked';
    new.reason_code := 'PHA_CALC_PUBLIC_HOUSING_OVER_INCOME_RENT_REQUIRED';
    new.reason := 'Alternative non-public housing rent is required when the over-income rent path applies.';
    return new;
  end if;

  coverincome := case
    when new.program_code = 'public_housing' and new.alternative_non_public_housing_rent_applicable
    then round(new.alternative_non_public_housing_rent)
    else null end;

  ttp := greatest(c30, c10, cminimum, coalesce(cwelfare, 0), coalesce(coverincome, 0));
  basis := case
    when coverincome is not null and coverincome = ttp then 'ALTERNATIVE_NON_PUBLIC_HOUSING_RENT'
    when cwelfare is not null and cwelfare = ttp then 'WELFARE_HOUSING_AMOUNT'
    when cminimum = ttp then 'MINIMUM_RENT'
    when c10 = ttp then '10_PERCENT_MONTHLY_INCOME'
    else '30_PERCENT_MONTHLY_ADJUSTED_INCOME'
  end;

  new.adjusted_income := round(adjusted, 2);
  new.monthly_income := round(monthly, 2);
  new.monthly_adjusted_income := round(monthly_adjusted, 2);
  new.total_tenant_payment := ttp;
  new.ttp_basis := basis;

  if new.program_code = 'hcv' then
    if new.payment_standard is null or new.gross_rent is null then
      new.calculation_status := 'blocked';
      new.reason_code := 'PHA_CALC_HCV_RENT_INPUT_REQUIRED';
      new.reason := 'Payment standard and gross rent are required for tenant-based HCV housing assistance.';
      return new;
    end if;
    hap := greatest(least(new.payment_standard - ttp, new.gross_rent - ttp), 0);
    new.housing_assistance_payment := round(hap, 2);
    new.family_share := round(greatest(new.gross_rent - hap, 0), 2);
    new.calculation_status := 'validated';
    new.reason_code := null;
    new.reason := null;
    return new;
  end if;

  if new.program_code = 'pbv' then
    if new.rent_to_owner is null then
      new.calculation_status := 'blocked';
      new.reason_code := 'PHA_CALC_PBV_RENT_TO_OWNER_REQUIRED';
      new.reason := 'The controlled PBV rent to owner is required before tenant rent and HAP can be validated.';
      return new;
    end if;
    pbv_tenant_rent := greatest(ttp - new.utility_allowance, 0);
    new.tenant_rent := pbv_tenant_rent;
    new.utility_reimbursement := greatest(new.utility_allowance - ttp, 0);
    new.housing_assistance_payment := greatest(new.rent_to_owner - pbv_tenant_rent, 0);
    new.calculation_status := 'validated';
    new.reason_code := null;
    new.reason := null;
    return new;
  end if;

  if new.program_code = 'public_housing' then
    if new.public_housing_rent_choice is null then
      new.calculation_status := 'blocked';
      new.reason_code := 'PHA_CALC_PUBLIC_HOUSING_RENT_CHOICE_REQUIRED';
      new.reason := 'Public Housing requires a documented income-based or flat-rent choice.';
      return new;
    end if;
    if new.public_housing_rent_choice = 'flat_rent' then
      if new.flat_rent_amount is null then
        new.calculation_status := 'blocked';
        new.reason_code := 'PHA_CALC_FLAT_RENT_REQUIRED';
        new.reason := 'The current utility-adjusted flat rent amount is required.';
        return new;
      end if;
      new.tenant_rent := greatest(new.flat_rent_amount, new.minimum_rent);
      new.utility_reimbursement := 0;
    else
      new.tenant_rent := greatest(ttp - new.utility_allowance, 0);
      new.utility_reimbursement := greatest(new.utility_allowance - ttp, 0);
    end if;
    new.calculation_status := 'validated';
    new.reason_code := null;
    new.reason := null;
    return new;
  end if;

  new.calculation_status := 'blocked';
  new.reason_code := 'PHA_CALC_MOD_REHAB_RENT_MODULE_PENDING';
  new.reason := 'Income and TTP are calculated, but the Mod Rehab program-specific rent module is required before validation.';
  return new;
end;
$$;

create trigger pha_family_calculation_before_write
before insert or update on public.pha_family_calculations
for each row execute function public.calculate_pha_family_determination();

create or replace function public.sync_pha_family_action_readiness()
returns trigger language plpgsql security invoker as $$
declare
  calculation_validated boolean := false;
  evidence_conflict boolean := false;
begin
  select exists (
           select 1 from public.pha_family_calculations c
            where c.family_action_id = new.id
              and c.user_id = new.user_id
              and c.calculation_status = 'validated'
         ),
         exists (
           select 1 from public.pha_family_evidence e
            where e.family_action_id = new.id
              and e.user_id = new.user_id
              and e.conflict_detected = true
         )
    into calculation_validated, evidence_conflict;

  new.calculation_complete := calculation_validated;

  if evidence_conflict or new.source_status_conflict then
    new.workflow_status := 'blocked';
  elsif new.workflow_status <> 'routed' then
    if new.verification_complete
       and new.eiv_review_complete
       and new.calculation_complete
       and new.notice_complete then
      new.workflow_status := 'ready_to_route';
    elsif new.calculation_complete then
      new.workflow_status := 'notice';
    elsif new.verification_complete and new.eiv_review_complete then
      new.workflow_status := 'calculation';
    elsif new.workflow_status <> 'intake' then
      new.workflow_status := 'verification';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.refresh_pha_family_action_from_calculation()
returns trigger language plpgsql security invoker as $$
begin
  update public.pha_family_actions
     set calculation_complete = (new.calculation_status = 'validated'),
         workflow_status = case
           when new.calculation_status = 'blocked' then 'blocked'
           when workflow_status = 'blocked' and new.calculation_status = 'validated' then 'calculation'
           else workflow_status
         end,
         updated_at = now()
   where id = new.family_action_id and user_id = new.user_id;
  return null;
end;
$$;

create trigger pha_family_calculation_after_write
after insert or update on public.pha_family_calculations
for each row execute function public.refresh_pha_family_action_from_calculation();

create or replace function public.refresh_pha_family_action_from_evidence()
returns trigger language plpgsql security invoker as $$
declare
  action_id uuid := coalesce(new.family_action_id, old.family_action_id);
  owner_id uuid := coalesce(new.user_id, old.user_id);
  has_conflict boolean := false;
begin
  select exists (
    select 1 from public.pha_family_evidence e
     where e.family_action_id = action_id
       and e.user_id = owner_id
       and e.conflict_detected = true
  ) into has_conflict;

  update public.pha_family_actions
     set workflow_status = case when has_conflict then 'blocked' else workflow_status end,
         updated_at = now()
   where id = action_id and user_id = owner_id;

  update public.pha_family_calculations
     set updated_at = now()
   where family_action_id = action_id and user_id = owner_id;
  return null;
end;
$$;

create trigger pha_family_evidence_recalculate_after_write
after insert or update or delete on public.pha_family_evidence
for each row execute function public.refresh_pha_family_action_from_evidence();
