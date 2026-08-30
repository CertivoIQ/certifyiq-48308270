/**
 * Compliance procedure registry and recertification scanner.
 *
 * Existing deterministic validation functions are exposed as discrete,
 * auditable procedures. State procedures never run unless the exact state pack
 * is validated, approved, versioned, effective, and bound to the state being
 * scanned. Missing procedure inputs block the procedure; they are never
 * inferred from unrelated fields.
 */

import { evaluateRecertificationOccupancyControls } from "./recertification-occupancy-controls.mjs";
import { getStateComplianceRuleGuide } from "./state-compliance-rule-guide-registry.mjs";
import * as mo from "./mo-lihtc-compliance-rule-pack.mjs";
import * as nc from "./nc-lihtc-compliance-rule-pack.mjs";
import * as nd from "./nd-lihtc-compliance-rule-pack.mjs";
import * as nh from "./nh-lihtc-compliance-rule-pack.mjs";
import * as nj from "./nj-lihtc-compliance-rule-pack.mjs";
import * as ny from "./ny-scoped-lihtc-compliance-rule-pack.mjs";
import * as oh from "./oh-lihtc-compliance-rule-pack.mjs";
import * as ok from "./ok-lihtc-compliance-rule-pack.mjs";
import * as or from "./or-lihtc-compliance-rule-pack.mjs";
import * as pa from "./pa-lihtc-compliance-rule-pack.mjs";
import * as ri from "./ri-lihtc-compliance-rule-pack.mjs";
import * as sc from "./sc-lihtc-compliance-rule-pack.mjs";
import * as sd from "./sd-lihtc-program-rule-pack.mjs";
import * as tn from "./tn-lihtc-monitoring-rule-pack.mjs";
import * as tx from "./tx-lihtc-monitoring-rule-pack.mjs";
import * as vt from "./vt-lihtc-ait-rule-pack.mjs";
import * as wa from "./wa-lihtc-deterministic-rule-pack.mjs";
import * as wi from "./wi-lihtc-deterministic-rule-pack.mjs";
import * as wv from "./wv-lihtc-deterministic-rule-pack.mjs";
import * as wy from "./wy-lihtc-deterministic-rule-pack.mjs";

export const COMPLIANCE_PROCEDURE_REGISTRY_BUILD =
  "compliance-procedure-registry-2026.08.1";

const STATE_MODULES = Object.freeze({
  MO: mo, NC: nc, ND: nd, NH: nh, NJ: nj, NY: ny, OH: oh, OK: ok,
  OR: or, PA: pa, RI: ri, SC: sc, SD: sd, TN: tn, TX: tx, VT: vt,
  WA: wa, WI: wi, WV: wv, WY: wy,
});

