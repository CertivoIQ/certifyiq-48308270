import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateTicRecalculations } from "../src/lib/tic-recalculation.mjs";

const fact = (field, value, page = 5) => ({
  field,
  value,
  sourceDocumentRef: "sample-tic.pdf",
  page,
  snippet: `${field}: ${value}`,
  confidence: 0.99,
  humanVerified: true,
});

test("worksheet imputed and annual income are independently recalculated above the worksheet trigger", () => {
  const result = evaluateTicRecalculations([
    fact("worksheet_total_asset_cash_value", 5200.9),
    fact("worksheet_passbook_rate_percent", 0.06),
    fact("worksheet_total_imputed_income", 0),
    fact("worksheet_total_actual_income", 0),
    fact("worksheet_greatest_asset_income", 0),
    fact("worksheet_total_income", 25364.4),
    fact("worksheet_total_annual_income", 25364.4),
  ]);

  assert.equal(result.calculated.worksheet_total_imputed_income, 3.12);
  assert.equal(result.calculated.worksheet_greatest_asset_income, 3.12);
  assert.equal(result.calculated.worksheet_total_annual_income, 25367.52);
  assert.ok(result.findings.some((finding) => finding.ruleId === "CERTIVOIQ-WORKSHEET-IMPUTED-ASSET-INCOME-001"));
  assert.ok(result.findings.some((finding) => finding.ruleId === "CERTIVOIQ-WORKSHEET-TOTAL-ANNUAL-INCOME-001"));
  assert.match(result.findings[0].explanation, /Reported on TIC:/);
  assert.match(result.findings[0].explanation, /Calculated by CertivoIQ:/);
  assert.match(result.findings[0].explanation, /Variance:/);
});

test("recognized worksheet does not impute below its printed $5,000 trigger", () => {
  const result = evaluateTicRecalculations([
    fact("worksheet_total_asset_cash_value", 520.9),
    fact("worksheet_passbook_rate_percent", 0.06),
    fact("worksheet_total_imputed_income", 0),
    fact("worksheet_total_actual_income", 0),
    fact("worksheet_greatest_asset_income", 0),
    fact("worksheet_total_income", 25364.4),
    fact("worksheet_total_annual_income", 25364.4),
  ]);
  assert.equal(result.calculated.worksheet_total_imputed_income, 0);
  assert.equal(result.calculated.worksheet_greatest_asset_income, 0);
  assert.equal(result.calculated.worksheet_total_annual_income, 25364.4);
  assert.equal(result.findings.length, 0);
});

test("matching TIC arithmetic does not create an inconsistency finding", () => {
  const result = evaluateTicRecalculations([
    fact("income_member_1_total_income", 12000, 3),
    fact("income_member_2_total_income", 6000, 3),
    fact("total_income_e", 18000, 3),
    fact("asset_1_cash_value", 500, 4),
    fact("asset_2_cash_value", 250, 4),
    fact("total_asset_cash_value", 750, 4),
    fact("asset_1_annual_income", 5, 4),
    fact("asset_2_annual_income", 2.5, 4),
    fact("total_income_assets_m", 7.5, 4),
    fact("household_annual_income", 18007.5, 4),
  ]);

  assert.equal(result.findings.length, 0);
  assert.equal(result.calculated.total_income_e, 18000);
  assert.equal(result.calculated.total_asset_cash_value, 750);
  assert.equal(result.calculated.total_asset_actual_income, 7.5);
  assert.equal(result.calculated.household_annual_income, 18007.5);
});

test("missing arithmetic inputs do not manufacture a FAIL", () => {
  const result = evaluateTicRecalculations([
    fact("worksheet_total_annual_income", 25365),
  ]);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.calculated, {});
});

test("strict-cell pages allow only safe same-line fallback for fields the spatial reader missed", () => {
  const extraction = readFileSync("src/lib/tic-field-extraction.ts", "utf8");
  assert.match(extraction, /const strictPage = strictCellPages\.has/);
  assert.match(extraction, /value === null && !raw\.trim\(\) && !strictPage/);
  assert.doesNotMatch(extraction, /strictCellPages\.has\(pageOfLine\[index\]\) \|\| supplementalPages/);
});

test("annual income worksheet scalar fallback covers qualifying limit and variance without guessing across lines", () => {
  const extraction = readFileSync("src/lib/tic-field-extraction.ts", "utf8");
  const supplemental = readFileSync("src/lib/tic-supplemental-text-extraction.ts", "utf8");
  assert.match(extraction, /supplementalTextFacts/);
  assert.match(supplemental, /worksheet_qualifying_income_limit_percent/);
  assert.match(supplemental, /worksheet_qualifying_income_limit/);
  assert.match(supplemental, /worksheet_variance/);
  assert.match(supplemental, /SAME OCR\/native-text line/);
  assert.doesNotMatch(supplemental, /nextCandidateLine/);
});

test("federal review appends recalculation inconsistencies to the normal findings list", () => {
  const orchestrator = readFileSync("src/lib/federal-certification-review-orchestrator.mjs", "utf8");
  assert.match(orchestrator, /evaluateTicRecalculations/);
  assert.match(orchestrator, /\.\.\.ticRecalculation\.findings/);
  assert.match(orchestrator, /ticRecalculation,/);
});
