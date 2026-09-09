const BUILD = "tic-recalculation-1.0.6";
const RULE_PACK_ID = "CERTIVOIQ-TIC-ARITHMETIC";
const RULE_PACK_VERSION = "1.0.6";
const TOLERANCE = 0.01;
const MINIMUM_CONFIDENCE = 0.85;
// This is the arithmetic threshold printed on the recognized Annual Income
// Calculation Worksheet template. It is NOT used as program eligibility
// authority; separate controlled rule packs determine applicable HOTMA/program rules.
const WORKSHEET_IMPUTATION_THRESHOLD = 5000;

function numeric(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function reliable(fact) {
  return Boolean(fact?.humanVerified) || Number(fact?.confidence ?? 0) >= MINIMUM_CONFIDENCE;
}

function refs(facts, fields) {
  const wanted = new Set(fields);
  return facts.filter((fact) => wanted.has(fact.field) && reliable(fact)).map((fact) => ({
    field: fact.field,
    documentRef: fact.sourceDocumentRef ?? null,
    page: fact.page ?? null,
    snippet: fact.snippet ?? null,
    confidence: Number(fact.confidence ?? 0),
    humanVerified: Boolean(fact.humanVerified),
  }));
}

function makeFinding(facts, ruleId, label, reportedField, reported, calculated, componentFields) {
  if (![reported, calculated].every(Number.isFinite)) return null;
  const evidence = refs(facts, [reportedField, ...componentFields]);
  if (!evidence.some((ref) => ref.field === reportedField)) return null;
  const variance = money(reported - calculated);
  if (variance === null || Math.abs(variance) <= TOLERANCE) return null;
  return {
    ruleId,
    ruleVersion: "1.0.6",
    rulePackId: RULE_PACK_ID,
    rulePackVersion: RULE_PACK_VERSION,
    jurisdiction: "federal",
    severity: Math.abs(variance) >= 1 ? "major" : "minor",
    citation: "CertivoIQ independent TIC arithmetic cross-check; applicable program rules are evaluated separately.",
    engineBuild: BUILD,
    evidenceStatus: "RESOLVED",
    ruleEvaluationStatus: "EVALUATED",
    status: "FAIL",
    explanation: `${label} does not reconcile. Reported on TIC: $${reported.toFixed(2)}. Calculated by CertivoIQ: $${calculated.toFixed(2)}. Variance: $${variance.toFixed(2)}.`,
    blockingReasons: [],
    evidenceRefs: evidence,
  };
}

function factMap(facts) {
  const map = new Map();
  const conflicts = new Set();
  for (const fact of facts) {
    if (!reliable(fact) || conflicts.has(fact.field)) continue;
    const value = numeric(fact.value);
    if (value === null) continue;
    const prior = map.get(fact.field);
    if (prior && numeric(prior.value) !== value) {
      map.delete(fact.field);
      conflicts.add(fact.field);
      continue;
    }
    map.set(fact.field, fact);
  }
  return map;
}

function valueOf(map, field) {
  return numeric(map.get(field)?.value);
}

function calculatedValue(calculated, field) {
  return numeric(calculated[field]);
}

function indexedValues(facts, pattern) {
  const byField = new Map();
  const conflicts = new Set();
  for (const fact of facts) {
    if (!pattern.test(fact.field) || !reliable(fact) || conflicts.has(fact.field)) continue;
    const value = numeric(fact.value);
    if (value === null) continue;
    const prior = byField.get(fact.field);
    if (prior !== undefined && prior !== value) {
      byField.delete(fact.field);
      conflicts.add(fact.field);
      continue;
    }
    byField.set(fact.field, value);
  }
  return [...byField].map(([field, value]) => ({ field, value }));
}

function sum(values) {
  return money(values.reduce((total, entry) => total + entry.value, 0));
}

// worksheetCalculation is recomputed from confirmed facts and saved settings by the server.
// It prevents a selected method from being compared against a different template method.
export function evaluateTicRecalculations(facts = [], worksheetCalculation = null) {
  const map = factMap(facts);
  const findings = [];
  const calculated = {};

  const ticIncomeRows = indexedValues(facts, /^income_member_\d+_total_income$/);
  const reportedIncomeE = valueOf(map, "total_income_e");
  if (ticIncomeRows.length && reportedIncomeE !== null) {
    const expected = sum(ticIncomeRows);
    if (expected !== null) {
      calculated.total_income_e = expected;
      const finding = makeFinding(facts, "CERTIVOIQ-TIC-INCOME-SUM-001", "Annual income arithmetic", "total_income_e", reportedIncomeE, expected, ticIncomeRows.map((entry) => entry.field));
      if (finding) findings.push(finding);
    }
  }

  const ticAssetCashRows = indexedValues(facts, /^asset_\d+_cash_value$/);
  const totalAssetCash = valueOf(map, "total_asset_cash_value");
  const householdNetAssets = valueOf(map, "household_net_assets");
  const reportedAssetCash = totalAssetCash ?? householdNetAssets;
  const reportedAssetCashField = totalAssetCash !== null ? "total_asset_cash_value" : "household_net_assets";
  if (ticAssetCashRows.length && reportedAssetCash !== null) {
    const expected = sum(ticAssetCashRows);
    if (expected !== null) {
      calculated.total_asset_cash_value = expected;
      const finding = makeFinding(facts, "CERTIVOIQ-TIC-ASSET-CASH-SUM-001", "Asset cash-value total", reportedAssetCashField, reportedAssetCash, expected, ticAssetCashRows.map((entry) => entry.field));
      if (finding) findings.push(finding);
    }
  }

  const ticAssetIncomeRows = indexedValues(facts, /^asset_\d+_annual_income$/);
  const totalIncomeAssetsM = valueOf(map, "total_income_assets_m");
  const totalAssetAnnualIncome = valueOf(map, "total_asset_annual_income");
  const reportedAssetIncome = totalIncomeAssetsM ?? totalAssetAnnualIncome;
  const reportedAssetIncomeField = totalIncomeAssetsM !== null ? "total_income_assets_m" : "total_asset_annual_income";
  if (ticAssetIncomeRows.length && reportedAssetIncome !== null) {
    const actualTotal = sum(ticAssetIncomeRows);
    const expected = worksheetCalculation ? numeric(worksheetCalculation.total_income_assets_m) : actualTotal;
    if (expected !== null) {
      calculated.total_asset_actual_income = actualTotal;
      const finding = makeFinding(facts, "CERTIVOIQ-TIC-ASSET-INCOME-SUM-001", worksheetCalculation ? "Selected asset-income total" : "Actual asset-income total", reportedAssetIncomeField, reportedAssetIncome, expected, ticAssetIncomeRows.map((entry) => entry.field));
      if (finding) findings.push(finding);
    }
  }

  const worksheetIncomeRows = indexedValues(facts, /^worksheet_income_\d+_income_per_year$/);
  const worksheetTotalIncomeSources = valueOf(map, "worksheet_total_of_all_income_sources");
  if (worksheetIncomeRows.length && worksheetTotalIncomeSources !== null) {
    const expected = sum(worksheetIncomeRows);
    if (expected !== null) {
      calculated.worksheet_total_of_all_income_sources = expected;
      const finding = makeFinding(facts, "CERTIVOIQ-WORKSHEET-INCOME-SUM-001", "Worksheet income-source total", "worksheet_total_of_all_income_sources", worksheetTotalIncomeSources, expected, worksheetIncomeRows.map((entry) => entry.field));
      if (finding) findings.push(finding);
    }
  }

  const worksheetAssetCashRows = indexedValues(facts, /^worksheet_asset_\d+_cash_value$/);
  const worksheetAssetCash = valueOf(map, "worksheet_total_asset_cash_value");
  if (worksheetAssetCashRows.length && worksheetAssetCash !== null) {
    const expected = sum(worksheetAssetCashRows);
    if (expected !== null) {
      calculated.worksheet_total_asset_cash_value = expected;
      const finding = makeFinding(facts, "CERTIVOIQ-WORKSHEET-ASSET-CASH-SUM-001", "Worksheet asset cash-value total", "worksheet_total_asset_cash_value", worksheetAssetCash, expected, worksheetAssetCashRows.map((entry) => entry.field));
      if (finding) findings.push(finding);
    }
  }

  const worksheetAssetIncomeRows = indexedValues(facts, /^worksheet_asset_\d+_income_per_year$/);
  const worksheetActualIncome = valueOf(map, "worksheet_total_actual_income");
  if (worksheetAssetIncomeRows.length && worksheetActualIncome !== null) {
    const expected = sum(worksheetAssetIncomeRows);
    if (expected !== null) {
      calculated.worksheet_total_actual_income = expected;
      const finding = makeFinding(facts, "CERTIVOIQ-WORKSHEET-ASSET-INCOME-SUM-001", "Worksheet actual asset-income total", "worksheet_total_actual_income", worksheetActualIncome, expected, worksheetAssetIncomeRows.map((entry) => entry.field));
      if (finding) findings.push(finding);
    }
  }

  const passbookRate = valueOf(map, "worksheet_passbook_rate_percent");
  const worksheetImputed = valueOf(map, "worksheet_total_imputed_income");
  const cashForImputation = calculatedValue(calculated, "worksheet_total_asset_cash_value") ?? worksheetAssetCash;
  if (passbookRate !== null && cashForImputation !== null) {
    // Recalculate the recognized worksheet as printed: below/equal to its
    // $5,000 trigger, imputed income is zero. Above the trigger, apply the
    // worksheet's reported passbook percentage. Compliance applicability is separate.
    const expected = worksheetCalculation ? numeric(worksheetCalculation.worksheet_total_imputed_income) : cashForImputation > WORKSHEET_IMPUTATION_THRESHOLD
      ? money(cashForImputation * passbookRate / 100)
      : 0;
    if (expected !== null) {
      calculated.worksheet_total_imputed_income = expected;
      if (worksheetImputed !== null) {
        const finding = makeFinding(facts, "CERTIVOIQ-WORKSHEET-IMPUTED-ASSET-INCOME-001", "Imputed asset income", "worksheet_total_imputed_income", worksheetImputed, expected, ["worksheet_total_asset_cash_value", "worksheet_passbook_rate_percent"]);
        if (finding) findings.push(finding);
      }
    }
  }

  // Downstream arithmetic deliberately prefers CertivoIQ's independent calculations.
  // A bad reported component must not mask a second inconsistency in a dependent total.
  const actualForGreatest = calculatedValue(calculated, "worksheet_total_actual_income") ?? worksheetActualIncome;
  const imputedForGreatest = calculatedValue(calculated, "worksheet_total_imputed_income") ?? worksheetImputed;
  const reportedGreatest = valueOf(map, "worksheet_greatest_asset_income");
  if (actualForGreatest !== null && imputedForGreatest !== null) {
    const expected = worksheetCalculation ? numeric(worksheetCalculation.worksheet_greatest_asset_income) : money(Math.max(actualForGreatest, imputedForGreatest));
    if (expected !== null) {
      calculated.worksheet_greatest_asset_income = expected;
      if (reportedGreatest !== null) {
        const finding = makeFinding(facts, "CERTIVOIQ-WORKSHEET-GREATEST-ASSET-INCOME-001", "Greatest asset income", "worksheet_greatest_asset_income", reportedGreatest, expected, ["worksheet_total_actual_income", "worksheet_total_imputed_income"]);
        if (finding) findings.push(finding);
      }
    }
  }

  const greatestForAssetTotal = worksheetCalculation ? numeric(worksheetCalculation.worksheet_total_asset_income) : calculatedValue(calculated, "worksheet_greatest_asset_income") ?? reportedGreatest;
  const reportedTotalAssetIncome = valueOf(map, "worksheet_total_asset_income");
  if (greatestForAssetTotal !== null) {
    calculated.worksheet_total_asset_income = greatestForAssetTotal;
    if (reportedTotalAssetIncome !== null) {
      const finding = makeFinding(facts, "CERTIVOIQ-WORKSHEET-TOTAL-ASSET-INCOME-001", "Worksheet total asset income", "worksheet_total_asset_income", reportedTotalAssetIncome, greatestForAssetTotal, ["worksheet_greatest_asset_income"]);
      if (finding) findings.push(finding);
    }
  }

  const worksheetBaseIncome = valueOf(map, "worksheet_total_income") ?? calculatedValue(calculated, "worksheet_total_of_all_income_sources") ?? worksheetTotalIncomeSources;
  const selectedAssetIncome = calculatedValue(calculated, "worksheet_total_asset_income") ?? reportedTotalAssetIncome ?? greatestForAssetTotal;
  const worksheetAnnual = valueOf(map, "worksheet_total_annual_income");
  if (worksheetBaseIncome !== null && selectedAssetIncome !== null) {
    const expected = money(worksheetBaseIncome + selectedAssetIncome);
    if (expected !== null) {
      calculated.worksheet_total_annual_income = expected;
      if (worksheetAnnual !== null) {
        const finding = makeFinding(facts, "CERTIVOIQ-WORKSHEET-TOTAL-ANNUAL-INCOME-001", "Worksheet total annual income", "worksheet_total_annual_income", worksheetAnnual, expected, ["worksheet_total_income", "worksheet_total_asset_income"]);
        if (finding) findings.push(finding);
      }
    }
  }

  const reportedHouseholdAnnual = valueOf(map, "household_annual_income");
  const ticIncome = calculatedValue(calculated, "total_income_e") ?? reportedIncomeE;
  const ticAssetIncome = worksheetCalculation ? numeric(worksheetCalculation.total_income_assets_m) : calculatedValue(calculated, "total_asset_actual_income") ?? reportedAssetIncome;
  if (reportedHouseholdAnnual !== null && ticIncome !== null && ticAssetIncome !== null) {
    const expected = money(ticIncome + ticAssetIncome);
    if (expected !== null) {
      calculated.household_annual_income = expected;
      const finding = makeFinding(facts, "CERTIVOIQ-TIC-TOTAL-ANNUAL-INCOME-001", "Total annual household income", "household_annual_income", reportedHouseholdAnnual, expected, ["total_income_e", reportedAssetIncomeField]);
      if (finding) findings.push(finding);
    }
  }

  return { calculated, findings };
}
