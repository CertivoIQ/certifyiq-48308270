/**
 * Production federal certification review orchestrator.
 *
 * The narrow vertical-slice checks and the broader eligibility, layered-program,
 * and recertification engines are evaluated as one conservative review. Missing
 * trusted scope never disappears: it becomes an explicit UNABLE_TO_DETERMINE
 * finding that blocks sign-off.
 */

import {
  EVIDENCE_STATUS,
  FINDING_STATUS,
  RULE_EVALUATION_STATUS,
  evaluateCertification,
  evaluateLayeredProgramRestrictions,
  evaluateRecertificationOccupancyControls,
  evaluateTenantFileEligibility,
  normalizeCertificationPrograms,
} from "./compliance-rule-engine.mjs";
import { classifyAllMfhHotmaOwnerSystemControls } from "./mfh-hotma-owner-system-engine.mjs";
import { classifyAllMfhHotmaModules } from "./mfh-hotma-rule-engine.mjs";
import { classifyAllPhaHotmaImplementationModules } from "./pha-hotma-implementation-engine.mjs";

export const FEDERAL_REVIEW_ORCHESTRATOR_BUILD =
  "federal-review-orchestrator-2026.08.6";
export const FEDERAL_REVIEW_PACK_VERSION = "2026.08.6";

const CONTROL = Object.freeze({
  tenantEligibility: Object.freeze({
    ruleId: "FED-TENANT-FILE-ELIGIBILITY-RECONCILIATION-001",
    title: "Federal tenant-file eligibility reconciliation",
    citation:
      "26 USC 42(g); 24 CFR 5.609, 5.612, and 5.618; 24 CFR 92.203; 7 CFR 3560.152",
  }),
  layeredPrograms: Object.freeze({
    ruleId: "FED-LAYERED-PROGRAM-RESTRICTIONS-001",
    title: "Layered affordable-housing program restrictions",
    citation:
      "26 USC 42(g)(2); 24 CFR 92.252; 24 CFR 93.302; 24 CFR parts 982 and 983; 7 CFR 3560.202; 26 USC 142(d)",
  }),
  recertification: Object.freeze({
    ruleId: "FED-RECERTIFICATION-OCCUPANCY-CONTROLS-001",
    title: "Federal recertification and occupancy controls",
    citation:
      "26 USC 42(g)(2)(D) and 42(g)(8); 26 CFR 1.42-15; 24 CFR 5.657 and 982.516",
  }),
  certificationType: Object.freeze({
    ruleId: "FED-CERTIFICATION-TYPE-SCOPE-GATE-001",
    title: "Certification event type scope",
    citation: "Applicable federal program certification-cycle authority",
  }),
  mfhHotmaOperations: Object.freeze({
    ruleId: "MFH-HOTMA-OPERATIONAL-CONTROL",
    title: "HUD Multifamily HOTMA owner-policy and system control",
    citation: "HUD Notices H-2025-07 and H-2023-10 / PIH-2023-27 REV-3",
  }),
});

function blockedControl(reasonCode, reason, missingInputs = []) {
  return {
    resolution_status: "NOT_DETERMINED",
    determination_status: "NOT_DETERMINED",
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    reason_code: reasonCode,
    reason,
    missing_inputs: missingInputs,
    human_approval_required: true,
  };
}

function normalizedStatus(result) {
  if (result?.finding === "PASS") return FINDING_STATUS.pass;
  if (result?.finding === "FAIL") return FINDING_STATUS.fail;
  return FINDING_STATUS.unableToDetermine;
}

function collectBlockingReasons(result) {
  const reasons = [];
  if (result?.reason_code) reasons.push(String(result.reason_code));
  if (result?.reason) reasons.push(String(result.reason));
  if (Array.isArray(result?.missing_inputs) && result.missing_inputs.length) {
    reasons.push(`Missing or unvalidated inputs: ${result.missing_inputs.join(", ")}.`);
  }
  for (const blocker of Array.isArray(result?.blockers) ? result.blockers : []) {
    if (blocker?.reason_code) reasons.push(String(blocker.reason_code));
    if (blocker?.reason) reasons.push(String(blocker.reason));
    if (Array.isArray(blocker?.missing_inputs) && blocker.missing_inputs.length) {
      reasons.push(
        `Missing or unvalidated inputs: ${blocker.missing_inputs.join(", ")}.`,
      );
    }
  }
  return [...new Set(reasons)];
}

function controlFinding(control, result) {
  const status = normalizedStatus(result);
  const blocked =
    status === FINDING_STATUS.unableToDetermine ||
    result?.rule_engine_authority !== "ALLOWED";
  const reasons = collectBlockingReasons(result);
  const explanation =
    result?.reason ??
    (status === FINDING_STATUS.pass
      ? "All supplied, validated control inputs passed."
      : status === FINDING_STATUS.fail
        ? "The deterministic control confirmed one or more failures."
        : "Required trusted scope or evidence is incomplete.");

  return {
    ruleId: result?.rule_id ?? control.ruleId,
    ruleVersion: result?.engine_build ?? FEDERAL_REVIEW_ORCHESTRATOR_BUILD,
    rulePackId: "federal-review-orchestration",
    rulePackVersion: FEDERAL_REVIEW_PACK_VERSION,
    jurisdiction: "federal",
    severity: "critical",
    citation: control.citation,
    engineBuild: FEDERAL_REVIEW_ORCHESTRATOR_BUILD,
    evidenceStatus: blocked
      ? EVIDENCE_STATUS.notDetermined
      : EVIDENCE_STATUS.resolved,
    ruleEvaluationStatus: blocked
      ? RULE_EVALUATION_STATUS.blocked
      : RULE_EVALUATION_STATUS.evaluated,
    status,
    explanation: `${control.title}. ${explanation}`,
    blockingReasons:
      status === FINDING_STATUS.unableToDetermine
        ? reasons.length
          ? reasons
          : ["The deterministic control did not receive complete validated inputs."]
        : [],
    evidenceRefs: [],
  };
}

