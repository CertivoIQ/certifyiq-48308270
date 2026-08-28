import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculatePhaFamilyDetermination } from "../src/lib/pha-family-calculation-engine.mjs";

const baseMigration = readFileSync(new URL("../supabase/migrations/20260828060000_pha_substantive_calculations.sql", import.meta.url), "utf8");
const modRehabMigration = readFileSync(new URL("../supabase/migrations/20260828070000_mod_rehab_rent_module.sql", import.meta.url), "utf8");
const workbench = readFileSync(new URL("../src/components/pha-family-workflow.tsx", import.meta.url), "utf8");

const base = {
  annual_income: 36000,
  deductions: 6000,
  minimum_rent: 50,
  utility_allowance: 100,
  evidence_conflict: false,
  source_status_conflict: false,
};

test("TTP uses the highest federally defined candidate and rounds to nearest dollar", () => {
  const result = calculatePhaFamilyDetermination({
    ...base,
    program: "hcv",
    payment_standard: 1100,
    gross_rent: 1000,
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.adjusted_income, 30000);
  assert.equal(result.total_tenant_payment, 750);
  assert.equal(result.ttp_basis, "30_PERCENT_MONTHLY_ADJUSTED_INCOME");
  assert.equal(result.housing_assistance_payment, 250);
  assert.equal(result.family_share, 750);
});

test("welfare housing amount and minimum rent remain TTP candidates", () => {
  const result = calculatePhaFamilyDetermination({
    ...base,
    annual_income: 12000,
    deductions: 0,
    minimum_rent: 50,
    welfare_housing_amount: 425,
    program: "pbv",
    rent_to_owner: 850,
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.total_tenant_payment, 425);
  assert.equal(result.ttp_basis, "WELFARE_HOUSING_AMOUNT");
});

test("tenant-based HCV requires payment standard and gross rent", () => {
  const result = calculatePhaFamilyDetermination({ ...base, program: "hcv" });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason_code, "PHA_CALC_HCV_RENT_INPUT_REQUIRED");
  assert.deepEqual(result.missing_inputs, ["payment_standard", "gross_rent"]);
});

test("PBV uses controlled rent to owner rather than tenant-based payment-standard HAP formula", () => {
  const result = calculatePhaFamilyDetermination({
    ...base,
    program: "pbv",
    rent_to_owner: 900,
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.total_tenant_payment, 750);
  assert.equal(result.tenant_rent, 650);
  assert.equal(result.utility_reimbursement, 0);
  assert.equal(result.housing_assistance_payment, 250);
  assert.equal(result.payment_standard, undefined);
});

test("PBV blocks without a controlled rent to owner", () => {
  const result = calculatePhaFamilyDetermination({ ...base, program: "pbv" });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason_code, "PHA_CALC_PBV_RENT_TO_OWNER_REQUIRED");
});

test("Public Housing income-based rent subtracts utility allowance and preserves reimbursement", () => {
  const result = calculatePhaFamilyDetermination({
    ...base,
    program: "public_housing",
    public_housing_rent_choice: "income_based",
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.total_tenant_payment, 750);
  assert.equal(result.tenant_rent, 650);
  assert.equal(result.utility_reimbursement, 0);

  const reimbursement = calculatePhaFamilyDetermination({
    program: "public_housing",
    annual_income: 0,
    deductions: 0,
    minimum_rent: 0,
    utility_allowance: 80,
    public_housing_rent_choice: "income_based",
  });
  assert.equal(reimbursement.status, "VALIDATED");
  assert.equal(reimbursement.tenant_rent, 0);
  assert.equal(reimbursement.utility_reimbursement, 80);
});

test("Public Housing flat rent remains a distinct documented choice", () => {
  const result = calculatePhaFamilyDetermination({
    ...base,
    program: "public_housing",
    public_housing_rent_choice: "flat_rent",
    flat_rent_amount: 825,
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.tenant_rent, 825);
});

test("Public Housing over-income path requires the alternative rent when applicable", () => {
  const result = calculatePhaFamilyDetermination({
    ...base,
    program: "public_housing",
    public_housing_rent_choice: "income_based",
    alternative_non_public_housing_rent_applicable: true,
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason_code, "PHA_CALC_PUBLIC_HOUSING_OVER_INCOME_RENT_REQUIRED");
});

test("evidence conflicts fail closed before monetary determination", () => {
  const result = calculatePhaFamilyDetermination({
    ...base,
    program: "hcv",
    evidence_conflict: true,
    payment_standard: 1100,
    gross_rent: 1000,
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason_code, "PHA_CALC_EVIDENCE_CONFLICT");
});

test("Mod Rehab requires a validated controlled source before calculation", () => {
  const result = calculatePhaFamilyDetermination({
    ...base,
    program: "mod_rehab",
    current_base_rent: 700,
    rehab_debt_service: 100,
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason_code, "PHA_CALC_MOD_REHAB_SOURCE_REQUIRED");
});

test("Mod Rehab calculates contract rent, gross rent, tenant rent, and HAP independently", () => {
  const result = calculatePhaFamilyDetermination({
    ...base,
    program: "mod_rehab",
    mod_rehab_source_validated: true,
    current_base_rent: 700,
    rehab_debt_service: 100,
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.total_tenant_payment, 750);
  assert.equal(result.contract_rent_to_owner, 800);
  assert.equal(result.gross_rent, 900);
  assert.equal(result.normal_total_hap, 150);
  assert.equal(result.tenant_rent, 650);
  assert.equal(result.utility_reimbursement, 0);
  assert.equal(result.housing_assistance_payment, 150);
  assert.equal(result.payment_standard, undefined);
  assert.equal(result.rent_to_owner, undefined);
});

test("Mod Rehab preserves a utility reimbursement when TTP is below the utility allowance", () => {
  const result = calculatePhaFamilyDetermination({
    program: "mod_rehab",
    annual_income: 0,
    deductions: 0,
    minimum_rent: 0,
    utility_allowance: 120,
    mod_rehab_source_validated: true,
    current_base_rent: 700,
    rehab_debt_service: 100,
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.tenant_rent, 0);
  assert.equal(result.utility_reimbursement, 120);
  assert.equal(result.housing_assistance_payment, 800);
  assert.equal(result.normal_total_hap, 920);
});

test("Mod Rehab mixed-family proration uses eligible share of normal HAP", () => {
  const result = calculatePhaFamilyDetermination({
    ...base,
    program: "mod_rehab",
    mod_rehab_source_validated: true,
    current_base_rent: 700,
    rehab_debt_service: 100,
    mixed_family_proration_applicable: true,
    eligible_family_members: 2,
    total_family_members: 4,
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.normal_total_hap, 150);
  assert.equal(result.proration_percentage, 0.5);
  assert.equal(result.prorated_total_hap, 75);
  assert.equal(result.mixed_family_total_tenant_payment, 825);
  assert.equal(result.tenant_rent, 725);
  assert.equal(result.housing_assistance_payment, 75);
});

test("Mod Rehab mixed-family proration fails closed when family counts are missing or invalid", () => {
  const missing = calculatePhaFamilyDetermination({
    ...base,
    program: "mod_rehab",
    mod_rehab_source_validated: true,
    current_base_rent: 700,
    rehab_debt_service: 100,
    mixed_family_proration_applicable: true,
  });
  assert.equal(missing.status, "BLOCKED");
  assert.equal(missing.reason_code, "PHA_CALC_MOD_REHAB_MIXED_FAMILY_INPUT_REQUIRED");

  const invalid = calculatePhaFamilyDetermination({
    ...base,
    program: "mod_rehab",
    mod_rehab_source_validated: true,
    current_base_rent: 700,
    rehab_debt_service: 100,
    mixed_family_proration_applicable: true,
    eligible_family_members: 5,
    total_family_members: 4,
  });
  assert.equal(invalid.status, "BLOCKED");
  assert.equal(invalid.reason_code, "PHA_CALC_INVALID_MOD_REHAB_MIXED_FAMILY_COUNTS");
});

test("database calculation records are tenant-isolated and calculation completion is derived", () => {
  assert.match(baseMigration, /pha_family_calculations/);
  assert.match(baseMigration, /enable row level security/);
  assert.match(baseMigration, /user_id = auth\.uid\(\)/);
  assert.match(baseMigration, /new\.calculation_complete := calculation_validated/);
  assert.match(baseMigration, /PHA_CALC_EVIDENCE_CONFLICT/);
  assert.match(baseMigration, /PHA_CALC_HCV_RENT_INPUT_REQUIRED/);
  assert.match(baseMigration, /PHA_CALC_PBV_RENT_TO_OWNER_REQUIRED/);
  assert.doesNotMatch(baseMigration, /using \(true\)/);
});

test("Mod Rehab migration adds controlled source, rent, and mixed-family fields without permissive RLS", () => {
  assert.match(modRehabMigration, /mod_rehab_source_validated/);
  assert.match(modRehabMigration, /current_base_rent/);
  assert.match(modRehabMigration, /rehab_debt_service/);
  assert.match(modRehabMigration, /contract_rent_to_owner/);
  assert.match(modRehabMigration, /mixed_family_proration_applicable/);
  assert.match(modRehabMigration, /PHA_CALC_MOD_REHAB_SOURCE_REQUIRED/);
  assert.match(modRehabMigration, /PHA_CALC_MOD_REHAB_MIXED_FAMILY_INPUT_REQUIRED/);
  assert.doesNotMatch(modRehabMigration, /payment_standard.*mod_rehab|mod_rehab.*payment_standard/i);
  assert.doesNotMatch(modRehabMigration, /using \(true\)/);
});

test("Families page exposes program-specific determination inputs and writes through the calculation trigger", () => {
  assert.match(workbench, /Determination workbench/);
  assert.match(workbench, /Payment standard/);
  assert.match(workbench, /Controlled rent to owner/);
  assert.match(workbench, /Rent choice/);
  assert.match(workbench, /Controlled Mod Rehab HAP\/rent source validated/);
  assert.match(workbench, /Current base rent/);
  assert.match(workbench, /Rehab debt service/);
  assert.match(workbench, /Mixed-family proration applies/);
  assert.match(workbench, /upsert\(payload, \{ onConflict: "family_action_id" \}\)/);
  assert.doesNotMatch(workbench, /calculation_complete\s*:/);
});
