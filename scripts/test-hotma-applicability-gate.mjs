import assert from "node:assert/strict";
import test from "node:test";

import {
  HOTMA_APPLICABILITY_GATE_BUILD,
  HOTMA_MFH_PROGRAM_SUBTYPES,
  classifyHotmaApplicability,
} from "../src/lib/hotma-applicability-gate.mjs";

const SHA = "a".repeat(64);

function authority(programCode, overrides = {}) {
  return {
    program_code: programCode,
    authority_document_id: programCode + "-AUTH-001",
    authority_document_sha256: SHA,
    citation: programCode + " controlling authority, page 1",
    program_applicability_validated: true,
    effective_for_event_date_validated: true,
    source_status_conflict: false,
    ...overrides,
  };
}

function base(overrides = {}) {
  return {
    property_id: "PROP-0001",
    program_inventory_validated: true,
    assistance_sources_reconciled: true,
    ...overrides,
  };
}

test("LIHTC-only is not a HOTMA trigger when the program inventory is validated", () => {
  const result = classifyHotmaApplicability(
    base({ programs: ["LIHTC"] }),
  );

  assert.equal(HOTMA_APPLICABILITY_GATE_BUILD, "hotma-applicability-gate-2026.08.1");
  assert.equal(result.applicability_status, "NOT_APPLICABLE");
  assert.equal(result.reason_code, "LIHTC_ONLY_NO_HOTMA_TRIGGER");
  assert.equal(result.asset_cap_applicable, false);
});

test("state and county cannot determine HOTMA applicability", () => {
  const first = classifyHotmaApplicability(
    base({
      programs: ["HCV_TENANT_BASED"],
      program_authority_records: [authority("HCV_TENANT_BASED")],
      state: "TX",
      county: "Harris",
    }),
  );
  const second = classifyHotmaApplicability(
    base({
      programs: ["HCV_TENANT_BASED"],
      program_authority_records: [authority("HCV_TENANT_BASED")],
      state: "WA",
      county: "King",
    }),
  );

  assert.equal(first.applicability_status, "APPLICABLE");
  assert.equal(second.applicability_status, "APPLICABLE");
  assert.equal(first.state_or_county_used_for_applicability, false);
  assert.equal(second.state_or_county_used_for_applicability, false);
  assert.equal(first.authority_manifest_sha256, second.authority_manifest_sha256);
});

test("each PHA-administered HOTMA program requires a separate documented authority", () => {
  for (const program of ["PUBLIC_HOUSING", "HCV_TENANT_BASED", "HUD_PBV"]) {
    const result = classifyHotmaApplicability(
      base({
        programs: ["LIHTC", program],
        program_authority_records: [authority(program)],
      }),
    );
    assert.equal(result.applicability_status, "APPLICABLE");
    assert.equal(result.asset_cap_applicable, true);
    assert.deepEqual(result.hotma_covered_programs, [program]);
  }

  const missing = classifyHotmaApplicability(
    base({ programs: ["LIHTC", "HUD_PBV"] }),
  );
  assert.equal(missing.applicability_status, "UNABLE_TO_DETERMINE");
  assert.equal(missing.reason_code, "HOTMA_PROGRAM_AUTHORITY_REQUIRED");
  assert.ok(
    missing.missing_inputs.includes("program_authority_records[HUD_PBV]"),
  );
});

test("MFH scope needs the exact program subtype, and asset-cap scope stays narrow", () => {
  const pbra = classifyHotmaApplicability(
    base({
      programs: ["HUD_MFH_PROJECT_BASED"],
      mfh_program_subtype: "SECTION_8_PBRA",
      program_authority_records: [authority("HUD_MFH_PROJECT_BASED")],
    }),
  );
  assert.equal(pbra.applicability_status, "APPLICABLE");
  assert.equal(pbra.asset_cap_applicable, true);
  assert.equal(pbra.module_scope_required, true);

  const section811 = classifyHotmaApplicability(
    base({
      programs: ["HUD_MFH_PROJECT_BASED"],
      mfh_program_subtype: "SECTION_202_811_PRAC",
      program_authority_records: [authority("HUD_MFH_PROJECT_BASED")],
    }),
  );
  assert.equal(section811.applicability_status, "APPLICABLE");
  assert.equal(section811.asset_cap_applicable, false);
  assert.ok(HOTMA_MFH_PROGRAM_SUBTYPES.includes("SECTION_202_811_PRAC"));

  const missingSubtype = classifyHotmaApplicability(
    base({
      programs: ["HUD_MFH_PROJECT_BASED"],
      program_authority_records: [authority("HUD_MFH_PROJECT_BASED")],
    }),
  );
  assert.equal(missingSubtype.applicability_status, "UNABLE_TO_DETERMINE");
  assert.ok(missingSubtype.missing_inputs.includes("mfh_program_subtype"));
});

test("HOME, HTF, or another non-HUD layer cannot be used to infer HOTMA", () => {
  const result = classifyHotmaApplicability(
    base({ programs: ["LIHTC", "HOME", "HTF"] }),
  );

  assert.equal(result.applicability_status, "UNABLE_TO_DETERMINE");
  assert.equal(
    result.reason_code,
    "HOTMA_NON_HUD_LAYER_REQUIRES_MANUAL_REVIEW",
  );
  assert.equal(result.rule_engine_authority, "BLOCKED");
});

test("missing source identity, validation, or a conflict fails closed", () => {
  const cases = [
    authority("HCV_TENANT_BASED", { authority_document_sha256: "not-a-hash" }),
    authority("HCV_TENANT_BASED", { program_applicability_validated: false }),
    authority("HCV_TENANT_BASED", { effective_for_event_date_validated: false }),
    authority("HCV_TENANT_BASED", { source_status_conflict: true }),
  ];

  for (const record of cases) {
    const result = classifyHotmaApplicability(
      base({
        programs: ["HCV_TENANT_BASED"],
        program_authority_records: [record],
      }),
    );
    assert.equal(result.applicability_status, "UNABLE_TO_DETERMINE");
    assert.equal(result.reason_code, "HOTMA_PROGRAM_AUTHORITY_REQUIRED");
  }
});
