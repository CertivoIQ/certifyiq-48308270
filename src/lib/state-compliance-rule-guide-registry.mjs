import MANUAL_INDEX from "./state-compliance-manual-index.json" with { type: "json" };

export const STATE_COMPLIANCE_MANUAL_INDEX_VERSION = MANUAL_INDEX.schemaVersion;

export const STATE_RULE_GUIDE_CATEGORIES = Object.freeze([
  "TENANT_CERTIFICATION_AND_RECERTIFICATION",
  "INCOME_AND_ASSETS",
  "STUDENT_STATUS",
  "RENT_AND_UTILITY_ALLOWANCE",
  "HOUSEHOLD_AND_UNIT_CHANGES",
  "AVAILABLE_UNIT_AND_OVER_INCOME",
  "ANNUAL_OWNER_REPORTING",
  "RECORD_RETENTION",
  "INSPECTIONS_AND_CORRECTION",
  "LAYERED_PROGRAM_REQUIREMENTS",
]);

const BY_STATE = new Map(MANUAL_INDEX.states.map((source) => [source.code, source]));

export function listStateComplianceManualSources(filters = {}) {
  const status = String(filters.status ?? "").toUpperCase();
  return MANUAL_INDEX.states
    .filter((source) => !status || source.status === status)
    .map((source) => ({ ...source, activationAllowed: false }));
}

export function getStateComplianceRuleGuide(stateCode) {
  const code = String(stateCode ?? "").trim().toUpperCase();
  const source = BY_STATE.get(code);
  if (!source) return null;
  return {
    id: `STATE-${code}-COMPLIANCE-RULE-GUIDE`,
    jurisdiction: code,
    programScope: [...MANUAL_INDEX.programScope],
    manualIndexVersion: STATE_COMPLIANCE_MANUAL_INDEX_VERSION,
    source: { ...source },
    procedureCategories: [...STATE_RULE_GUIDE_CATEGORIES],
    status: MANUAL_INDEX.reviewPolicy.displayStatus,
    activationAllowed: false,
    incompleteFindingStatus: MANUAL_INDEX.reviewPolicy.findingWhenIncomplete,
    requiredActivationEvidence: [...MANUAL_INDEX.reviewPolicy.requiredForActivation],
  };
}

function validDate(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === text;
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/i.test(String(value ?? ""));
}

function hasPageCitations(pack) {
  return (
    Array.isArray(pack?.pageCitations ?? pack?.page_citations) &&
    (pack.pageCitations ?? pack.page_citations).length > 0 &&
    (pack.pageCitations ?? pack.page_citations).every((citation) =>
      Boolean(citation?.documentId && (citation?.page || citation?.section)),
    )
  );
}

export function gateStateComplianceRuleGuide(pack, stateCode, eventDate) {
  const code = String(stateCode ?? "").trim().toUpperCase();
  const guide = getStateComplianceRuleGuide(code);
  if (!guide) {
    return {
      allowed: false,
      reasonCode: "STATE_COMPLIANCE_RULE_GUIDE_MISSING",
      reason: "No controlled state compliance rule guide exists for this jurisdiction.",
    };
  }

  const packState = String(
    pack?.state_code ?? pack?.jurisdiction ?? pack?.code ?? "",
  ).toUpperCase();
  const effectiveFrom = pack?.effectiveFrom ?? pack?.effective_from;
  const effectiveTo = pack?.effectiveTo ?? pack?.effective_to;
  const approval = pack?.approval ?? {};
  const responsibleSignature =
    approval.signature ?? pack?.responsiblePartySignature ?? pack?.responsible_party_signature;
  const responsiblePosition =
    approval.position ?? pack?.responsiblePartyPosition ?? pack?.responsible_party_position;
  const sourceSha256 = pack?.sourceSha256 ?? pack?.source_sha256;
  const manualIndexVersion = pack?.manualIndexVersion ?? pack?.manual_index_version;
  const event = String(eventDate ?? "");

  const blockers = [];
  if (guide.source.status !== "PAGE_CITED_RULES_VALIDATED") {
    blockers.push("The official state source set is still pending final review.");
  }
  if (pack?.status !== "validated") blockers.push("The state rule pack is not validated.");
  if (packState !== code) blockers.push("The state rule pack jurisdiction does not match the scan.");
  if (manualIndexVersion !== STATE_COMPLIANCE_MANUAL_INDEX_VERSION) {
    blockers.push("The state rule pack is not bound to the current manual index version.");
  }
  if (!validSha256(sourceSha256)) blockers.push("An exact official-source SHA-256 is required.");
  if (!validDate(effectiveFrom)) blockers.push("A valid effective-from date is required.");
  if (!validDate(event)) blockers.push("A valid certification event date is required.");
  if (validDate(effectiveFrom) && validDate(event) && effectiveFrom > event) {
    blockers.push("The rule pack was not effective on the certification event date.");
  }
  if (effectiveTo && (!validDate(effectiveTo) || (validDate(event) && event > effectiveTo))) {
    blockers.push("The rule pack is outside its validated effective period.");
  }
  if (!hasPageCitations(pack)) blockers.push("Page- or section-level citations are required.");
  if (!responsibleSignature) blockers.push("Responsible-party signature is required.");
  if (!responsiblePosition) blockers.push("Responsible-party position is required.");
  if (Number(pack?.validatedRuleCount ?? pack?.validated_rule_count) < 1) {
    blockers.push("At least one independently validated procedure is required.");
  }

  return blockers.length
    ? {
        allowed: false,
        reasonCode: "STATE_COMPLIANCE_RULE_GUIDE_PENDING_FINAL_REVIEW",
        reason: blockers.join(" "),
        guide,
      }
    : { allowed: true, guide };
}
