export const PHA_FAMILY_CALCULATION_ENGINE_BUILD = "pha-family-calculation-engine-2026.08.2";

const SUPPORTED_PROGRAMS = new Set(["hcv", "pbv", "public_housing", "mod_rehab"]);

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function wholeDollar(value) {
  return Math.round(Number(value));
}

function blocked(reason_code, reason, missing_inputs = [], partial = {}) {
  return {
    status: "BLOCKED",
    reason_code,
    reason,
    missing_inputs,
    human_review_required: true,
    engine_build: PHA_FAMILY_CALCULATION_ENGINE_BUILD,
    ...partial,
  };
}

export function calculatePhaFamilyDetermination(input = {}) {
  const program = String(input.program ?? "").trim().toLowerCase();
  if (!SUPPORTED_PROGRAMS.has(program)) {
    return blocked("PHA_CALC_PROGRAM_REQUIRED", "A supported PHA program is required.", ["program"]);
  }

  if (input.evidence_conflict === true || input.source_status_conflict === true) {
    return blocked(
      "PHA_CALC_EVIDENCE_CONFLICT",
      "Conflicting evidence or source status must be resolved before calculation can be validated.",
      [],
      { program },
    );
  }

  const requiredNumbers = ["annual_income", "deductions", "minimum_rent", "utility_allowance"];
  const missing = requiredNumbers.filter((key) => input[key] === undefined || input[key] === null || input[key] === "");
  if (missing.length) {
    return blocked("PHA_CALC_REQUIRED_INPUT_MISSING", "Required calculation inputs are missing.", missing, { program });
  }

  const annualIncome = Number(input.annual_income);
  const deductions = Number(input.deductions);
  const minimumRent = Number(input.minimum_rent);
  const utilityAllowance = Number(input.utility_allowance);
  if ([annualIncome, deductions, minimumRent, utilityAllowance].some((value) => !Number.isFinite(value) || value < 0)) {
    return blocked("PHA_CALC_INVALID_AMOUNT", "Calculation amounts must be finite, non-negative numbers.", [], { program });
  }

  const adjustedIncome = Math.max(annualIncome - deductions, 0);
  const monthlyIncome = annualIncome / 12;
  const monthlyAdjustedIncome = adjustedIncome / 12;
  const welfareHousingAmount = input.welfare_housing_amount == null || input.welfare_housing_amount === ""
    ? null
    : Number(input.welfare_housing_amount);
  if (welfareHousingAmount != null && (!Number.isFinite(welfareHousingAmount) || welfareHousingAmount < 0)) {
    return blocked("PHA_CALC_INVALID_WELFARE_RENT", "Welfare housing amount must be a non-negative number.", [], { program });
  }

  const ttpCandidates = [
    { basis: "30_PERCENT_MONTHLY_ADJUSTED_INCOME", amount: monthlyAdjustedIncome * 0.30 },
    { basis: "10_PERCENT_MONTHLY_INCOME", amount: monthlyIncome * 0.10 },
    { basis: "MINIMUM_RENT", amount: minimumRent },
  ];
  if (welfareHousingAmount != null) {
    ttpCandidates.push({ basis: "WELFARE_HOUSING_AMOUNT", amount: welfareHousingAmount });
  }

  if (program === "public_housing" && input.alternative_non_public_housing_rent_applicable === true) {
    if (input.alternative_non_public_housing_rent == null || input.alternative_non_public_housing_rent === "") {
      return blocked(
        "PHA_CALC_PUBLIC_HOUSING_OVER_INCOME_RENT_REQUIRED",
        "The alternative non-public housing rent is required when the over-income rent path applies.",
        ["alternative_non_public_housing_rent"],
        { program, annual_income: money(annualIncome), adjusted_income: money(adjustedIncome) },
      );
    }
    const alternativeRent = Number(input.alternative_non_public_housing_rent);
    if (!Number.isFinite(alternativeRent) || alternativeRent < 0) {
      return blocked("PHA_CALC_INVALID_OVER_INCOME_RENT", "Alternative non-public housing rent must be non-negative.", [], { program });
    }
    ttpCandidates.push({ basis: "ALTERNATIVE_NON_PUBLIC_HOUSING_RENT", amount: alternativeRent });
  }

  const roundedCandidates = ttpCandidates.map((item) => ({ ...item, amount: wholeDollar(item.amount) }));
  const controlling = roundedCandidates.reduce((highest, item) => item.amount > highest.amount ? item : highest);
  const totalTenantPayment = controlling.amount;

  const base = {
    status: "CALCULATED",
    program,
    annual_income: money(annualIncome),
    deductions: money(deductions),
    adjusted_income: money(adjustedIncome),
    monthly_income: money(monthlyIncome),
    monthly_adjusted_income: money(monthlyAdjustedIncome),
    total_tenant_payment: totalTenantPayment,
    ttp_basis: controlling.basis,
    ttp_candidates: roundedCandidates,
    utility_allowance: money(utilityAllowance),
    human_review_required: true,
    engine_build: PHA_FAMILY_CALCULATION_ENGINE_BUILD,
  };

  if (program === "hcv") {
    const missingVoucher = ["payment_standard", "gross_rent"].filter((key) => input[key] === undefined || input[key] === null || input[key] === "");
    if (missingVoucher.length) {
      return blocked(
        "PHA_CALC_HCV_RENT_INPUT_REQUIRED",
        "Payment standard and gross rent are required to calculate tenant-based HCV housing assistance.",
        missingVoucher,
        base,
      );
    }
    const paymentStandard = Number(input.payment_standard);
    const grossRent = Number(input.gross_rent);
    if (![paymentStandard, grossRent].every((value) => Number.isFinite(value) && value >= 0)) {
      return blocked("PHA_CALC_INVALID_HCV_RENT_AMOUNT", "Payment standard and gross rent must be non-negative numbers.", [], base);
    }
    const housingAssistancePayment = Math.max(0, Math.min(paymentStandard - totalTenantPayment, grossRent - totalTenantPayment));
    const familyShare = Math.max(0, grossRent - housingAssistancePayment);
    return {
      ...base,
      status: "VALIDATED",
      payment_standard: money(paymentStandard),
      gross_rent: money(grossRent),
      housing_assistance_payment: money(housingAssistancePayment),
      family_share: money(familyShare),
    };
  }

  if (program === "pbv") {
    if (input.rent_to_owner == null || input.rent_to_owner === "") {
      return blocked(
        "PHA_CALC_PBV_RENT_TO_OWNER_REQUIRED",
        "The controlled PBV rent to owner is required before tenant rent and HAP can be validated.",
        ["rent_to_owner"],
        base,
      );
    }
    const rentToOwner = Number(input.rent_to_owner);
    if (!Number.isFinite(rentToOwner) || rentToOwner < 0) {
      return blocked("PHA_CALC_INVALID_PBV_RENT_TO_OWNER", "PBV rent to owner must be a non-negative number.", [], base);
    }
    const tenantRent = Math.max(totalTenantPayment - utilityAllowance, 0);
    const utilityReimbursement = Math.max(utilityAllowance - totalTenantPayment, 0);
    return {
      ...base,
      status: "VALIDATED",
      rent_to_owner: money(rentToOwner),
      tenant_rent: money(tenantRent),
      utility_reimbursement: money(utilityReimbursement),
      housing_assistance_payment: money(Math.max(rentToOwner - tenantRent, 0)),
    };
  }

  if (program === "public_housing") {
    const rentChoice = String(input.public_housing_rent_choice ?? "").trim().toLowerCase();
    if (!new Set(["income_based", "flat_rent"]).has(rentChoice)) {
      return blocked(
        "PHA_CALC_PUBLIC_HOUSING_RENT_CHOICE_REQUIRED",
        "Public Housing requires a documented income-based or flat-rent choice.",
        ["public_housing_rent_choice"],
        base,
      );
    }
    if (rentChoice === "flat_rent") {
      if (input.flat_rent_amount == null || input.flat_rent_amount === "") {
        return blocked("PHA_CALC_FLAT_RENT_REQUIRED", "The current utility-adjusted flat rent amount is required.", ["flat_rent_amount"], base);
      }
      const flatRentAmount = Number(input.flat_rent_amount);
      if (!Number.isFinite(flatRentAmount) || flatRentAmount < 0) {
        return blocked("PHA_CALC_INVALID_FLAT_RENT", "Flat rent must be a non-negative number.", [], base);
      }
      return {
        ...base,
        status: "VALIDATED",
        public_housing_rent_choice: rentChoice,
        tenant_rent: money(Math.max(flatRentAmount, minimumRent)),
        utility_reimbursement: 0,
        flat_rent_amount: money(flatRentAmount),
      };
    }
    return {
      ...base,
      status: "VALIDATED",
      public_housing_rent_choice: rentChoice,
      tenant_rent: money(Math.max(totalTenantPayment - utilityAllowance, 0)),
      utility_reimbursement: money(Math.max(utilityAllowance - totalTenantPayment, 0)),
    };
  }

  return blocked(
    "PHA_CALC_MOD_REHAB_RENT_MODULE_PENDING",
    "Income and TTP are calculated, but Mod Rehab rent assistance requires its program-specific rent module before the determination can be validated.",
    ["mod_rehab_rent_module"],
    base,
  );
}
