import assert from "node:assert/strict";
import test from "node:test";

import {
  TENANT_ELIGIBILITY_RULE_ID,
  evaluateTenantFileEligibility,
  normalizeIncomeLimitDollar,
} from "../src/lib/tenant-file-eligibility.mjs";

const members = ["MEMBER-1", "MEMBER-2"];

function document(documentType, documentId) {
  return {
    document_id: documentId,
    document_type: documentType,
    household_id: "HH-58",
    household_member_ids: members,
    effective_date: "2026-07-01",
    source_validated: true,
    document_complete: true,
    current_for_event: true,
    identity_validated: true,
  };
}

function dataset(program = "LIHTC", overrides = {}) {
  const identity = {
    LIHTC: {
      dataset_id: "HUD_MTSP_LIMITS_FY2026",
      sha256: "fbc0af877e610d9cd3d9192febc6d4827319874605adc8897ca95366afac3465",
    },
    HOME: {
      dataset_id: "HUD_HOME_INCOME_LIMITS_FY2026",
      sha256: "validated-home-income-limit-file",
    },
    HCV_TENANT_BASED: {
      dataset_id: "HUD_SECTION8_INCOME_LIMITS_FY2026",
      sha256: "validated-section8-income-limit-file",
    },
  }[program];
  return {
    ...identity,
    record_count: 4764,
    effective_from: "2026-05-01",
    geography_key: "54043",
    household_size: 2,
    raw_limit_value: "61039.99999999999",
    normalized_limit_amount: "61040",
    source_controlled: true,
    file_hash_validated: true,
    record_count_validated: true,
    geography_validated: true,
    household_size_validated: true,
    effective_date_validated: true,
    normalization_validated: true,
    ...overrides,
  };
}

function student(program, overrides = {}) {
  const bases = {
    LIHTC: "LIHTC_IRC_42_FULL_TIME_STUDENT_HOUSEHOLD",
    HOME: "HOME_WRITTEN_AGREEMENT_AND_APPLICABLE_PROGRAM",
    HCV_TENANT_BASED:
      "HUD_SECTION_8_HIGHER_EDUCATION_STUDENT_24_CFR_5_612",
  };
  return {
    finding: "PASS",
    rule_basis: bases[program],
    source_validated: true,
    exceptions_evaluated: true,
    ...overrides,
  };
}

function programEvidenceFields(program) {
  return [
    `annual_income:${program}`,
    `net_family_assets:${program}`,
    `deductions:${program}`,
    `student_status:${program}`,
  ];
}

function programEvidence(program, annualIncome = "59000.00") {
  const validated = {
    source_validated: true,
    value_validated: true,
    current_for_event: true,
  };
  return [
    {
      field: `annual_income:${program}`,
      value: annualIncome,
      source_document_id: "DOC-TIC",
      ...validated,
    },
    {
      field: `net_family_assets:${program}`,
      value: "15000.00",
      source_document_id: "DOC-TIC",
      ...validated,
    },
    {
      field: `deductions:${program}`,
      value: program === "LIHTC" ? "NOT_APPLICABLE" : "PROGRAM_SPECIFIC",
      source_document_id: "DOC-TIC",
      ...validated,
    },
    {
      field: `student_status:${program}`,
      value: "ELIGIBLE",
      source_document_id: "DOC-APP",
      ...validated,
    },
  ];
}

