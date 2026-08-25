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
