import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTROLLED_SOURCE_PROGRAMS,
  evaluateFederalControlledSourceActivation,
  federalControlledSourceActivationSummary,
} from "../src/lib/federal-controlled-source-activation.mjs";
import { VERIFIED_FY2026_FEDERAL_SOURCES } from "../src/lib/fy2026-verified-federal-source-manifest.mjs";

function receipt(datasetId) {
  const source = VERIFIED_FY2026_FEDERAL_SOURCES[datasetId];
  return {
    dataset_id: datasetId,
    official_url: source.official_url,
    effective_from: source.effective_from,
    source_sha256: source.sha256,
    source_byte_size: source.byte_size,
    private_storage_verified: true,
    parser_verified: true,
    normalized_records_sha256: "a".repeat(64),
    geography_coverage_verified: true,
  };
}

const approvals = [
  { approvedBy: "compliance-reviewer-a", approvedAt: "2026-08-25T20:00:00Z" },
  { approvedBy: "compliance-reviewer-b", approvedAt: "2026-08-25T20:05:00Z" },
];

test("controlled source activation covers the six requested HUD program families", () => {
  assert.deepEqual(CONTROLLED_SOURCE_PROGRAMS, [
    "HOME",
    "HTF",
    "HCV_TENANT_BASED",
    "HUD_PBV",
    "PUBLIC_HOUSING",
    "HUD_MFH_PROJECT_BASED",
  ]);
});

test("HOME activates source authority only with exact verified receipts, controls, and independent approvals", () => {
  const result = evaluateFederalControlledSourceActivation({
    program: "HOME",
    authorityControls: {
      controlled_home_income_limit_receipt: true,
      controlled_home_rent_limit_receipt: true,
    },
    datasetReceipts: {
      HUD_HOME_INCOME_LIMITS_FY2026: receipt("HUD_HOME_INCOME_LIMITS_FY2026"),
      HUD_HOME_RENT_LIMITS_FY2026: receipt("HUD_HOME_RENT_LIMITS_FY2026"),
    },
    approvals,
  });

  assert.equal(result.activationStatus, "ACTIVE");
  assert.equal(result.ruleEngineAuthority, "SOURCE_AUTHORITY_ACTIVE");
  assert.equal(
    result.substantiveRuleEvaluationAuthority,
    "SEPARATE_DETERMINISTIC_RULE_IMPLEMENTATION_REQUIRED",
  );
  assert.deepEqual(result.missing, []);
});

test("HOME fails closed on a single hash mismatch", () => {
  const badRent = receipt("HUD_HOME_RENT_LIMITS_FY2026");
  badRent.source_sha256 = "b".repeat(64);
  const result = evaluateFederalControlledSourceActivation({
    program: "HOME",
    authorityControls: {
      controlled_home_income_limit_receipt: true,
      controlled_home_rent_limit_receipt: true,
    },
    datasetReceipts: {
      HUD_HOME_INCOME_LIMITS_FY2026: receipt("HUD_HOME_INCOME_LIMITS_FY2026"),
      HUD_HOME_RENT_LIMITS_FY2026: badRent,
    },
    approvals,
  });

  assert.equal(result.activationStatus, "BLOCKED");
  assert.ok(result.missing.includes("source_sha256:HUD_HOME_RENT_LIMITS_FY2026"));
});

test("Section 8 income source can activate for HCV only after program authority controls and two-person approval", () => {
  const result = evaluateFederalControlledSourceActivation({
    program: "HCV_TENANT_BASED",
    authorityControls: {
      controlled_section8_income_limit_receipt: true,
    },
    datasetReceipts: {
      HUD_SECTION8_INCOME_LIMITS_FY2026: receipt("HUD_SECTION8_INCOME_LIMITS_FY2026"),
    },
    approvals,
  });

  assert.equal(result.activationStatus, "ACTIVE");
  assert.equal(result.approvedBy.length, 2);
});

test("duplicate approver identities do not satisfy independent approval", () => {
  const result = evaluateFederalControlledSourceActivation({
    program: "HCV_TENANT_BASED",
    authorityControls: { controlled_section8_income_limit_receipt: true },
    datasetReceipts: {
      HUD_SECTION8_INCOME_LIMITS_FY2026: receipt("HUD_SECTION8_INCOME_LIMITS_FY2026"),
    },
    approvals: [
      { approvedBy: "Reviewer-A", approvedAt: "2026-08-25T20:00:00Z" },
      { approvedBy: "reviewer-a", approvedAt: "2026-08-25T20:05:00Z" },
    ],
  });

  assert.equal(result.activationStatus, "BLOCKED");
  assert.ok(result.missing.includes("independent_two_person_approval"));
});

test("HTF remains blocked because an exact FY2026 HTF dataset binding is not yet present in the verified manifest", () => {
  const result = evaluateFederalControlledSourceActivation({
    program: "HTF",
    authorityControls: {
      controlled_htf_income_limit_receipt: true,
      controlled_htf_rent_limit_receipt: true,
      controlled_htf_grant_fiscal_year_authority: true,
    },
    approvals,
  });

  assert.equal(result.activationStatus, "BLOCKED");
  assert.ok(result.missing.includes("verified_dataset_binding:HTF"));
});

test("summary never silently promotes blocked programs", () => {
  const result = federalControlledSourceActivationSummary();
  assert.deepEqual(result.activePrograms, []);
  assert.deepEqual([...result.blockedPrograms].sort(), [...CONTROLLED_SOURCE_PROGRAMS].sort());
});
