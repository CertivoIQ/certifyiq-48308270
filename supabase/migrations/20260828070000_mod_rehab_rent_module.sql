-- Dedicated Section 8 Moderate Rehabilitation rent-assistance calculation path.
-- Controlled by HUD-50058 Section 13 inputs and fail-closed source validation.

alter table public.pha_family_calculations
  add column if not exists mod_rehab_source_validated boolean not null default false,
  add column if not exists current_base_rent numeric(14,2) check (current_base_rent >= 0),
  add column if not exists rehab_debt_service numeric(14,2) check (rehab_debt_service >= 0),
  add column if not exists contract_rent_to_owner numeric(14,2),
  add column if not exists normal_total_hap numeric(14,2),
  add column if not exists mixed_family_proration_applicable boolean not null default false,
  add column if not exists eligible_family_members integer check (eligible_family_members >= 0),
  add column if not exists total_family_members integer check (total_family_members > 0),
  add column if not exists proration_percentage numeric(10,6),
  add column if not exists prorated_total_hap numeric(14,2),
  add column if not exists mixed_family_total_tenant_payment numeric(14,2);

alter table public.pha_family_calculations
  alter column engine_build set default 'pha-family-calculation-engine-2026.08.3';

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
  tenant_rent_calc numeric(14,2);
  mod_contract_rent numeric(14,2);
  mod_gross_rent numeric(14,2);
  mod_normal_hap numeric(14,2);
  mod_proration numeric(10,6);
  mod_prorated_hap numeric(14,2);
  mod_mixed_ttp numeric(14,2);
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
  new.engine_build := 'pha-family-calculation-engine-2026.08.3';
  new.adjusted_income := null;
  new.monthly_income := null;
  new.monthly_adjusted_income := null;
  new.total_tenant_payment := null;
  new.ttp_basis := null;
  new.housing_assistance_payment := null;
  new.family_share := null;
  new.tenant_rent := null;
  new.utility_reimbursement := null;
  new.contract_rent_to_owner := null;
  new.normal_total_hap := null;
  new.proration_percentage := null;
  new.prorated_total_hap := null;
  new.mixed_family_total_tenant_payment := null;

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
    tenant_rent_calc := greatest(ttp - new.utility_allowance, 0);
    new.tenant_rent := tenant_rent_calc;
    new.utility_reimbursement := greatest(new.utility_allowance - ttp, 0);
    new.housing_assistance_payment := greatest(new.rent_to_owner - tenant_rent_calc, 0);
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

  -- Section 8 Moderate Rehabilitation. HUD-50058 Section 13:
  -- contract rent to owner = current base rent + rehab debt service;
  -- gross rent = contract rent to owner + utility allowance;
  -- tenant rent = TTP - utility allowance (or utility reimbursement when negative);
  -- HAP to owner = contract rent to owner - tenant rent.
  if not new.mod_rehab_source_validated then
    new.calculation_status := 'blocked';
    new.reason_code := 'PHA_CALC_MOD_REHAB_SOURCE_REQUIRED';
    new.reason := 'The controlled Mod Rehab HAP/rent source must be validated before the program-specific calculation can run.';
    return new;
  end if;

  if new.current_base_rent is null or new.rehab_debt_service is null then
    new.calculation_status := 'blocked';
    new.reason_code := 'PHA_CALC_MOD_REHAB_RENT_INPUT_REQUIRED';
    new.reason := 'Current base rent and monthly rehabilitation debt service are required for Mod Rehab.';
    return new;
  end if;

  mod_contract_rent := new.current_base_rent + new.rehab_debt_service;
  mod_gross_rent := mod_contract_rent + new.utility_allowance;
  mod_normal_hap := greatest(mod_gross_rent - ttp, 0);
  new.contract_rent_to_owner := round(mod_contract_rent, 2);
  new.gross_rent := round(mod_gross_rent, 2);
  new.normal_total_hap := round(mod_normal_hap, 2);

  if new.mixed_family_proration_applicable then
    if new.eligible_family_members is null or new.total_family_members is null then
      new.calculation_status := 'blocked';
      new.reason_code := 'PHA_CALC_MOD_REHAB_MIXED_FAMILY_INPUT_REQUIRED';
      new.reason := 'Eligible and total family-member counts are required for Mod Rehab mixed-family proration.';
      return new;
    end if;
    if new.total_family_members <= 0 or new.eligible_family_members < 0 or new.eligible_family_members > new.total_family_members then
      new.calculation_status := 'blocked';
      new.reason_code := 'PHA_CALC_INVALID_MOD_REHAB_MIXED_FAMILY_COUNTS';
      new.reason := 'Mixed-family member counts must be valid and eligible members cannot exceed total family members.';
      return new;
    end if;
    mod_proration := new.eligible_family_members::numeric / new.total_family_members::numeric;
    mod_prorated_hap := mod_normal_hap * mod_proration;
    mod_mixed_ttp := mod_gross_rent - mod_prorated_hap;
    tenant_rent_calc := greatest(mod_mixed_ttp - new.utility_allowance, 0);
    new.proration_percentage := round(mod_proration, 6);
    new.prorated_total_hap := round(mod_prorated_hap, 2);
    new.mixed_family_total_tenant_payment := round(mod_mixed_ttp, 2);
    new.tenant_rent := round(tenant_rent_calc, 2);
    new.utility_reimbursement := round(greatest(new.utility_allowance - mod_mixed_ttp, 0), 2);
    new.housing_assistance_payment := round(greatest(mod_contract_rent - tenant_rent_calc, 0), 2);
  else
    tenant_rent_calc := greatest(ttp - new.utility_allowance, 0);
    new.tenant_rent := round(tenant_rent_calc, 2);
    new.utility_reimbursement := round(greatest(new.utility_allowance - ttp, 0), 2);
    new.housing_assistance_payment := round(greatest(mod_contract_rent - tenant_rent_calc, 0), 2);
  end if;

  new.calculation_status := 'validated';
  new.reason_code := null;
  new.reason := null;
  return new;
end;
$$;
