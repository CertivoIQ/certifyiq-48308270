/**
 * Compliance procedure registry and recertification blocker inventory.
 *
 * Phase 1 deliberately inventories installed deterministic state procedures but
 * never executes them. Raw or client-supplied event dates and procedure inputs
 * are not accepted. Until a server-side adapter builds source-bound trusted
 * records, every applicable state procedure remains UNABLE_TO_DETERMINE.
 */

import { evaluateRecertificationOccupancyControls } from "./recertification-occupancy-controls.mjs";
import * as mo from "./mo-lihtc-compliance-rule-pack.mjs";
import * as nc from "./nc-lihtc-compliance-rule-pack.mjs";
import * as nd from "./nd-lihtc-compliance-rule-pack.mjs";
import * as ne from "./ne-lihtc-compliance-rule-pack.mjs";
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
  "compliance-procedure-registry-2026.09.1";

export const COMPLIANCE_PROCEDURE_SCAN_MODE = Object.freeze({
  blockerInventory: "BLOCKER_INVENTORY",
  notApplicable: "NOT_APPLICABLE",
});

const STATE_MODULES = Object.freeze({
  MO: mo,
  NC: nc,
  ND: nd,
  NE: ne,
  NH: nh,
  NJ: nj,
  NY: ny,
  OH: oh,
  OK: ok,
  OR: or,
  PA: pa,
  RI: ri,
  SC: sc,
  SD: sd,
  TN: tn,
  TX: tx,
  VT: vt,
  WA: wa,
  WI: wi,
  WV: wv,
  WY: wy,
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
  if (value.includes("INCOME") || value.includes("LIMIT")) {
    return "INCOME_ELIGIBILITY";
  }
  if (value.includes("STUDENT")) return "STUDENT_ELIGIBILITY";
  if (value.includes("AVAILABLEUNIT") || value.includes("OVERINCOME")) {
    return "OCCUPANCY";
  }
  if (value.includes("REPORT") || value.includes("CERTIFICATION")) {
    return "REPORTING";
  }
  if (value.includes("MINIMUMSETASIDE") || value.includes("AVERAGE")) {
    return "PROJECT_ELECTION";
  }
  return "CONTINUING_COMPLIANCE";
};

const moduleBuild = (module) =>
  Object.entries(module).find(
    ([name, value]) => name.endsWith("_BUILD") && typeof value === "string",
  )?.[1] ?? COMPLIANCE_PROCEDURE_REGISTRY_BUILD;

const moduleEffectiveFrom = (module) =>
  Object.entries(module).find(
    ([name, value]) =>
      name.endsWith("_EFFECTIVE_FROM") && typeof value === "string",
  )?.[1] ?? null;

const sourceCitation = (module) => {
  const source = Object.entries(module).find(([name]) =>
    /_SOURCE(?:S)?$/.test(name),
  )?.[1];
  if (!source) return "Controlled state compliance rule pack";
  const records = Array.isArray(source) ? source : [source];
  return (
    records
      .map((record) =>
        typeof record === "string"
          ? record
          : record?.citation ??
            record?.title ??
            record?.url ??
            record?.source_url,
      )
      .filter(Boolean)
      .join("; ") || "Controlled state compliance rule pack"
  );
};

function buildStateProcedures() {
  return Object.entries(STATE_MODULES).flatMap(([stateCode, module]) =>
    Object.entries(module)
      .filter(
        ([name, value]) =>
          name.startsWith("evaluate") && typeof value === "function",
      )
      .map(([name]) =>
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
        }),
      ),
  );
}

const STATE_PROCEDURES = Object.freeze(buildStateProcedures());

export function listComplianceProcedures(filters = {}) {
  const stateCode = String(filters.stateCode ?? "").trim().toUpperCase();
  const category = String(filters.category ?? "").trim().toUpperCase();
  return STATE_PROCEDURES
    .filter(
      (procedure) => !stateCode || procedure.jurisdiction === stateCode,
    )
    .filter((procedure) => !category || procedure.category === category)
    .map((procedure) => ({ ...procedure }));
}

function parseDate(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== text
    ? null
    : text;
}

