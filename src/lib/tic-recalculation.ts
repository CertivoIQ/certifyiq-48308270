import type { ExtractedFact } from "@/lib/compliance-rule-engine.mjs";

export type TicRecalculationFinding = {
  ruleId: string;
  ruleVersion: string;
  rulePackId: string;
  rulePackVersion: string;
  jurisdiction: string;
  severity: "major" | "minor" | "info";
  citation: string;
  engineBuild: string;
  evidenceStatus: "RESOLVED";
  ruleEvaluationStatus: "EVALUATED";
  status: "FAIL";
  explanation: string;
  blockingReasons: string[];
  evidenceRefs: Array<{
    field: string;
    documentRef: string | null;
    page: number | null;
    snippet: string | null;
    confidence: number;
    humanVerified: boolean;
  }>;
};

export type TicRecalculationResult = {
  calculated: Record<string, number>;
  findings: TicRecalculationFinding[];
};

const BUILD = "tic-recalculation-1.0.0";
const RULE_PACK_ID = "CERTIVOIQ-TIC-ARITHMETIC";
const RULE_PACK_VERSION = "1.0.0";
const TOLERANCE = 0.01;

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function refs(facts: ExtractedFact[], fields: string[]) {
  const wanted = new Set(fields);
  return facts
    .filter((fact) => wanted.has(fact.field))
    .map((fact) => ({
      field: fact.field,
      documentRef: fact.sourceDocumentRef ?? null,
      page: fact.page ?? null,
      snippet: fact.snippet ?? null,
      confidence: Number(fact.confidence ?? 0),
      humanVerified: Boolean(fact.humanVerified),
    }));
}

function makeFinding(
  facts: ExtractedFact[],
  ruleId: string,
  label: string,
  reportedField: string,
  reported: number,
  calculated: number,
  componentFields: string[],
): TicRecalculationFinding | null {
  const variance = money(reported - calculated);
  if (Math.abs(variance) <= TOLERANCE) return null;
  return {
    ruleId,
    ruleVersion: "1.0.0",
    rulePackId: RULE_PACK_ID,
    rulePackVersion: RULE_PACK_VERSION,
    jurisdiction: "US",
    severity: Math.abs(variance) >= 1 ? "major" : "minor",
    citation: "CertivoIQ independent TIC arithmetic cross-check; program eligibility rules are evaluated separately.",
    engineBuild: BUILD,
    evidenceStatus: "RESOLVED",
    ruleEvaluationStatus: "EVALUATED",
    status: "FAIL",
    explanation: `${label} does not reconcile. Reported on TIC: $${reported.toFixed(2)}. Calculated by CertivoIQ: $${calculated.toFixed(2)}. Variance: $${variance.toFixed(2)}.`,
    blockingReasons: [],
    evidenceRefs: refs(facts, [reportedField, ...componentFields]),
  };
}

function factMap(facts: ExtractedFact[]) {
  return new Map(facts.map((fact) => [fact.field, fact]));
}

function valueOf(map: Map<string, ExtractedFact>, field: string) {
  return numeric(map.get(field)?.value);
}

function indexedValues(facts: ExtractedFact[], pattern: RegExp) {
  return facts
    .filter((fact) => pattern.test(fact.field))
    .map((fact) => ({ field: fact.field, value: numeric(fact.value) }))
    .filter((entry): entry is { field: string; value: number } => entry.value !== null);
}

function sum(values: Array<{ value: number }>) {
  return money(values.reduce((total, entry) => total + entry.value, 0));
}

