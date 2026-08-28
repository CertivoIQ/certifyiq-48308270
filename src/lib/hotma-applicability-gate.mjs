import { createHash } from "node:crypto";

/**
 * Federal HOTMA applicability boundary.
 *
 * Applicability is determined from the property's documented assistance
 * inventory and controlling authority—not from its state, county, or LIHTC
 * status. This gate classifies scope only and never produces a compliance
 * PASS/FAIL finding.
 */
export const HOTMA_APPLICABILITY_GATE_BUILD =
  "hotma-applicability-gate-2026.08.1";
export const HOTMA_APPLICABILITY_RULE_ID =
  "FED-HOTMA-PROGRAM-APPLICABILITY-001";

export const HOTMA_APPLICABILITY_STATUS = Object.freeze({
  applicable: "APPLICABLE",
  notApplicable: "NOT_APPLICABLE",
  unableToDetermine: "UNABLE_TO_DETERMINE",
});

export const HOTMA_PHA_PROGRAMS = Object.freeze([
  "PUBLIC_HOUSING",
  "HCV_TENANT_BASED",
  "HUD_PBV",
]);

export const HOTMA_MFH_PROGRAM = "HUD_MFH_PROJECT_BASED";

export const HOTMA_MFH_PROGRAM_SUBTYPES = Object.freeze([
  "SECTION_8_PBRA",
  "SECTION_202_8",
  "SECTION_202_162_PAC",
  "SECTION_202_811_PRAC",
  "SECTION_236_IRP",
  "SECTION_811_PRA",
  "SPRAC",
]);

const PHA_PROGRAM_SET = new Set(HOTMA_PHA_PROGRAMS);
const MFH_PROGRAM_SUBTYPE_SET = new Set(HOTMA_MFH_PROGRAM_SUBTYPES);
const MFH_ASSET_CAP_SUBTYPE_SET = new Set([
  "SECTION_8_PBRA",
  "SECTION_202_8",
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function normalizePrograms(value) {
  const requested = Array.isArray(value) ? value : [value];
  return [...new Set(
    requested
      .map((program) => String(program ?? "").trim().toUpperCase())
      .filter(Boolean),
  )].sort();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function authorityManifestSha256(records) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(records)))
    .digest("hex");
}

function blocked(reasonCode, reason, missingInputs = [], details = {}) {
  return Object.freeze({
    applicability_status: HOTMA_APPLICABILITY_STATUS.unableToDetermine,
    resolution_status: "NOT_DETERMINED",
    determination_status: "NOT_DETERMINED",
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    reason_code: reasonCode,
    reason,
    missing_inputs: [...new Set(missingInputs)].sort(),
    state_or_county_used_for_applicability: false,
    agent_approval_required: true,
    human_approval_required: true,
    engine_build: HOTMA_APPLICABILITY_GATE_BUILD,
    ...details,
  });
}

function notApplicable(reasonCode, reason, details = {}) {
  return Object.freeze({
    applicability_status: HOTMA_APPLICABILITY_STATUS.notApplicable,
    resolution_status: "NOT_APPLICABLE",
    determination_status: "NOT_APPLICABLE",
    rule_engine_authority: "NOT_APPLICABLE",
    finding: "NOT_APPLICABLE",
    reason_code: reasonCode,
    reason,
    asset_cap_applicable: false,
    state_or_county_used_for_applicability: false,
    agent_approval_required: true,
    human_approval_required: true,
    engine_build: HOTMA_APPLICABILITY_GATE_BUILD,
    ...details,
  });
}

function applicable(details = {}) {
  return Object.freeze({
    applicability_status: HOTMA_APPLICABILITY_STATUS.applicable,
    resolution_status: "READY",
    determination_status: "READY_FOR_MODULE_ROUTING",
    rule_engine_authority: "ALLOWED",
    finding: "READY",
    state_or_county_used_for_applicability: false,
    agent_approval_required: true,
    human_approval_required: true,
    engine_build: HOTMA_APPLICABILITY_GATE_BUILD,
    ...details,
  });
}

function normalizedAuthorityRecords(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((record) => record && typeof record === "object" && !Array.isArray(record))
    .map((record) => ({
      program_code: String(record.program_code ?? "").trim().toUpperCase(),
      authority_document_id: String(record.authority_document_id ?? "").trim(),
      authority_document_sha256: String(
        record.authority_document_sha256 ?? "",
      ).trim().toLowerCase(),
      citation: String(record.citation ?? "").trim(),
      program_applicability_validated:
        record.program_applicability_validated === true,
      effective_for_event_date_validated:
        record.effective_for_event_date_validated === true,
      source_status_conflict: record.source_status_conflict === true,
    }));
}