function determination(program, overrides = {}) {
  return {
    program_code: program,
    household_member_ids: members,
    annual_income: "59000.00",
    adjusted_income: program === "LIHTC" ? null : "57000.00",
    deductions_applied_to_annual_income: false,
    income_definition: `${program}_ANNUAL_INCOME`,
    income_designation_percent: 60,
    hera_special_selection_validated: true,
    income_limit_source: dataset(program),
    student_status: student(program),
    asset_test: {
      applicable: program === "HCV_TENANT_BASED",
      finding: "PASS",
      source_validated: true,
      calculation_validated: true,
      nonapplication_validated: program !== "HCV_TENANT_BASED",
    },
    income_definition_validated: true,
    calculation_validated: true,
    household_roster_validated: true,
    student_rule_validated: true,
    asset_rule_applicability_validated: true,
    program_authority_validated: true,
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    property_id: "WV-PROP-58",
    unit_id: "UNIT-58",
    household_id: "HH-58",
    household_member_ids: members,
    event_date: "2026-07-15",
    certification_type: "INITIAL",
    program_inventory: ["LIHTC"],
    program_determinations: [determination("LIHTC")],
    documents: [
      document("TENANT_APPLICATION", "DOC-APP"),
      document("TENANT_INCOME_CERTIFICATION", "DOC-TIC"),
      document("LEASE", "DOC-LEASE"),
      document("HAP_CONTRACT", "DOC-HAP"),
    ],
    required_evidence_fields: [
      "household_roster",
      ...programEvidenceFields("LIHTC"),
    ],
    evidence: [
      { field: "household_roster", value: members, source_document_id: "DOC-APP", source_validated: true, value_validated: true, current_for_event: true },
      { field: "household_roster", value: [...members].reverse(), source_document_id: "DOC-TIC", source_validated: true, value_validated: true, current_for_event: true },
      ...programEvidence("LIHTC"),
    ],
    property_identity_validated: true,
    unit_identity_validated: true,
    household_identity_validated: true,
    household_roster_complete: true,
    document_inventory_complete: true,
    program_inventory_complete: true,
    program_authority_inventory_complete: true,
    state_finding_requested: false,
    ...overrides,
  };
}

test("a controlled LIHTC tenant-file determination passes", () => {
  const result = evaluateTenantFileEligibility(input());
  assert.equal(result.finding, "PASS");
  assert.equal(result.rule_id, TENANT_ELIGIBILITY_RULE_ID);
  assert.equal(result.program_results.length, 1);
  assert.equal(result.cross_program_income_substitution_performed, false);
  assert.equal(result.agent_approval_status, "PENDING");
});

test("spreadsheet artifacts normalize to exact dollars, never nearest fifty", () => {
  assert.equal(normalizeIncomeLimitDollar("61039.99999999999"), "61040");
  assert.equal(normalizeIncomeLimitDollar("61039.49"), "61039");
});

test("conflicting tenant-file evidence blocks every determination", () => {
  const data = input();
  data.evidence.push({ field: "annual_income:LIHTC", value: "60000.00", source_document_id: "DOC-LEASE", source_validated: true, value_validated: true, current_for_event: true });
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "CONFLICTING_TENANT_FILE_EVIDENCE");
});

test("a document roster mismatch blocks before program evaluation", () => {
  const data = input();
  data.documents[1].household_member_ids = ["MEMBER-1"];
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.reason_code, "HOUSEHOLD_ROSTER_CONFLICT");
});

test("HUD adjusted-income deductions cannot be applied to LIHTC income", () => {
  const data = input();
  data.program_determinations[0].adjusted_income = "57000.00";
  data.program_determinations[0].deductions_applied_to_annual_income = true;
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.reason_code, "LIHTC_DEDUCTIONS_INCORRECTLY_APPLIED");
});

test("income averaging requires the corrected dataset", () => {
  const data = input();
  data.program_determinations[0].income_designation_percent = 70;
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.reason_code, "LIHTC_INCOME_AVERAGING_SOURCE_REQUIRED");
});

test("an approved dataset identity mismatch blocks", () => {
  const data = input();
  data.program_determinations[0].income_limit_source.sha256 = "0".repeat(64);
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.reason_code, "CONTROLLED_DATASET_IDENTITY_CONFLICT");
});