export function evaluateTicRecalculations(facts: ExtractedFact[]): TicRecalculationResult {
  const map = factMap(facts);
  const findings: TicRecalculationFinding[] = [];
  const calculated: Record<string, number> = {};

  const ticIncomeRows = indexedValues(facts, /^income_member_\d+_total_income$/);
  const reportedIncomeE = valueOf(map, "total_income_e");
  if (ticIncomeRows.length && reportedIncomeE !== null) {
    const expected = sum(ticIncomeRows);
    calculated.total_income_e = expected;
    const finding = makeFinding(
      facts,
      "CERTIVOIQ-TIC-INCOME-SUM-001",
      "Annual income arithmetic",
      "total_income_e",
      reportedIncomeE,
      expected,
      ticIncomeRows.map((entry) => entry.field),
    );
    if (finding) findings.push(finding);
  }

  const ticAssetCashRows = indexedValues(facts, /^asset_\d+_cash_value$/);
  const reportedAssetCash = valueOf(map, "total_asset_cash_value") ?? valueOf(map, "household_net_assets");
  const reportedAssetCashField = valueOf(map, "total_asset_cash_value") !== null ? "total_asset_cash_value" : "household_net_assets";
  if (ticAssetCashRows.length && reportedAssetCash !== null) {
    const expected = sum(ticAssetCashRows);
    calculated.total_asset_cash_value = expected;
    const finding = makeFinding(
      facts,
      "CERTIVOIQ-TIC-ASSET-CASH-SUM-001",
      "Asset cash-value total",
      reportedAssetCashField,
      reportedAssetCash,
      expected,
      ticAssetCashRows.map((entry) => entry.field),
    );
    if (finding) findings.push(finding);
  }

  const ticAssetIncomeRows = indexedValues(facts, /^asset_\d+_annual_income$/);
  const reportedAssetIncome = valueOf(map, "total_income_assets_m") ?? valueOf(map, "total_asset_annual_income");
  const reportedAssetIncomeField = valueOf(map, "total_income_assets_m") !== null ? "total_income_assets_m" : "total_asset_annual_income";
  if (ticAssetIncomeRows.length && reportedAssetIncome !== null) {
    const expected = sum(ticAssetIncomeRows);
    calculated.total_asset_actual_income = expected;
    const finding = makeFinding(
      facts,
      "CERTIVOIQ-TIC-ASSET-INCOME-SUM-001",
      "Actual asset-income total",
      reportedAssetIncomeField,
      reportedAssetIncome,
      expected,
      ticAssetIncomeRows.map((entry) => entry.field),
    );
    if (finding) findings.push(finding);
  }

  const worksheetIncomeRows = indexedValues(facts, /^worksheet_income_\d+_income_per_year$/);
  const worksheetTotalIncomeSources = valueOf(map, "worksheet_total_of_all_income_sources");
  if (worksheetIncomeRows.length && worksheetTotalIncomeSources !== null) {
    const expected = sum(worksheetIncomeRows);
    calculated.worksheet_total_of_all_income_sources = expected;
    const finding = makeFinding(
      facts,
      "CERTIVOIQ-WORKSHEET-INCOME-SUM-001",
      "Worksheet income-source total",
      "worksheet_total_of_all_income_sources",
      worksheetTotalIncomeSources,
      expected,
      worksheetIncomeRows.map((entry) => entry.field),
    );
    if (finding) findings.push(finding);
  }

  const worksheetAssetCashRows = indexedValues(facts, /^worksheet_asset_\d+_cash_value$/);
  const worksheetAssetCash = valueOf(map, "worksheet_total_asset_cash_value");
  if (worksheetAssetCashRows.length && worksheetAssetCash !== null) {
    const expected = sum(worksheetAssetCashRows);
    calculated.worksheet_total_asset_cash_value = expected;
    const finding = makeFinding(
      facts,
      "CERTIVOIQ-WORKSHEET-ASSET-CASH-SUM-001",
      "Worksheet asset cash-value total",
      "worksheet_total_asset_cash_value",
      worksheetAssetCash,
      expected,
      worksheetAssetCashRows.map((entry) => entry.field),
    );
    if (finding) findings.push(finding);
  }

  const worksheetAssetIncomeRows = indexedValues(facts, /^worksheet_asset_\d+_income_per_year$/);
  const worksheetActualIncome = valueOf(map, "worksheet_total_actual_income");
  if (worksheetAssetIncomeRows.length && worksheetActualIncome !== null) {
    const expected = sum(worksheetAssetIncomeRows);
    calculated.worksheet_total_actual_income = expected;
    const finding = makeFinding(
      facts,
      "CERTIVOIQ-WORKSHEET-ASSET-INCOME-SUM-001",
      "Worksheet actual asset-income total",
      "worksheet_total_actual_income",
      worksheetActualIncome,
      expected,
      worksheetAssetIncomeRows.map((entry) => entry.field),
    );
    if (finding) findings.push(finding);
  }

  const passbookRate = valueOf(map, "worksheet_passbook_rate_percent");
  const worksheetImputed = valueOf(map, "worksheet_total_imputed_income");
  const cashForImputation = worksheetAssetCash ?? calculated.worksheet_total_asset_cash_value;
  if (passbookRate !== null && cashForImputation !== null) {
    const expected = money(cashForImputation * passbookRate / 100);
    calculated.worksheet_total_imputed_income = expected;
    if (worksheetImputed !== null) {
      const finding = makeFinding(
        facts,
        "CERTIVOIQ-WORKSHEET-IMPUTED-ASSET-INCOME-001",
        "Imputed asset income",
        "worksheet_total_imputed_income",
        worksheetImputed,
        expected,
        ["worksheet_total_asset_cash_value", "worksheet_passbook_rate_percent"],
      );
      if (finding) findings.push(finding);
    }
  }

  const actualForGreatest = worksheetActualIncome ?? calculated.worksheet_total_actual_income;
  const imputedForGreatest = worksheetImputed ?? calculated.worksheet_total_imputed_income;
  const reportedGreatest = valueOf(map, "worksheet_greatest_asset_income");
  if (actualForGreatest !== null && imputedForGreatest !== null) {
    const expected = money(Math.max(actualForGreatest, imputedForGreatest));
    calculated.worksheet_greatest_asset_income = expected;
    if (reportedGreatest !== null) {
      const finding = makeFinding(
        facts,
        "CERTIVOIQ-WORKSHEET-GREATEST-ASSET-INCOME-001",
        "Greatest asset income",
        "worksheet_greatest_asset_income",
        reportedGreatest,
        expected,
        ["worksheet_total_actual_income", "worksheet_total_imputed_income"],
      );
      if (finding) findings.push(finding);
    }
  }

  const worksheetBaseIncome = valueOf(map, "worksheet_total_income") ?? worksheetTotalIncomeSources ?? calculated.worksheet_total_of_all_income_sources;
  const selectedAssetIncome = reportedGreatest ?? calculated.worksheet_greatest_asset_income;
  const worksheetAnnual = valueOf(map, "worksheet_total_annual_income");
  if (worksheetBaseIncome !== null && selectedAssetIncome !== null) {
    const expected = money(worksheetBaseIncome + selectedAssetIncome);
    calculated.worksheet_total_annual_income = expected;
    if (worksheetAnnual !== null) {
      const finding = makeFinding(
        facts,
        "CERTIVOIQ-WORKSHEET-TOTAL-ANNUAL-INCOME-001",
        "Worksheet total annual income",
        "worksheet_total_annual_income",
        worksheetAnnual,
        expected,
        ["worksheet_total_income", "worksheet_greatest_asset_income"],
      );
      if (finding) findings.push(finding);
    }
  }

  const reportedHouseholdAnnual = valueOf(map, "household_annual_income");
  const ticIncome = reportedIncomeE ?? calculated.total_income_e;
  const ticAssetIncome = reportedAssetIncome ?? calculated.total_asset_actual_income;
  if (reportedHouseholdAnnual !== null && ticIncome !== null && ticAssetIncome !== null) {
    const expected = money(ticIncome + ticAssetIncome);
    calculated.household_annual_income = expected;
    const finding = makeFinding(
      facts,
      "CERTIVOIQ-TIC-TOTAL-ANNUAL-INCOME-001",
      "Total annual household income",
      "household_annual_income",
      reportedHouseholdAnnual,
      expected,
      ["total_income_e", reportedAssetIncomeField],
    );
    if (finding) findings.push(finding);
  }

  return { calculated, findings };
}