/**
 * Classify HOTMA scope from the full, documented property-program inventory.
 *
 * program_authority_records must contain one record for each HOTMA-covered
 * program selected for the property. It is intentionally impossible to turn
 * on the overlay with only a caller boolean or a state/county value.
 */
export function classifyHotmaApplicability(input = {}) {
  const programs = normalizePrograms(input.programs);
  if (!programs.length) {
    return blocked(
      "HOTMA_PROGRAM_INVENTORY_REQUIRED",
      "The property program inventory is required before HOTMA applicability can be determined.",
      ["programs"],
    );
  }

  const sharedMissing = [];
  if (!isNonEmptyString(input.property_id)) sharedMissing.push("property_id");
  if (input.program_inventory_validated !== true) {
    sharedMissing.push("program_inventory_validated");
  }
  if (input.assistance_sources_reconciled !== true) {
    sharedMissing.push("assistance_sources_reconciled");
  }
  if (sharedMissing.length) {
    return blocked(
      "HOTMA_PROGRAM_INVENTORY_NOT_VALIDATED",
      "HOTMA scope requires a complete, reconciled property assistance inventory owned by the property record.",
      sharedMissing,
      { programs },
    );
  }

  const coveredPrograms = programs.filter(
    (program) => PHA_PROGRAM_SET.has(program) || program === HOTMA_MFH_PROGRAM,
  );
  if (!coveredPrograms.length) {
    if (programs.length === 1 && programs[0] === "LIHTC") {
      return notApplicable(
        "LIHTC_ONLY_NO_HOTMA_TRIGGER",
        "LIHTC-only status does not establish HOTMA applicability.",
        { property_id: String(input.property_id), programs },
      );
    }
    return blocked(
      "HOTMA_NON_HUD_LAYER_REQUIRES_MANUAL_REVIEW",
      "No validated HOTMA-covered HUD assistance program is present. CertivoIQ will not infer HOTMA applicability from LIHTC, HOME, HTF, location, or another non-HUD layer.",
      ["documented_hotma_covered_program_authority_or_manual_review"],
      { property_id: String(input.property_id), programs },
    );
  }

  const records = normalizedAuthorityRecords(input.program_authority_records);
  const missing = [];
  const selectedAuthorityRecords = [];
  for (const program of coveredPrograms) {
    const matches = records.filter((record) => record.program_code === program);
    if (matches.length !== 1) {
      missing.push("program_authority_records[" + program + "]");
      continue;
    }
    const record = matches[0];
    selectedAuthorityRecords.push(record);
    if (!isNonEmptyString(record.authority_document_id)) {
      missing.push("program_authority_records[" + program + "].authority_document_id");
    }
    if (!SHA256_PATTERN.test(record.authority_document_sha256)) {
      missing.push("program_authority_records[" + program + "].authority_document_sha256");
    }
    if (!isNonEmptyString(record.citation)) {
      missing.push("program_authority_records[" + program + "].citation");
    }
    if (!record.program_applicability_validated) {
      missing.push("program_authority_records[" + program + "].program_applicability_validated");
    }
    if (!record.effective_for_event_date_validated) {
      missing.push("program_authority_records[" + program + "].effective_for_event_date_validated");
    }
    if (record.source_status_conflict) {
      missing.push("program_authority_records[" + program + "].source_status_conflict");
    }
  }

  let mfhProgramSubtype = null;
  if (coveredPrograms.includes(HOTMA_MFH_PROGRAM)) {
    mfhProgramSubtype = String(input.mfh_program_subtype ?? "")
      .trim()
      .toUpperCase();
    if (!MFH_PROGRAM_SUBTYPE_SET.has(mfhProgramSubtype)) {
      missing.push("mfh_program_subtype");
    }
  }

  if (missing.length) {
    return blocked(
      "HOTMA_PROGRAM_AUTHORITY_REQUIRED",
      "Each selected HOTMA-covered HUD program requires one current, cited, hash-identified authority record before scope can be determined.",
      missing,
      {
        property_id: String(input.property_id),
        programs,
        hotma_covered_programs: coveredPrograms,
      },
    );
  }

  const assetCapApplicable =
    coveredPrograms.some((program) => PHA_PROGRAM_SET.has(program)) ||
    (mfhProgramSubtype != null && MFH_ASSET_CAP_SUBTYPE_SET.has(mfhProgramSubtype));

  return applicable({
    property_id: String(input.property_id),
    programs,
    hotma_covered_programs: coveredPrograms,
    mfh_program_subtype: mfhProgramSubtype,
    asset_cap_applicable: assetCapApplicable,
    module_scope_required: coveredPrograms.includes(HOTMA_MFH_PROGRAM),
    authority_document_ids: selectedAuthorityRecords
      .map((record) => record.authority_document_id)
      .sort(),
    authority_manifest_sha256: authorityManifestSha256(selectedAuthorityRecords),
  });
}