function countsFor(findings) {
  return findings.reduce(
    (counts, finding) => {
      if (finding.status === FINDING_STATUS.pass) counts.pass += 1;
      else if (finding.status === FINDING_STATUS.fail) counts.fail += 1;
      else counts.unableToDetermine += 1;
      return counts;
    },
    { pass: 0, fail: 0, unableToDetermine: 0 },
  );
}

/**
 * Evaluate the production review and retain every unresolved broader control.
 *
 * Structured inputs must come from trusted server-side records. The orchestrator
 * deliberately does not manufacture validation booleans from extracted text.
 */
export function evaluateFederalCertificationReview(input = {}) {
  const programs = normalizeCertificationPrograms(input.programs);
  const core = evaluateCertification({
    facts: input.facts ?? [],
    programs,
    jurisdiction: input.jurisdiction,
    statePack: input.statePack,
    hotmaApplicable: input.hotmaApplicable,
    hotmaApplicabilityInput: input.hotmaApplicabilityInput,
  });

  const tenantEligibility = evaluateTenantFileEligibility({
    ...(input.tenantFileInput ?? {}),
    program_inventory:
      input.tenantFileInput?.program_inventory ?? programs,
  });

  const certificationType = String(input.certificationType ?? "")
    .trim()
    .toUpperCase();
  let recertification = null;
  if (["ANNUAL", "INTERIM"].includes(certificationType)) {
    recertification = evaluateRecertificationOccupancyControls({
      ...(input.recertificationInput ?? {}),
      program_inventory:
        input.recertificationInput?.program_inventory ?? programs,
    });
  } else if (certificationType !== "INITIAL") {
    recertification = blockedControl(
      "CERTIFICATION_TYPE_NOT_DECLARED",
      "The review cannot determine whether recertification and occupancy controls apply until the event is classified as INITIAL, ANNUAL, or INTERIM.",
      ["certificationType"],
    );
  }

  const layeredPrograms =
    programs.length > 1 || input.layeredProgramInput
      ? evaluateLayeredProgramRestrictions({
          ...(input.layeredProgramInput ?? {}),
          applicable_program_codes:
            input.layeredProgramInput?.applicable_program_codes ?? programs,
        })
      : null;

  const mfhHotma = programs.includes("HUD_MFH_PROJECT_BASED")
    ? classifyAllMfhHotmaModules(input.mfhHotmaInput ?? {})
    : null;

  const mfhHotmaOperations = programs.includes("HUD_MFH_PROJECT_BASED")
    ? classifyAllMfhHotmaOwnerSystemControls(
        input.mfhHotmaOperationsInput ?? {},
      )
    : null;

  const phaHotmaPrograms = programs.filter((program) =>
    ["HCV_TENANT_BASED", "HUD_PBV", "PUBLIC_HOUSING"].includes(program),
  );
  const phaHotma = phaHotmaPrograms.length
    ? phaHotmaPrograms.map((program) => ({
        program,
        ...classifyAllPhaHotmaImplementationModules({
          ...(input.phaHotmaInput ?? {}),
          program,
        }),
      }))
    : null;

  const mfhOperationalBlockingFindings =
    mfhHotmaOperations?.classifications
      ?.filter(
        (classification) =>
          classification?.rule_engine_authority === "BLOCKED" ||
          classification?.finding === "UNABLE_TO_DETERMINE",
      )
      .map((classification) =>
        controlFinding(CONTROL.mfhHotmaOperations, classification),
      ) ?? [];

  const controlFindings = [
    controlFinding(CONTROL.tenantEligibility, tenantEligibility),
    ...(recertification
      ? [controlFinding(
          certificationType
            ? CONTROL.recertification
            : CONTROL.certificationType,
          recertification,
        )]
      : []),
    ...(layeredPrograms
      ? [controlFinding(CONTROL.layeredPrograms, layeredPrograms)]
      : []),
    ...mfhOperationalBlockingFindings,
  ];
  const findings = [...core.findings, ...controlFindings];

  return {
    engineBuild: FEDERAL_REVIEW_ORCHESTRATOR_BUILD,
    rulePackId: core.rulePackId,
    rulePackVersion: core.rulePackVersion,
    statePackApplied: core.statePackApplied,
    programs,
    findings,
    counts: countsFor(findings),
    controlResults: {
      tenantEligibility,
      recertification,
      layeredPrograms,
      mfhHotma,
      mfhHotmaOperations,
      hotmaApplicability: core.hotmaApplicability,
      phaHotma,
    },
  };
}
