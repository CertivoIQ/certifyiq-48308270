import assert from "node:assert/strict";
import test from "node:test";

import {
  PHA_HOTMA_COHORTS,
  PHA_HOTMA_IMPLEMENTATION_MODULES,
  PHA_HOTMA_PROGRAMS,
  classifyAllPhaHotmaImplementationModules,
  classifyPhaHotmaImplementation,
} from "../src/lib/pha-hotma-implementation-engine.mjs";

function base(overrides = {}) {
  return {
    module_id: "PHA-HOTMA-FULL-SECTIONS-102-104",
    program: "HCV_TENANT_BASED",
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
    ...overrides,
  };
}

test("catalog preserves the PHA implementation cohorts, programs, and seven controls", () => {
  assert.equal(PHA_HOTMA_IMPLEMENTATION_MODULES.length, 7);
  assert.deepEqual(PHA_HOTMA_COHORTS, [
    "NON_MTW_NON_FRS",
    "INITIAL_MTW",
    "MTW_EXPANSION",
    "FRS_EXCLUSIVE",
  ]);
  assert.deepEqual(PHA_HOTMA_PROGRAMS, [
    "HCV_TENANT_BASED",
    "HUD_PBV",
    "MOD_REHAB",
    "MOD_REHAB_SRO",
    "PUBLIC_HOUSING",
  ]);
  assert.ok(
    PHA_HOTMA_IMPLEMENTATION_MODULES.every(
      (module) => module.citations.length && module.evidence_fields.length,
    ),
  );
});

test("non-MTW, non-FRS transactions on January 1 2027 route to compliance findings", () => {
  const result = classifyPhaHotmaImplementation(base());
  assert.equal(result.finding, "READY");
  assert.equal(result.rule_engine_authority, "ALLOWED");
  assert.equal(result.finding_classification, "COMPLIANCE_FINDING");
  assert.equal(result.human_approval_required, true);
});

test("pre-deadline full implementation reviews route to readiness observations", () => {
  const result = classifyPhaHotmaImplementation(
    base({ transaction_effective_date: "2026-12-31" }),
  );
  assert.equal(result.finding, "READY");
  assert.equal(
    result.finding_classification,
    "PRE_IMPLEMENTATION_OBSERVATION",
  );
});

test("MTW and FRS full-compliance deadlines remain unable to determine", () => {
  for (const cohort of ["INITIAL_MTW", "MTW_EXPANSION", "FRS_EXCLUSIVE"]) {
    const result = classifyPhaHotmaImplementation(
      base({ pha_cohort: cohort }),
    );
    assert.equal(result.finding, "UNABLE_TO_DETERMINE");
    assert.equal(
      result.reason_code,
      "PHA_HOTMA_DEADLINE_PENDING_HUD_GUIDANCE",
    );
    assert.ok(result.missing_inputs.includes("future_hud_deadline_guidance"));
  }
});

test("earlier mandatory milestones continue to apply to MTW and FRS cohorts", () => {
  const cases = [
    [
      "PHA-HOTMA-EID-ENROLLMENT-CUTOFF",
      "2024-01-01",
      "eid_enrollment_status_validated",
    ],
    [
      "PHA-HOTMA-HUD-9886-A",
      "2025-02-01",
      "hud_9886_a_version_validated",
    ],
    [
      "PHA-HOTMA-JULY-2025-PROVISIONS",
      "2025-07-01",
      "july_2025_provisions_validated",
    ],
  ];
  for (const [moduleId, date, flag] of cases) {
    const result = classifyPhaHotmaImplementation(
      base({
        module_id: moduleId,
        pha_cohort: "INITIAL_MTW",
        transaction_effective_date: date,
        [flag]: true,
      }),
    );
    assert.equal(result.finding_classification, "COMPLIANCE_FINDING");
  }
});

test("invalid transaction dates and unresolved authority fail closed", () => {
  const invalidDate = classifyPhaHotmaImplementation(
    base({ transaction_effective_date: "2027-02-30" }),
  );
  assert.equal(invalidDate.finding, "UNABLE_TO_DETERMINE");
  assert.equal(
    invalidDate.reason_code,
    "PHA_TRANSACTION_EFFECTIVE_DATE_REQUIRED",
  );

  const conflict = classifyPhaHotmaImplementation(
    base({ source_status_conflict: true }),
  );
  assert.equal(conflict.finding, "UNABLE_TO_DETERMINE");
  assert.equal(
    conflict.reason_code,
    "CONTROLLED_PHA_HOTMA_AUTHORITY_REQUIRED",
  );
});

test("2024 HUD-50058 makes the temporary 2020 alternative module not applicable", () => {
  const result = classifyPhaHotmaImplementation(
    base({
      module_id: "PHA-HOTMA-2020-ALTERNATIVE-INSTRUCTIONS",
      hud_50058_reporting_path: "HUD_50058_2024",
    }),
  );
  assert.equal(result.finding, "NOT_APPLICABLE");
  assert.equal(
    result.reason_code,
    "PHA_HOTMA_ALTERNATIVE_INSTRUCTIONS_NOT_APPLICABLE",
  );
});

test("the 2020 alternative path requires instructions and HOTMA indicator controls", () => {
  const blocked = classifyPhaHotmaImplementation(
    base({
      module_id: "PHA-HOTMA-2020-ALTERNATIVE-INSTRUCTIONS",
      hud_50058_reporting_path: "HUD_50058_2020_ALTERNATIVE",
      alternative_50058_instructions_validated: false,
      alternative_hotma_indicator_validated: false,
    }),
  );
  assert.equal(blocked.reason_code, "PHA_HOTMA_MODULE_CONTROL_REQUIRED");
  assert.deepEqual(blocked.missing_inputs, [
    "alternative_50058_instructions_validated",
    "alternative_hotma_indicator_validated",
  ]);

  const ready = classifyPhaHotmaImplementation(
    base({
      module_id: "PHA-HOTMA-2020-ALTERNATIVE-INSTRUCTIONS",
      hud_50058_reporting_path: "HUD_50058_2020_ALTERNATIVE",
    }),
  );
  assert.equal(ready.finding_classification, "COMPLIANCE_FINDING");
});

test("all-module routing remains auditable and never manufactures PASS or FAIL", () => {
  const result = classifyAllPhaHotmaImplementationModules(base());
  assert.equal(result.module_count, 7);
  assert.equal(result.classifications.length, 7);
  assert.equal(
    result.activation_status,
    "BLOCKED_PENDING_CONTROLLED_SOURCE_RELEASE",
  );
  assert.ok(
    result.classifications.every(
      (entry) => !["PASS", "FAIL"].includes(entry.finding),
    ),
  );
});
