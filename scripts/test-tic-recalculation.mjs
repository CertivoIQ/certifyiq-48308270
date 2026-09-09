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

const ocrFact = (field, value, confidence) => ({
  field,
  value,
  sourceDocumentRef: "sample-tic.pdf",
  page: 5,
  snippet: `${field}: ${value}`,
  confidence,
  humanVerified: false,
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

test("missing or low-confidence arithmetic inputs do not manufacture a FAIL", () => {
  const missing = evaluateTicRecalculations([
    fact("worksheet_total_annual_income", 25365),
  ]);
  assert.deepEqual(missing.findings, []);
  assert.deepEqual(missing.calculated, {});

  const lowConfidence = evaluateTicRecalculations([
    ocrFact("income_member_1_total_income", 12000, 0.6),
    ocrFact("income_member_2_total_income", 6000, 0.6),
    ocrFact("total_income_e", 99999, 0.6),
  ]);
  assert.deepEqual(lowConfidence.findings, []);
  assert.deepEqual(lowConfidence.calculated, {});
});

import {load} from './helpers/load-typescript.mjs';
test("strict-cell pages require a cell proposal while native text retains label fallback", async () => {
  const {extractTicFieldsFromText}=await import(load('src/lib/tic-field-extraction.ts'));
  const text='page 4\n__CERTIVOIQ_TIC_CELL_MODE__: strict\nResident Rent: 675.00\nMonthly Utility Allowance:\n147.00\nHousehold Size at Move-in:\nHousehold Income exceeds 140%';
  assert.equal(extractTicFieldsFromText(text,'synthetic.pdf').facts.length,0);
  const {facts}=extractTicFieldsFromText(text+'\n__CERTIVOIQ_TIC_FIELD__ tenant_paid_rent: 675.00','synthetic.pdf');
  assert.equal(facts.find(f=>f.field==='tenant_paid_rent')?.value,675);
  assert.ok(!facts.some(f=>['utility_allowance','household_size_at_move_in'].includes(f.field)));
  const native=extractTicFieldsFromText('Resident Rent: 675.00','synthetic.pdf');
  assert.equal(native.facts.find(f=>f.field==='tenant_paid_rent')?.value,675);
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

test("a server-recomputed selected asset method survives full-review arithmetic", () => {
  const facts = [
    fact("asset_1_annual_income",3.18),fact("total_income_assets_m",5.52),
    fact("total_income_e",52912),fact("household_annual_income",52917.52),
    fact("worksheet_total_asset_cash_value",9208.26),fact("worksheet_passbook_rate_percent",0.06),
    fact("worksheet_total_actual_income",3.18),fact("worksheet_total_imputed_income",5.52),
    fact("worksheet_greatest_asset_income",5.52),fact("worksheet_total_asset_income",5.52),
    fact("worksheet_total_income",52912),fact("worksheet_total_annual_income",52917.52),
  ];
  const r=evaluateTicRecalculations(facts,{total_income_assets_m:"5.52",worksheet_total_imputed_income:"5.52",worksheet_greatest_asset_income:"5.52",worksheet_total_asset_income:"5.52"});
  assert.equal(r.calculated.household_annual_income,52917.52);
  assert.equal(r.findings.length,0);
  const hotma=evaluateTicRecalculations(facts.map(f=>["total_income_assets_m","worksheet_total_asset_income"].includes(f.field)?{...f,value:3.18}:["household_annual_income","worksheet_total_annual_income"].includes(f.field)?{...f,value:52915.18}:f),{total_income_assets_m:"3.18",worksheet_total_imputed_income:"0.00",worksheet_total_asset_income:"3.18"});
  assert.equal(hotma.calculated.household_annual_income,52915.18);
  assert.equal(hotma.calculated.worksheet_total_asset_income,3.18);
});