test("income-limit datasets cannot cross program branches", () => {
  const data = input();
  data.program_determinations[0].income_limit_source = dataset("LIHTC", {
    dataset_id: "HUD_HOME_RENT_LIMITS_FY2026",
    sha256: "3082bd081727dea71dd62abcb811e3d26ce605f1f645fd5cd8dbcb76e8d4f133",
    effective_from: "2026-06-01",
  });
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.reason_code, "INCOME_LIMIT_PROGRAM_BRANCH_CONFLICT");
});

test("HOME and Section 8 datasets stay blocked pending file validation", () => {
  const data = input();
  data.program_inventory.push("HOME");
  data.program_determinations.push(determination("HOME"));
  data.required_evidence_fields.push(...programEvidenceFields("HOME"));
  data.evidence.push(...programEvidence("HOME"));
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "CONTROLLED_DATASET_NOT_ACTIVATED");
});

test("unresolved student status blocks while preserving known failures", () => {
  const data = input();
  data.program_determinations[0].annual_income = "70000.00";
  data.evidence.find(
    (item) => item.field === "annual_income:LIHTC",
  ).value = "70000.00";
  data.program_determinations[0].student_status.finding = "NOT_DETERMINED";
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "PROGRAM_ELIGIBILITY_NOT_DETERMINED");
  assert.ok(result.confirmed_failure_indicators.includes("PROGRAM:LIHTC"));
});

test("HAP-assisted branches require a HAP contract", () => {
  const data = input();
  data.program_inventory.push("HCV_TENANT_BASED");
  data.program_determinations.push(determination("HCV_TENANT_BASED"));
  data.documents = data.documents.filter((item) => item.document_type !== "HAP_CONTRACT");
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.reason_code, "REQUIRED_TENANT_FILE_DOCUMENT_MISSING");
  assert.ok(result.missing_inputs.includes("HAP_CONTRACT"));
});

test("caller booleans cannot activate an unvalidated state pack", () => {
  const data = input({
    state_finding_requested: true,
    state_rulepack_validated: true,
    state_authority_source_validated: true,
  });
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.reason_code, "STATE_ELIGIBILITY_PACK_NOT_VALIDATED");
});

test("program inventory must match exact determination handoffs", () => {
  const data = input();
  data.program_determinations.pop();
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.reason_code, "PROGRAM_ELIGIBILITY_INVENTORY_MISMATCH");
});

test("program-specific student rule substitution is blocked", () => {
  const data = input();
  data.program_determinations[0].student_status.rule_basis =
    "HUD_SECTION_8_HIGHER_EDUCATION_STUDENT_24_CFR_5_612";
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.reason_code, "STUDENT_RULE_PROGRAM_BRANCH_CONFLICT");
});

test("program income must match reconciled tenant-file evidence", () => {
  const data = input();
  data.program_determinations[0].annual_income = "60000.00";
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "PROGRAM_INCOME_EVIDENCE_CONFLICT");
});

test("caller-defined evidence inventory cannot omit eligibility fields", () => {
  const data = input();
  data.required_evidence_fields = ["household_roster"];
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "REQUIRED_ELIGIBILITY_EVIDENCE_SCOPE_MISSING");
  assert.ok(result.missing_inputs.includes("annual_income:LIHTC"));
});

test("unregistered dataset identifiers remain blocked", () => {
  const data = input();
  data.program_determinations[0].income_limit_source.dataset_id =
    "CALLER_CREATED_LIMITS";
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "UNREGISTERED_INCOME_LIMIT_SOURCE");
});

test("caller-created future state packs cannot activate state findings", () => {
  const data = input({
    state_finding_requested: true,
    state_rulepack: {
      pack_id: "CALLER-CREATED-WV",
      jurisdiction: "WV",
      status: "validated",
      approvedBy: "caller",
      version: "2099.1",
      sha256: "caller",
      effectiveFrom: "2099-01-01",
      validatedRuleCount: 999,
    },
  });
  const result = evaluateTenantFileEligibility(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "STATE_ELIGIBILITY_PACK_NOT_VALIDATED");
});
