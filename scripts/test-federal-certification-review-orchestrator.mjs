import assert from "node:assert/strict";
import test from "node:test";

import { signOffAllowed } from "../src/lib/compliance-rule-engine.mjs";
import {
  FEDERAL_REVIEW_ORCHESTRATOR_BUILD,
  evaluateFederalCertificationReview,
} from "../src/lib/federal-certification-review-orchestrator.mjs";

function fact(field, value) {
  return {
    field,
    value,
    sourceDocumentRef: "tic-test.txt",
    page: 1,
    snippet: `${field}: ${value}`,
    confidence: 1,
    humanVerified: false,
  };
}

const COMPLETE_NARROW_FACTS = [
  fact("tenant_signature_date", "2026-03-01"),
  fact("certification_effective_date", "2026-03-05"),
  fact("household_annual_income", 42500),
  fact("applicable_lihtc_income_limit", 48900),
  fact("lihtc_income_limit_basis_pct", 60),
  fact("lihtc_minimum_set_aside_election", "40-60"),
  fact("controlled_income_limit_receipt", "HUD_MTSP_FY2026:verified-receipt"),
];

test("initial reviews retain a tenant-eligibility blocker until trusted scope is supplied", () => {
  const result = evaluateFederalCertificationReview({
    facts: COMPLETE_NARROW_FACTS,
    programs: ["LIHTC"],
    certificationType: "INITIAL",
  });

  assert.equal(result.engineBuild, FEDERAL_REVIEW_ORCHESTRATOR_BUILD);
  assert.equal(result.counts.pass, 2);
  assert.equal(result.counts.fail, 0);
  assert.equal(result.counts.unableToDetermine, 1);
  assert.equal(result.controlResults.recertification, null);
  assert.equal(result.controlResults.layeredPrograms, null);

  const eligibility = result.findings.find(
    (finding) =>
      finding.ruleId ===
      "FED-TENANT-FILE-ELIGIBILITY-RECONCILIATION-001",
  );
  assert.equal(eligibility.status, "UNABLE_TO_DETERMINE");
  assert.equal(eligibility.ruleEvaluationStatus, "BLOCKED");
  assert.match(eligibility.blockingReasons.join(" "), /property_id/i);
  assert.equal(signOffAllowed(result), false);
});

test("annual reviews invoke and retain recertification scope blockers", () => {
  const result = evaluateFederalCertificationReview({
    facts: COMPLETE_NARROW_FACTS,
    programs: ["LIHTC"],
    certificationType: "ANNUAL",
  });

  assert.equal(result.counts.unableToDetermine, 2);
  assert.ok(result.controlResults.recertification);
  const recertification = result.findings.find(
    (finding) =>
      finding.ruleId ===
      "FED-RECERTIFICATION-OCCUPANCY-CONTROLS-001",
  );
  assert.equal(recertification.status, "UNABLE_TO_DETERMINE");
  assert.match(
    recertification.blockingReasons.join(" "),
    /building_id|property_id/i,
  );
});

test("layered reviews invoke the layered-program engine and never collapse missing authority", () => {
  const result = evaluateFederalCertificationReview({
    facts: COMPLETE_NARROW_FACTS,
    programs: ["LIHTC", "HUD_MFH_PROJECT_BASED"],
    certificationType: "INITIAL",
  });

  assert.ok(result.controlResults.layeredPrograms);
  const layered = result.findings.find(
    (finding) =>
      finding.ruleId === "FED-LAYERED-PROGRAM-RESTRICTIONS-001",
  );
  assert.equal(layered.status, "UNABLE_TO_DETERMINE");
  assert.match(layered.blockingReasons.join(" "), /property_id/i);
  assert.equal(signOffAllowed(result), false);
});

test("a known core failure is preserved alongside unresolved broader controls", () => {
  const facts = COMPLETE_NARROW_FACTS.map((item) =>
    item.field === "household_annual_income"
      ? { ...item, value: 60000 }
      : item,
  );
  const result = evaluateFederalCertificationReview({
    facts,
    programs: ["LIHTC"],
    certificationType: "INITIAL",
  });

  assert.equal(result.counts.fail, 1);
  assert.equal(result.counts.unableToDetermine, 1);
  assert.equal(
    result.findings.find(
      (finding) => finding.ruleId === "LIHTC-INCOME-LIMIT-APPLICABLE",
    ).status,
    "FAIL",
  );
  assert.equal(signOffAllowed(result), false);
});

