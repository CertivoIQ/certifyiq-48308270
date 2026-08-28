import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculatePhaFamilyDetermination } from "../src/lib/pha-family-calculation-engine.mjs";

const migration = readFileSync(new URL("../supabase/migrations/20260828060000_pha_substantive_calculations.sql", import.meta.url), "utf8");

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

test("Mod Rehab does not reuse HCV or PBV rent formulas without its controlled program module", () => {
  const result = calculatePhaFamilyDetermination({ ...base, program: "mod_rehab" });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason_code, "PHA_CALC_MOD_REHAB_RENT_MODULE_PENDING");
  assert.equal(result.total_tenant_payment, 750);
});

test("database calculation records are tenant-isolated and calculation completion is derived", () => {
  assert.match(migration, /pha_family_calculations/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /new\.calculation_complete := calculation_validated/);
  assert.match(migration, /PHA_CALC_EVIDENCE_CONFLICT/);
  assert.match(migration, /PHA_CALC_HCV_RENT_INPUT_REQUIRED/);
  assert.match(migration, /PHA_CALC_PBV_RENT_TO_OWNER_REQUIRED/);
  assert.match(migration, /PHA_CALC_MOD_REHAB_RENT_MODULE_PENDING/);
  assert.doesNotMatch(migration, /using \(true\)/);
});