function normalizePrograms(programs) {
  if (!Array.isArray(programs)) return [];
  return [
    ...new Set(
      programs
        .map((program) => String(program ?? "").trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

function statePackIdentityGate(pack, stateCode) {
  const packState = String(
    pack?.state_code ?? pack?.jurisdiction ?? pack?.code ?? "",
  )
    .trim()
    .toUpperCase();
  const effectiveFrom = parseDate(pack?.effectiveFrom ?? pack?.effective_from);
  const effectiveToRaw = pack?.effectiveTo ?? pack?.effective_to;
  const hasEffectiveTo =
    effectiveToRaw !== undefined &&
    effectiveToRaw !== null &&
    String(effectiveToRaw).trim() !== "";
  const effectiveTo = hasEffectiveTo ? parseDate(effectiveToRaw) : null;
  const allowed = Boolean(
    pack &&
      String(pack.status ?? "").trim().toUpperCase() === "VALIDATED" &&
      (pack.approvedBy || pack.approved_by) &&
      pack.version &&
      Number(pack.validatedRuleCount ?? pack.validated_rule_count) > 0 &&
      packState === stateCode &&
      effectiveFrom &&
      (!hasEffectiveTo || effectiveTo),
  );
  return allowed
    ? { allowed: true, effectiveFrom, effectiveTo }
    : {
        allowed: false,
        reasonCode: "STATE_COMPLIANCE_PROCEDURE_PACK_NOT_VALIDATED",
        reason:
          "State procedure inventory requires an approved, versioned rule pack with a valid effective window bound to the certification state.",
      };
}

function trustedEventDateGate(record) {
  const value = parseDate(record?.value);
  const sourceRecordId = String(record?.sourceRecordId ?? "").trim();
  const sourceDocumentRef = String(record?.sourceDocumentRef ?? "").trim();
  const sourceSha256 = String(record?.sourceSha256 ?? "")
    .trim()
    .toLowerCase();
  const allowed = Boolean(
    record &&
      record.provenance === "SERVER_RECORD" &&
      record.humanVerified === true &&
      sourceRecordId &&
      sourceDocumentRef &&
      /^[a-f0-9]{64}$/.test(sourceSha256) &&
      value,
  );
  return allowed
    ? { allowed: true, value }
    : {
        allowed: false,
        reasonCode: "STATE_COMPLIANCE_PROCEDURE_EVENT_DATE_NOT_TRUSTED",
        reason:
          "State procedures require a human-verified event date built server-side and bound to a source record, document reference, and SHA-256 digest. Raw dates and extracted client facts are not trusted inputs.",
      };
}

function statePackWindowGate(packWindow, eventDate) {
  const allowed =
    packWindow.effectiveFrom <= eventDate &&
    (!packWindow.effectiveTo || eventDate <= packWindow.effectiveTo);
  return allowed
    ? { allowed: true }
    : {
        allowed: false,
        reasonCode: "STATE_COMPLIANCE_PROCEDURE_PACK_NOT_EFFECTIVE",
        reason:
          "The validated state rule pack is not effective for the trusted certification event date.",
      };
}

function inventoryFinding(procedure, reasonCode, reason, statePack) {
  return {
    procedureId: procedure.id,
    procedureName: procedure.name,
    procedureCategory: procedure.category,
    procedureProgram: procedure.program ?? "LIHTC",
    ruleId: procedure.id,
    ruleVersion: procedure.engineBuild,
    rulePackId:
      statePack?.id ??
      `state-${String(procedure.jurisdiction).toLowerCase()}-procedures`,
    rulePackVersion: statePack?.version ?? "UNVALIDATED",
    jurisdiction: procedure.jurisdiction,
    severity: "critical",
    citation: procedure.citation,
    engineBuild: COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
    evidenceStatus: "NOT_DETERMINED",
    ruleEvaluationStatus: "BLOCKED",
    status: "UNABLE_TO_DETERMINE",
    explanation: `${procedure.title}. ${reason}`,
    blockingReasons: [reasonCode, reason],
    evidenceRefs: [],
    humanApprovalRequired: true,
    inventoryOnly: true,
  };
}

function syntheticProcedure(stateCode, suffix, title) {
  return {
    id: `STATE-${stateCode || "UNKNOWN"}-${suffix}`,
    name: "stateProcedureInventory",
    title,
    category: "CONTINUING_COMPLIANCE",
    jurisdiction: stateCode || "STATE",
    program: "LIHTC",
    engineBuild: COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
    citation: "Controlled state compliance rule pack",
  };
}

function result({
  baseline,
  mode,
  stateCode,
  selectedProcedureCount,
  findings,
}) {
  return {
    registryBuild: COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
    mode,
    inventoryOnly: true,
    evaluationReady: false,
    baseline,
    stateCode,
    selectedProcedureCount,
    evaluatedProcedureCount: 0,
    findings,
  };
}

/**
 * Evaluate the federal recertification baseline and expose the applicable LIHTC
 * state procedures as fail-closed blockers. This phase has no procedure-input
 * execution path by design; unknown properties such as eventDate,
 * procedureInputs, or complianceProcedureInputs are ignored.
 */
export function scanRecertificationComplianceProcedures(input = {}) {
  const baseline = evaluateRecertificationOccupancyControls(
    input.recertificationInput ?? {},
  );
  const programs = normalizePrograms(input.programs);
  const stateCode = String(input.stateCode ?? input.jurisdiction ?? "")
    .trim()
    .toUpperCase();

  if (!programs.includes("LIHTC")) {
    return result({
      baseline,
      mode: COMPLIANCE_PROCEDURE_SCAN_MODE.notApplicable,
      stateCode: stateCode || null,
      selectedProcedureCount: 0,
      findings: [],
    });
  }

  if (!stateCode || stateCode === "US") {
    const procedure = syntheticProcedure(
      null,
      "JURISDICTION-REQUIRED",
      "LIHTC state compliance procedure jurisdiction",
    );
    return result({
      baseline,
      mode: COMPLIANCE_PROCEDURE_SCAN_MODE.blockerInventory,
      stateCode: null,
      selectedProcedureCount: 0,
      findings: [
        inventoryFinding(
          procedure,
          "STATE_COMPLIANCE_PROCEDURE_JURISDICTION_REQUIRED",
          "The LIHTC recertification does not identify the state whose compliance procedure inventory applies.",
          input.statePack,
        ),
      ],
    });
  }

  const procedures = STATE_PROCEDURES.filter(
    (procedure) => procedure.jurisdiction === stateCode,
  );
  if (!procedures.length) {
    const procedure = syntheticProcedure(
      stateCode,
      "PROCEDURE-INVENTORY",
      `${stateCode} LIHTC compliance procedure inventory`,
    );
    return result({
      baseline,
      mode: COMPLIANCE_PROCEDURE_SCAN_MODE.blockerInventory,
      stateCode,
      selectedProcedureCount: 0,
      findings: [
        inventoryFinding(
          procedure,
          "STATE_COMPLIANCE_PROCEDURE_INVENTORY_MISSING",
          "No deterministic LIHTC compliance procedure inventory is installed for this state.",
          input.statePack,
        ),
      ],
    });
  }

  const packGate = statePackIdentityGate(input.statePack, stateCode);
  if (!packGate.allowed) {
    return result({
      baseline,
      mode: COMPLIANCE_PROCEDURE_SCAN_MODE.blockerInventory,
      stateCode,
      selectedProcedureCount: procedures.length,
      findings: procedures.map((procedure) =>
        inventoryFinding(
          procedure,
          packGate.reasonCode,
          packGate.reason,
          input.statePack,
        ),
      ),
    });
  }

  const eventDateGate = trustedEventDateGate(input.trustedEventDate);
  if (!eventDateGate.allowed) {
    return result({
      baseline,
      mode: COMPLIANCE_PROCEDURE_SCAN_MODE.blockerInventory,
      stateCode,
      selectedProcedureCount: procedures.length,
      findings: procedures.map((procedure) =>
        inventoryFinding(
          procedure,
          eventDateGate.reasonCode,
          eventDateGate.reason,
          input.statePack,
        ),
      ),
    });
  }

  const windowGate = statePackWindowGate(packGate, eventDateGate.value);
  if (!windowGate.allowed) {
    return result({
      baseline,
      mode: COMPLIANCE_PROCEDURE_SCAN_MODE.blockerInventory,
      stateCode,
      selectedProcedureCount: procedures.length,
      findings: procedures.map((procedure) =>
        inventoryFinding(
          procedure,
          windowGate.reasonCode,
          windowGate.reason,
          input.statePack,
        ),
      ),
    });
  }

  const reasonCode =
    "COMPLIANCE_PROCEDURE_TRUSTED_INPUT_ADAPTER_NOT_WIRED";
  const reason =
    "This inventory does not accept raw or client-supplied procedure inputs. A server-side adapter must build and source-bind one validated input record per procedure before deterministic evaluation can be enabled.";
  return result({
    baseline,
    mode: COMPLIANCE_PROCEDURE_SCAN_MODE.blockerInventory,
    stateCode,
    selectedProcedureCount: procedures.length,
    findings: procedures.map((procedure) =>
      inventoryFinding(procedure, reasonCode, reason, input.statePack),
    ),
  });
}