test("MFH reviews expose all ten HOTMA module classifications without manufacturing PASS or FAIL", () => {
  const result = evaluateFederalCertificationReview({
    facts: [],
    programs: ["HUD_MFH_PROJECT_BASED"],
    certificationType: "INITIAL",
    mfhHotmaInput: {
      mfh_program_subtype: "SECTION_202_811_PRAC",
      program_applicability_validated: true,
      certification_effective_date: "2027-01-01",
      controlled_source_release_approved: true,
      current_rule_version_validated: true,
      source_status_conflict: false,
      inflation_adjustment_release_validated: true,
      tracs_and_form_version_validated: true,
      policy_evidence: {
        tenant_selection_plan: "TSP-REV-2026-01",
        hardship_policy: "TSP-HARDSHIP-2026-01",
        interim_reexamination_policy: "TSP-INTERIM-2026-01",
        eiv_policy_and_procedures: "EIV-REV-2026-01",
      },
    },
  });

  const hotma = result.controlResults.mfhHotma;
  assert.equal(hotma.module_count, 10);
  assert.equal(hotma.classifications.length, 10);
  assert.equal(
    hotma.classifications.find(
      (entry) => entry.module_id === "MFH-HOTMA-A-ASSET-LIMITATION",
    ).finding_classification,
    "NOT_APPLICABLE",
  );
  assert.ok(
    hotma.classifications.every(
      (entry) => !["PASS", "FAIL"].includes(entry.finding),
    ),
  );
});

test("PHA-administered reviews expose cohort-aware HOTMA implementation routing", () => {
  const result = evaluateFederalCertificationReview({
    facts: [],
    programs: ["HCV_TENANT_BASED"],
    certificationType: "INITIAL",
    phaHotmaInput: {
      program_applicability_validated: true,
      pha_cohort: "NON_MTW_NON_FRS",
      transaction_effective_date: "2027-01-01",
      controlled_source_release_approved: true,
      current_rule_version_validated: true,
      source_status_conflict: false,
      full_hotma_policy_set_validated: true,
      hud_50058_reporting_path: "HUD_50058_2024",
      reporting_path_validated: true,
      software_compatibility_validated: true,
      alternative_50058_instructions_validated: true,
      alternative_hotma_indicator_validated: true,
      eid_enrollment_status_validated: true,
      hud_9886_a_version_validated: true,
      july_2025_provisions_validated: true,
    },
  });

  assert.equal(result.controlResults.phaHotma.length, 1);
  assert.equal(result.controlResults.phaHotma[0].program, "HCV_TENANT_BASED");
  assert.equal(result.controlResults.phaHotma[0].module_count, 7);
  assert.ok(
    result.controlResults.phaHotma[0].classifications.every(
      (entry) => !["PASS", "FAIL"].includes(entry.finding),
    ),
  );
});


test("MFH reviews expose owner-policy and system controls without affecting PASS/FAIL counts", () => {
  const result = evaluateFederalCertificationReview({
    facts: [],
    programs: ["HUD_MFH_PROJECT_BASED"],
    certificationType: "INITIAL",
    mfhHotmaOperationsInput: {
      mfh_program_subtype: "SECTION_8_PBRA",
      program_applicability_validated: true,
      certification_effective_date: "2027-01-01",
      property_hotma_implementation_date: "2026-10-01",
      controlled_source_release_approved: true,
      current_rule_version_validated: true,
      source_status_conflict: false,
    },
  });

  const operations = result.controlResults.mfhHotmaOperations;
  assert.equal(operations.module_count, 7);
  assert.equal(operations.classifications.length, 7);
  assert.ok(
    operations.classifications.every(
      (entry) => entry.finding_classification === "UNABLE_TO_DETERMINE",
    ),
  );
  assert.ok(
    operations.classifications.every(
      (entry) => !["PASS", "FAIL"].includes(entry.finding),
    ),
  );
});
