import assert from "node:assert/strict";
import test from "node:test";

import {
  MFH_HOTMA_ENGINE_BUILD,
  MFH_HOTMA_PROGRAM_SUBTYPES,
  MFH_HOTMA_RULE_MODULES,
  classifyAllMfhHotmaModules,
  classifyMfhHotmaReview,
} from "../src/lib/mfh-hotma-rule-engine.mjs";

function base(overrides = {}) {
  return {
    module_id: "MFH-HOTMA-B-CALCULATING-INCOME",
    mfh_program_subtype: "SECTION_8_PBRA",
    program_applicability_validated: true,
    certification_effective_date: "2027-01-01",
    controlled_source_release_approved: true,
    current_rule_version_validated: true,
    source_status_conflict: false,
    policy_evidence: {},
    ...overrides,
  };
}

test("catalog preserves all ten controlled Attachments A-J and seven MFH subtypes", () => {
  assert.equal(MFH_HOTMA_ENGINE_BUILD, "mfh-hotma-rule-engine-2026.08.1");
  assert.equal(MFH_HOTMA_RULE_MODULES.length, 10);
  assert.deepEqual(
    MFH_HOTMA_RULE_MODULES.map((module) => module.attachment),
    [..."ABCDEFGHIJ"],
  );
  assert.deepEqual(MFH_HOTMA_PROGRAM_SUBTYPES, [
    "SECTION_8_PBRA",
    "SECTION_202_8",
    "SECTION_202_162_PAC",
    "SECTION_202_811_PRAC",
    "SECTION_236_IRP",
    "SECTION_811_PRA",
    "SPRAC",
  ]);
  assert.ok(MFH_HOTMA_RULE_MODULES.every((module) => module.citations.length));
  assert.ok(
    MFH_HOTMA_RULE_MODULES.every((module) => module.evidence_fields.length),
  );
});

test("post-deadline routing authorizes only substantive evaluation and never PASS", () => {
  const result = classifyMfhHotmaReview(base());
  assert.equal(result.finding, "READY");
  assert.equal(result.rule_engine_authority, "ALLOWED");
  assert.equal(result.finding_classification, "COMPLIANCE_FINDING");
  assert.equal(result.human_approval_required, true);
});

test("pre-deadline adopted properties route to observations", () => {
  const result = classifyMfhHotmaReview(
    base({
      certification_effective_date: "2026-12-31",
      property_hotma_implementation_date: "2026-06-01",
    }),
  );
  assert.equal(result.finding, "READY");
  assert.equal(
    result.finding_classification,
    "PRE_IMPLEMENTATION_OBSERVATION",
  );
});

test("dates before property adoption or the final rule are not applicable", () => {
  const preAdoption = classifyMfhHotmaReview(
    base({
      certification_effective_date: "2026-03-01",
      property_hotma_implementation_date: "2026-06-01",
    }),
  );
  assert.equal(preAdoption.finding, "NOT_APPLICABLE");
  assert.equal(preAdoption.reason_code, "PRE_ADOPTION_CERTIFICATION");

  const preRule = classifyMfhHotmaReview(
    base({ certification_effective_date: "2023-12-31" }),
  );
  assert.equal(preRule.finding, "NOT_APPLICABLE");
  assert.equal(preRule.reason_code, "PRE_HOTMA_FINAL_RULE_CERTIFICATION");
});

test("invalid calendar dates are blocked rather than normalized", () => {
  const result = classifyMfhHotmaReview(
    base({ certification_effective_date: "2026-02-31" }),
  );
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "CERTIFICATION_EFFECTIVE_DATE_REQUIRED");
});

test("Section 104 asset limits route only PBRA and Section 202/8", () => {
  const result = classifyMfhHotmaReview(
    base({
      module_id: "MFH-HOTMA-A-ASSET-LIMITATION",
      mfh_program_subtype: "SECTION_202_811_PRAC",
    }),
  );
  assert.equal(result.finding, "NOT_APPLICABLE");
  assert.equal(result.reason_code, "MFH_HOTMA_MODULE_NOT_APPLICABLE");
  assert.deepEqual(
    MFH_HOTMA_RULE_MODULES.find(
      (module) => module.module_id === "MFH-HOTMA-A-ASSET-LIMITATION",
    ).applies_to,
    ["SECTION_8_PBRA", "SECTION_202_8"],
  );
});

test("owner policy, inflation data, and TRACS/form controls fail closed", () => {
  const interim = classifyMfhHotmaReview(
    base({ module_id: "MFH-HOTMA-I-INTERIM-REEXAMINATIONS" }),
  );
  assert.equal(interim.reason_code, "OWNER_POLICY_OVERLAY_REQUIRED");
  assert.deepEqual(interim.missing_inputs, [
    "interim_reexamination_policy",
    "tenant_selection_plan",
  ]);

  const inflation = classifyMfhHotmaReview(
    base({ module_id: "MFH-HOTMA-H-INFLATIONARY-ADJUSTMENTS" }),
  );
  assert.equal(inflation.reason_code, "MFH_HOTMA_MODULE_CONTROL_REQUIRED");
  assert.deepEqual(inflation.missing_inputs, [
    "inflation_adjustment_release_validated",
  ]);

  const eiv = classifyMfhHotmaReview(
    base({
      module_id: "MFH-HOTMA-J-VERIFICATION-EIV",
      policy_evidence: {
        tenant_selection_plan: "TSP-REV-2026-01",
        eiv_policy_and_procedures: "EIV-REV-2026-01",
      },
    }),
  );
  assert.equal(eiv.reason_code, "MFH_HOTMA_MODULE_CONTROL_REQUIRED");
  assert.deepEqual(eiv.missing_inputs, ["tracs_and_form_version_validated"]);
});

test("all-module routing returns auditable classification for every attachment", () => {
  const result = classifyAllMfhHotmaModules(
    base({
      mfh_program_subtype: "SECTION_202_811_PRAC",
      inflation_adjustment_release_validated: true,
      tracs_and_form_version_validated: true,
      policy_evidence: {
        tenant_selection_plan: "TSP-REV-2026-01",
        hardship_policy: "TSP-HARDSHIP-2026-01",
        interim_reexamination_policy: "TSP-INTERIM-2026-01",
        eiv_policy_and_procedures: "EIV-REV-2026-01",
      },
    }),
  );
  assert.equal(result.module_count, 10);
  assert.equal(result.classifications.length, 10);
  assert.equal(result.activation_status, "BLOCKED_PENDING_CONTROLLED_SOURCE_RELEASE");
  assert.equal(
    result.classifications.find(
      (entry) => entry.module_id === "MFH-HOTMA-A-ASSET-LIMITATION",
    ).finding_classification,
    "NOT_APPLICABLE",
  );
  assert.ok(
    result.classifications
      .filter((entry) => entry.module_id !== "MFH-HOTMA-A-ASSET-LIMITATION")
      .every((entry) => entry.finding_classification === "COMPLIANCE_FINDING"),
  );
});

test("unapproved, stale, or conflicting authority blocks every substantive route", () => {
  for (const overrides of [
    { controlled_source_release_approved: false },
    { current_rule_version_validated: false },
    { source_status_conflict: true },
  ]) {
    const result = classifyMfhHotmaReview(base(overrides));
    assert.equal(result.finding, "UNABLE_TO_DETERMINE");
    assert.equal(result.reason_code, "CONTROLLED_HOTMA_AUTHORITY_REQUIRED");
    assert.equal(result.rule_engine_authority, "BLOCKED");
  }
});