const toKebab = (value, stateCode = "") =>
  String(value)
    .replace(/^evaluate/, "")
    .replace(new RegExp(`^${stateCode}`, "i"), "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toUpperCase();

const titleFor = (name) =>
  String(name)
    .replace(/^evaluate/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .trim();

const categoryFor = (name) => {
  const value = String(name).toUpperCase();
  if (value.includes("RECERT")) return "RECERTIFICATION";
  if (value.includes("UTILITY")) return "UTILITY_ALLOWANCE";
  if (value.includes("RENT")) return "RENT";
  if (value.includes("INCOME") || value.includes("LIMIT")) return "INCOME_ELIGIBILITY";
  if (value.includes("STUDENT")) return "STUDENT_ELIGIBILITY";
  if (value.includes("AVAILABLEUNIT") || value.includes("OVERINCOME")) return "OCCUPANCY";
  if (value.includes("REPORT") || value.includes("CERTIFICATION")) return "REPORTING";
  if (value.includes("MINIMUMSETASIDE") || value.includes("AVERAGE")) return "PROJECT_ELECTION";
  return "CONTINUING_COMPLIANCE";
};

const moduleBuild = (module) => {
  const entry = Object.entries(module).find(([name, value]) =>
    name.endsWith("_BUILD") && typeof value === "string",
  );
  return entry?.[1] ?? COMPLIANCE_PROCEDURE_REGISTRY_BUILD;
};

const moduleEffectiveFrom = (module) => {
  const entry = Object.entries(module).find(([name, value]) =>
    name.endsWith("_EFFECTIVE_FROM") && typeof value === "string",
  );
  return entry?.[1] ?? null;
};

const sourceCitation = (module) => {
  const source = Object.entries(module).find(([name]) =>
    /_SOURCE(?:S)?$/.test(name),
  )?.[1];
  if (!source) return "Controlled state compliance rule pack";
  const records = Array.isArray(source) ? source : [source];
  return records
    .map((record) =>
      typeof record === "string"
        ? record
        : record?.citation ?? record?.title ?? record?.url ?? record?.source_url,
    )
    .filter(Boolean)
    .join("; ") || "Controlled state compliance rule pack";
};

function buildStateProcedures() {
  return Object.entries(STATE_MODULES).flatMap(([stateCode, module]) =>
    Object.entries(module)
      .filter(([name, value]) => name.startsWith("evaluate") && typeof value === "function")
      .map(([name, evaluate]) =>
        Object.freeze({
          id: `STATE-${stateCode}-${toKebab(name, stateCode)}`,
          name,
          title: titleFor(name),
          category: categoryFor(name),
          jurisdiction: stateCode,
          program: "LIHTC",
          engineBuild: moduleBuild(module),
          effectiveFrom: moduleEffectiveFrom(module),
          citation: sourceCitation(module),
          evaluate,
        }),
      ),
  );
}

const STATE_PROCEDURES = Object.freeze(buildStateProcedures());

export function listComplianceProcedures(filters = {}) {
  const stateCode = String(filters.stateCode ?? "").toUpperCase();
  const category = String(filters.category ?? "").toUpperCase();
  return STATE_PROCEDURES
    .filter((procedure) => !stateCode || procedure.jurisdiction === stateCode)
    .filter((procedure) => !category || procedure.category === category)
    .map(({ evaluate: _evaluate, ...procedure }) => ({ ...procedure }));
}

function parseDate(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== text
    ? null
    : text;
}

function statePackGate(pack, stateCode, eventDate) {
  const packState = String(
    pack?.state_code ?? pack?.jurisdiction ?? pack?.code ?? "",
  ).toUpperCase();
  const effectiveFrom = parseDate(pack?.effectiveFrom ?? pack?.effective_from);
  const effectiveTo = pack?.effectiveTo || pack?.effective_to
    ? parseDate(pack.effectiveTo ?? pack.effective_to)
    : null;
  const date = parseDate(eventDate);
  const usable = Boolean(
    pack &&
      pack.status === "validated" &&
      (pack.approvedBy || pack.approved_by) &&
      pack.version &&
      Number(pack.validatedRuleCount ?? pack.validated_rule_count) > 0 &&
      packState === stateCode &&
      effectiveFrom &&
      date &&
      effectiveFrom <= date &&
      (!effectiveTo || date <= effectiveTo),
  );
  return usable
    ? { allowed: true }
    : {
        allowed: false,
        reason_code: "STATE_COMPLIANCE_PROCEDURE_PACK_NOT_VALIDATED",
        reason:
          "State procedures require an approved, versioned, effective rule pack bound to the certification state and event date.",
      };
}

function normalizeStatus(result) {
  const value = String(
    result?.finding ??
      result?.determination_status ??
      result?.status ??
      result?.finding_classification ??
      "NOT_DETERMINED",
  ).toUpperCase();
  if (value === "PASS" || value === "COMPLIANT") return "PASS";
  if (value === "FAIL" || value === "NONCOMPLIANT") return "FAIL";
  return "UNABLE_TO_DETERMINE";
}

function blockedFinding(procedure, code, reason, statePack) {
  return {
    procedureId: procedure.id,
    procedureName: procedure.name,
    procedureCategory: procedure.category,
    ruleId: procedure.id,
    ruleVersion: procedure.engineBuild,
    rulePackId: statePack?.id ?? `state-${procedure.jurisdiction.toLowerCase()}-procedures`,
    rulePackVersion: statePack?.version ?? "UNVALIDATED",
    jurisdiction: procedure.jurisdiction,
    severity: "critical",
    citation: procedure.citation,
    engineBuild: COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
    evidenceStatus: "NOT_DETERMINED",
    ruleEvaluationStatus: "BLOCKED",
    status: "UNABLE_TO_DETERMINE",
    explanation: `${procedure.title}. ${reason}`,
    blockingReasons: [code, reason],
    evidenceRefs: [],
    humanApprovalRequired: true,
  };
}

function evaluatedFinding(procedure, result, statePack) {
  const status = normalizeStatus(result);
  const reason = result?.reason ?? result?.explanation ??
    (status === "PASS"
      ? "The supplied validated inputs passed this procedure."
      : status === "FAIL"
        ? "The deterministic procedure confirmed noncompliance."
        : "The procedure could not make a determination from validated inputs.");
  const missing = Array.isArray(result?.missing_inputs) ? result.missing_inputs : [];
  return {
    procedureId: procedure.id,
    procedureName: procedure.name,
    procedureCategory: procedure.category,
    ruleId: result?.rule_id ?? procedure.id,
    ruleVersion: result?.engine_build ?? procedure.engineBuild,
    rulePackId: statePack?.id ?? `state-${procedure.jurisdiction.toLowerCase()}-procedures`,
    rulePackVersion: statePack.version,
    jurisdiction: procedure.jurisdiction,
    severity: "critical",
    citation: procedure.citation,
    engineBuild: COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
    evidenceStatus: status === "UNABLE_TO_DETERMINE" ? "NOT_DETERMINED" : "RESOLVED",
    ruleEvaluationStatus: status === "UNABLE_TO_DETERMINE" ? "BLOCKED" : "EVALUATED",
    status,
    explanation: `${procedure.title}. ${reason}`,
    blockingReasons:
      status === "UNABLE_TO_DETERMINE"
        ? [result?.reason_code, reason, missing.length ? `Missing or unvalidated inputs: ${missing.join(", ")}.` : null].filter(Boolean)
        : [],
    evidenceRefs: [],
    procedureResult: result,
    humanApprovalRequired: true,
  };
}

/**
 * Run the federal recertification baseline plus every procedure in the
 * validated state pack. State procedure inputs are keyed by procedure ID or
 * evaluator export name so no value is silently reused across procedures.
 */
export function scanRecertificationComplianceProcedures(input = {}) {
  const baseline = evaluateRecertificationOccupancyControls(
    input.recertificationInput ?? {},
  );
  const stateCode = String(input.stateCode ?? input.jurisdiction ?? "").toUpperCase();
  const stateRuleGuide = getStateComplianceRuleGuide(stateCode);
  if (!stateCode || stateCode === "US") {
    return {
      registryBuild: COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
      baseline,
      stateCode: null,
      stateRuleGuide: null,
      selectedProcedureCount: 0,
      findings: [],
    };
  }

  const procedures = STATE_PROCEDURES.filter(
    (procedure) => procedure.jurisdiction === stateCode,
  );
  if (!procedures.length) {
    const synthetic = {
      id: `STATE-${stateCode}-PROCEDURE-INVENTORY`,
      name: "stateProcedureInventory",
      title: `${stateCode} compliance procedure inventory`,
      category: "CONTINUING_COMPLIANCE",
      jurisdiction: stateCode,
      engineBuild: COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
      citation: stateRuleGuide?.source?.url ?? "Controlled state compliance rule pack",
    };
    return {
      registryBuild: COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
      baseline,
      stateCode,
      stateRuleGuide,
      selectedProcedureCount: 0,
      findings: [blockedFinding(
        synthetic,
        "STATE_COMPLIANCE_PROCEDURE_INVENTORY_MISSING",
        "No validated deterministic procedure inventory is installed for this state.",
        input.statePack,
      )],
    };
  }

  const gate = statePackGate(
    input.statePack,
    stateCode,
    input.eventDate ?? input.recertificationInput?.event_date,
  );
  if (!gate.allowed) {
    return {
      registryBuild: COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
      baseline,
      stateCode,
      stateRuleGuide,
      selectedProcedureCount: procedures.length,
      findings: procedures.map((procedure) =>
        blockedFinding(procedure, gate.reason_code, gate.reason, input.statePack),
      ),
    };
  }

  const supplied = input.procedureInputs ?? {};
  const findings = procedures.map((procedure) => {
    const procedureInput = supplied[procedure.id] ?? supplied[procedure.name];
    if (!procedureInput || typeof procedureInput !== "object") {
      return blockedFinding(
        procedure,
        "COMPLIANCE_PROCEDURE_INPUT_NOT_SUPPLIED",
        "The recertification scan did not contain a dedicated validated input record for this procedure.",
        input.statePack,
      );
    }
    try {
      return evaluatedFinding(
        procedure,
        procedure.evaluate(procedureInput),
        input.statePack,
      );
    } catch (error) {
      return blockedFinding(
        procedure,
        "COMPLIANCE_PROCEDURE_EXECUTION_BLOCKED",
        error instanceof Error ? error.message : "The deterministic procedure could not execute.",
        input.statePack,
      );
    }
  });

  return {
    registryBuild: COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
    baseline,
    stateCode,
    stateRuleGuide,
    selectedProcedureCount: procedures.length,
    evaluatedProcedureCount: findings.filter((finding) => finding.ruleEvaluationStatus === "EVALUATED").length,
    findings,
  };
}
