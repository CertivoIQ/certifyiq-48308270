import { federalProgramPackGate } from "./federal-program-rule-pack-registry.mjs";
import {
  HOTMA_APPLICABILITY_RULE_ID,
  classifyHotmaApplicability,
} from "./hotma-applicability-gate.mjs";

/**
 * Deterministic compliance rule engine.
 *
 * AI never decides compliance. Extraction may propose facts; only the code in
 * this module turns facts into PASS / FAIL / UNABLE_TO_DETERMINE.
 *
 * Guardrails enforced here:
 *  - A rule marked `jurisdiction: 'state'` is only evaluated when a validated,
 *    approved, versioned state pack is supplied. Otherwise the finding is
 *    UNABLE_TO_DETERMINE with a federal-baseline blocking reason.
 *  - Any required fact that is missing, unparsable, or below the confidence
 *    policy without human verification yields UNABLE_TO_DETERMINE — never a
 *    guessed PASS or FAIL.
 */

export const ENGINE_BUILD = "rule-engine-2026.08.5";
export const MINIMUM_CONFIDENCE = 0.85;

export const FINDING_STATUS = Object.freeze({
  pass: "PASS",
  fail: "FAIL",
  unableToDetermine: "UNABLE_TO_DETERMINE",
});

export const EVIDENCE_STATUS = Object.freeze({
  resolved: "RESOLVED",
  conflicting: "CONFLICTING",
  notDetermined: "NOT_DETERMINED",
});

export const RULE_EVALUATION_STATUS = Object.freeze({
  evaluated: "EVALUATED",
  blocked: "BLOCKED",
});

/**
 * Catalog of the narrow rules already implemented by the vertical slice.
 * The catalog is never evaluated directly. buildCertificationRulePack()
 * selects only the rules that are applicable to the declared programs.
 */
const CERTIFICATION_RULE_CATALOG = Object.freeze({
  id: "certification-rule-catalog",
  version: "2026.08.5",
  jurisdiction: "US",
  status: "validated",
  effectiveFrom: "2026-01-01",
  rules: Object.freeze([
    {
      id: "LIHTC-TIC-SIGNATURE",
      version: "1.0.0",
      jurisdiction: "federal",
      severity: "critical",
      requires: ["tenant_signature_date", "certification_effective_date"],
      citation: "26 U.S.C. 42(g); IRS Form 8823 Guide, Ch. 4",
      description:
        "The tenant income certification must be signed on or before its effective date.",
      evaluate: (facts) => {
        const signed = Date.parse(String(facts.tenant_signature_date.value));
        const effective = Date.parse(
          String(facts.certification_effective_date.value),
        );
        if (Number.isNaN(signed) || Number.isNaN(effective)) {
          return {
            status: FINDING_STATUS.unableToDetermine,
            explanation:
              "Signature or effective date could not be parsed as a date.",
          };
        }
        return signed <= effective
          ? {
              status: FINDING_STATUS.pass,
              explanation:
                "Certification was signed on or before the effective date.",
            }
          : {
              status: FINDING_STATUS.fail,
              explanation: "Certification was signed after its effective date.",
            };
      },
    },
    {
      id: "LIHTC-INCOME-LIMIT-APPLICABLE",
      version: "2.0.0",
      jurisdiction: "federal",
      severity: "critical",
      requires: [
        "household_annual_income",
        "applicable_lihtc_income_limit",
        "lihtc_income_limit_basis_pct",
        "lihtc_minimum_set_aside_election",
        "controlled_income_limit_receipt",
      ],
      citation: "26 U.S.C. 42(g)(1); HUD MTSP income limits",
      description:
        "Household annual income must not exceed the controlled LIHTC limit selected for the project's irrevocable minimum-set-aside election and, for an average-income project, the unit's taxpayer-designated imputed income limitation.",
      evaluate: (facts) => {
        const income = Number(facts.household_annual_income.value);
        const limit = Number(facts.applicable_lihtc_income_limit.value);
        const basis = Number(facts.lihtc_income_limit_basis_pct.value);
        const election = String(
          facts.lihtc_minimum_set_aside_election.value,
        )
          .trim()
          .toUpperCase()
          .replace(/[ _]/g, "-");
        const averageIncomeElection = election.startsWith("AVERAGE-INCOME");
        const validElection =
          election === "20-50" ||
          election === "40-60" ||
          averageIncomeElection;
        if (!validElection) {
          return {
            status: FINDING_STATUS.unableToDetermine,
            explanation:
              "The LIHTC minimum-set-aside election is missing or is not recognized as 20-50, 40-60, or average-income.",
          };
        }
        const validBasis =
          (election === "20-50" && basis === 50) ||
          (election === "40-60" && basis === 60) ||
          (averageIncomeElection &&
            [20, 30, 40, 50, 60, 70, 80].includes(basis));
        if (!validBasis) {
          return {
            status: FINDING_STATUS.unableToDetermine,
            explanation:
              "The income-limit basis is inconsistent with the declared LIHTC election or is not an allowed average-income designation.",
          };
        }
        if (!Number.isFinite(income) || !Number.isFinite(limit) || limit <= 0) {
          return {
            status: FINDING_STATUS.unableToDetermine,
            explanation:
              "Household income or the controlled applicable LIHTC income limit is not a usable number.",
          };
        }
        return income <= limit
          ? {
              status: FINDING_STATUS.pass,
              explanation: `Household income ${income} is within the controlled ${basis}% limit ${limit}.`,
            }
          : {
              status: FINDING_STATUS.fail,
              explanation: `Household income ${income} exceeds the controlled ${basis}% limit ${limit}.`,
            };
      },
    },
    {
      id: "HOTMA-ASSET-CAP",
      version: "1.0.0",
      jurisdiction: "federal",
      severity: "major",
      requires: ["household_net_assets", "hotma_asset_cap"],
      citation: "HOTMA Sec. 102/104; 24 CFR 5.618",
      description:
        "Net family assets above the HOTMA cap require documented eligibility treatment.",
      evaluate: (facts) => {
        const assets = Number(facts.household_net_assets.value);
        const cap = Number(facts.hotma_asset_cap.value);
        if (!Number.isFinite(assets) || !Number.isFinite(cap) || cap <= 0) {
          return {
            status: FINDING_STATUS.unableToDetermine,
            explanation: "Net assets or the HOTMA cap is not a usable number.",
          };
        }
        return assets <= cap
          ? {
              status: FINDING_STATUS.pass,
              explanation: `Net assets ${assets} are at or below the HOTMA cap ${cap}.`,
            }
          : {
              status: FINDING_STATUS.fail,
              explanation: `Net assets ${assets} exceed the HOTMA cap ${cap}.`,
            };
      },
    },
    {
      id: "STATE-QAP-UTILITY-ALLOWANCE",
      version: "1.0.0",
      jurisdiction: "state",
      severity: "major",
      requires: [
        "utility_allowance_source",
        "gross_rent",
        "state_max_gross_rent",
      ],
      citation: "State QAP / agency compliance manual (pack-specific)",
      description:
        "Gross rent including the state-approved utility allowance must not exceed the state maximum.",
      evaluate: (facts) => {
        const rent = Number(facts.gross_rent.value);
        const max = Number(facts.state_max_gross_rent.value);
        if (!Number.isFinite(rent) || !Number.isFinite(max) || max <= 0) {
          return {
            status: FINDING_STATUS.unableToDetermine,
            explanation:
              "Gross rent or state maximum rent is not a usable number.",
          };
        }
        return rent <= max
          ? {
              status: FINDING_STATUS.pass,
              explanation: `Gross rent ${rent} is within the state maximum ${max}.`,
            }
          : {
              status: FINDING_STATUS.fail,
              explanation: `Gross rent ${rent} exceeds the state maximum ${max}.`,
            };
      },
    },
  ]),
});

const catalogRule = (ruleId) => {
  const rule = CERTIFICATION_RULE_CATALOG.rules.find((entry) => entry.id === ruleId);
  if (!rule) throw new Error(`Rule catalog entry ${ruleId} is missing.`);
  return rule;
};

export const CERTIFICATION_PROGRAM = Object.freeze({
  lihtc: "LIHTC",
  home: "HOME",
  htf: "HTF",
  hcvTenantBased: "HCV_TENANT_BASED",
  hudPbv: "HUD_PBV",
  hudMfhProjectBased: "HUD_MFH_PROJECT_BASED",
  publicHousing: "PUBLIC_HOUSING",
  ruralDevelopment: "RURAL_DEVELOPMENT",
  taxExemptBond: "TAX_EXEMPT_BOND",
});

const CERTIFICATION_PROGRAM_VALUES = new Set(Object.values(CERTIFICATION_PROGRAM));
export const FEDERAL_LIHTC_PACK = Object.freeze({
  id: "federal-lihtc",
  version: "2026.08.5",
  jurisdiction: "US",
  status: "validated",
  effectiveFrom: "2026-01-01",
  rules: Object.freeze([
    catalogRule("LIHTC-TIC-SIGNATURE"),
    catalogRule("LIHTC-INCOME-LIMIT-APPLICABLE"),
  ]),
});

export const HOTMA_ASSET_CAP_OVERLAY_PACK = Object.freeze({
  id: "federal-hotma-asset-cap-overlay",
  version: "2026.08.5",
  jurisdiction: "US",
  status: "validated",
  effectiveFrom: "2026-01-01",
  rules: Object.freeze([catalogRule("HOTMA-ASSET-CAP")]),
});

export const STATE_QAP_OVERLAY_PACK = Object.freeze({
  id: "state-qap-overlay",
  version: "2026.08.5",
  jurisdiction: "state",
  status: "validated",
  effectiveFrom: "2026-01-01",
  rules: Object.freeze([catalogRule("STATE-QAP-UTILITY-ALLOWANCE")]),
});

export function normalizeCertificationPrograms(programs) {
  const requested =
    programs == null
      ? [CERTIFICATION_PROGRAM.lihtc]
      : Array.isArray(programs)
        ? programs
        : [programs];
  const normalized = [...new Set(requested.map((program) => String(program).trim().toUpperCase()))]
    .filter(Boolean)
    .sort();
  if (!normalized.length) {
    throw new TypeError("At least one certification program must be declared.");
  }
  const unsupported = normalized.filter((program) => !CERTIFICATION_PROGRAM_VALUES.has(program));
  if (unsupported.length) {
    throw new RangeError(`Unsupported certification program(s): ${unsupported.join(", ")}.`);
  }
  return normalized;
}

function substantivePackGate(program) {
  return federalProgramPackGate(program);
}

function hotmaApplicabilityGateRule(applicability) {
  return {
    id: HOTMA_APPLICABILITY_RULE_ID,
    version: "1.0.0",
    jurisdiction: "federal",
    severity: "critical",
    requires: [],
    citation: "24 CFR 5.601; documented property assistance authority",
    description:
      "HOTMA applicability could not be determined from the documented property program inventory.",
    activationStatus: "blocked",
    evaluate: () => ({
      status: FINDING_STATUS.unableToDetermine,
      explanation:
        applicability.reason ??
        "A complete, documented HOTMA program applicability determination is required.",
    }),
  };
}

/**
 * Build the only pack that the vertical slice may evaluate for this review.
 * HOTMA scope is determined from documented property assistance authority and
 * is never inferred from LIHTC participation, state, county, or a caller flag.
 */
export function buildCertificationRulePack(input = {}) {
  const programs = normalizeCertificationPrograms(input.programs);
  const hotmaApplicability = classifyHotmaApplicability({
    ...(input.hotmaApplicabilityInput ?? {}),
    programs,
  });
  const rules = [];
  if (programs.includes(CERTIFICATION_PROGRAM.lihtc)) {
    rules.push(...FEDERAL_LIHTC_PACK.rules);
  }
  for (const program of programs) {
    if (program !== CERTIFICATION_PROGRAM.lihtc) rules.push(substantivePackGate(program));
  }

  if (
    hotmaApplicability.applicability_status === "APPLICABLE" &&
    hotmaApplicability.asset_cap_applicable === true
  ) {
    rules.push(...HOTMA_ASSET_CAP_OVERLAY_PACK.rules);
  }
  if (hotmaApplicability.applicability_status === "UNABLE_TO_DETERMINE") {
    rules.push(hotmaApplicabilityGateRule(hotmaApplicability));
  }

  if (String(input.jurisdiction ?? "US").toUpperCase() !== "US") {
    rules.push(...STATE_QAP_OVERLAY_PACK.rules);
  }

  const overlayIds = [
    hotmaApplicability.applicability_status === "APPLICABLE" &&
    hotmaApplicability.asset_cap_applicable === true
      ? "hotma-asset-cap"
      : null,
    hotmaApplicability.applicability_status === "UNABLE_TO_DETERMINE"
      ? "hotma-applicability-gate"
      : null,
    String(input.jurisdiction ?? "US").toUpperCase() !== "US" ? "state-qap" : null,
  ].filter(Boolean);

  return Object.freeze({
    id:
      "program-applicable:" +
      programs.join("+") +
      (overlayIds.length ? "+" + overlayIds.join("+") : ""),
    version: "2026.08.5",
    jurisdiction: "US",
    status: "validated",
    effectiveFrom: "2026-01-01",
    programs: Object.freeze(programs),
    hotmaApplicability,
    rules: Object.freeze(rules),
  });
}

/** A state pack is usable only when independently approved and versioned. */
export function isStatePackUsable(pack) {
  return Boolean(
    pack &&
    pack.status === "validated" &&
    pack.approvedBy &&
    pack.effectiveFrom &&
    pack.version &&
    Number(pack.validatedRuleCount) > 0,
  );
}

function factUsable(fact, minimumConfidence) {
  if (!fact) return { usable: false, reason: "missing" };
  if (fact.value === null || fact.value === undefined || fact.value === "")
    return { usable: false, reason: "empty" };
  if (!fact.humanVerified && Number(fact.confidence) < minimumConfidence)
    return { usable: false, reason: "low_confidence" };
  return { usable: true };
}

function comparableValueKey(value) {
  if (typeof value === "number")
    return Number.isFinite(value)
      ? `number:${value}`
      : `number:${String(value)}`;
  if (typeof value === "string") return `string:${value.trim()}`;
  return `${typeof value}:${JSON.stringify(value)}`;
}

function evidenceValueLabel(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function evidenceSourceLabel(fact) {
  const document = fact.sourceDocumentRef ?? "unknown document";
  return fact.page == null ? document : `${document} page ${fact.page}`;
}

/**
 * Reconcile every source for one extracted field before any rule may use it.
 * A disagreement is never resolved by array order, confidence, or AI choice.
 */
export function reconcileEvidenceField(field, fieldFacts = []) {
  const present = fieldFacts.filter(
    (fact) =>
      fact &&
      fact.value !== null &&
      fact.value !== undefined &&
      fact.value !== "",
  );
  if (!present.length) {
    return {
      field,
      status: EVIDENCE_STATUS.notDetermined,
      fact: null,
      facts: [],
      conflictingValues: [],
    };
  }

  const byValue = new Map();
  for (const fact of present) {
    const key = comparableValueKey(fact.value);
    const existing = byValue.get(key) ?? [];
    existing.push(fact);
    byValue.set(key, existing);
  }

  if (byValue.size > 1) {
    return {
      field,
      status: EVIDENCE_STATUS.conflicting,
      fact: null,
      facts: present,
      conflictingValues: [...byValue.values()].map((facts) => ({
        value: facts[0].value,
        sources: facts.map(evidenceSourceLabel),
      })),
    };
  }

  const fact = [...present].sort((left, right) => {
    const verificationDelta =
      Number(Boolean(right.humanVerified)) -
      Number(Boolean(left.humanVerified));
    if (verificationDelta) return verificationDelta;
    return Number(right.confidence ?? 0) - Number(left.confidence ?? 0);
  })[0];

  return {
    field,
    status: EVIDENCE_STATUS.resolved,
    fact,
    facts: present,
    conflictingValues: [],
  };
}

function evidenceRefs(factsByField, fields) {
  return fields.flatMap((field) =>
    (factsByField[field] ?? []).map((fact) => ({
      field: fact.field,
      documentRef: fact.sourceDocumentRef ?? null,
      page: fact.page ?? null,
      snippet: fact.snippet ?? null,
      confidence: Number(fact.confidence ?? 0),
      humanVerified: Boolean(fact.humanVerified),
    })),
  );
}

/**
 * Evaluate a fact set against a rule pack.
 *
 * @param {{ facts: readonly object[], pack?: object, programs?: readonly string[], hotmaApplicable?: boolean, statePack?: object|null, jurisdiction?: string, minimumConfidence?: number }} input
 */
export function evaluateCertification(input) {
  const jurisdiction = String(input.jurisdiction ?? "US").toUpperCase();
  const pack =
    input.pack ??
    buildCertificationRulePack({
      programs: input.programs,
      hotmaApplicabilityInput: input.hotmaApplicabilityInput,
      jurisdiction,
    });
  const minimumConfidence = Number.isFinite(input.minimumConfidence)
    ? input.minimumConfidence
    : MINIMUM_CONFIDENCE;
  const statePackUsable = isStatePackUsable(input.statePack);

  const factsByField = {};
  for (const fact of input.facts ?? []) {
    if (!fact?.field) continue;
    (factsByField[fact.field] ??= []).push(fact);
  }

  const findings = pack.rules.map((rule) => {
    const reconciliations = Object.fromEntries(
      rule.requires.map((field) => [
        field,
        reconcileEvidenceField(field, factsByField[field]),
      ]),
    );
    const conflict = rule.requires.some(
      (field) => reconciliations[field].status === EVIDENCE_STATUS.conflicting,
    );
    const unresolved = rule.requires.some(
      (field) =>
        reconciliations[field].status === EVIDENCE_STATUS.notDetermined,
    );
    const evidenceStatus = conflict
      ? EVIDENCE_STATUS.conflicting
      : unresolved
        ? EVIDENCE_STATUS.notDetermined
        : EVIDENCE_STATUS.resolved;

    const base = {
      ruleId: rule.id,
      ruleVersion: rule.version,
      rulePackId: pack.id,
      rulePackVersion: pack.version,
      jurisdiction: rule.jurisdiction === "state" ? jurisdiction : "federal",
      severity: rule.severity,
      citation: rule.citation,
      engineBuild: ENGINE_BUILD,
      evidenceStatus,
      evidenceRefs: evidenceRefs(factsByField, rule.requires),
    };

    if (rule.activationStatus === "blocked") {
      const outcome = rule.evaluate({});
      return {
        ...base,
        status: FINDING_STATUS.unableToDetermine,
        ruleEvaluationStatus: RULE_EVALUATION_STATUS.blocked,
        explanation: `${rule.description} ${outcome.explanation}`,
        blockingReasons: [outcome.explanation],
      };
    }

    if (rule.jurisdiction === "state" && !statePackUsable) {
      return {
        ...base,
        status: FINDING_STATUS.unableToDetermine,
        ruleEvaluationStatus: RULE_EVALUATION_STATUS.blocked,
        explanation: `${rule.description} No validated state rule pack is available for ${jurisdiction}, so this state-specific requirement was not determined.`,
        blockingReasons: [
          "Federal baseline only — a validated state-specific rule pack is required before this determination can be made.",
        ],
      };
    }

    const blockingReasons = [];
    const facts = {};
    for (const field of rule.requires) {
      const reconciliation = reconciliations[field];
      if (reconciliation.status === EVIDENCE_STATUS.conflicting) {
        const values = reconciliation.conflictingValues
          .map(
            (entry) =>
              `${entry.sources.join(", ")} reports ${evidenceValueLabel(entry.value)}`,
          )
          .join("; ");
        blockingReasons.push(
          `Conflicting evidence for "${field}": ${values}. Resolve the conflict before rule evaluation.`,
        );
        continue;
      }

      const check = factUsable(reconciliation.fact, minimumConfidence);
      if (!check.usable) {
        blockingReasons.push(
          check.reason === "low_confidence"
            ? `Fact "${field}" is below the ${Math.round(minimumConfidence * 100)}% confidence policy and is not human-verified.`
            : `Required fact "${field}" is missing from the submitted evidence.`,
        );
        continue;
      }
      facts[field] = reconciliation.fact;
    }

    if (blockingReasons.length) {
      return {
        ...base,
        status: FINDING_STATUS.unableToDetermine,
        ruleEvaluationStatus: RULE_EVALUATION_STATUS.blocked,
        explanation: conflict
          ? `${rule.description} Conflicting source evidence prevents this rule from being evaluated.`
          : `${rule.description} The evidence on file is insufficient to determine this rule.`,
        blockingReasons,
      };
    }

    const outcome = rule.evaluate(facts);
    return {
      ...base,
      status: outcome.status,
      ruleEvaluationStatus: RULE_EVALUATION_STATUS.evaluated,
      explanation: `${rule.description} ${outcome.explanation}`,
      blockingReasons:
        outcome.status === FINDING_STATUS.unableToDetermine
          ? [outcome.explanation]
          : [],
    };
  });

  return {
    engineBuild: ENGINE_BUILD,
    rulePackId: pack.id,
    rulePackVersion: pack.version,
    statePackApplied: statePackUsable,
    hotmaApplicability: pack.hotmaApplicability ?? null,
    findings,
    counts: findings.reduce(
      (acc, finding) => {
        if (finding.status === FINDING_STATUS.pass) acc.pass += 1;
        else if (finding.status === FINDING_STATUS.fail) acc.fail += 1;
        else acc.unableToDetermine += 1;
        return acc;
      },
      { pass: 0, fail: 0, unableToDetermine: 0 },
    ),
  };
}

/** Human sign-off is only offered when nothing is undetermined. */
export function signOffAllowed(result) {
  return result.counts.unableToDetermine === 0;
}

export const REVIEW_DECISIONS = Object.freeze([
  "approved",
  "remediation_requested",
  "unable_to_determine",
]);

export {
  LAYERED_ENGINE_BUILD,
  LAYERED_RULE_ID,
  evaluateLayeredProgramRestrictions,
} from "./layered-program-restrictions.mjs";

export {
  TENANT_ELIGIBILITY_ENGINE_BUILD,
  TENANT_ELIGIBILITY_RULE_ID,
  evaluateTenantFileEligibility,
  normalizeIncomeLimitDollar,
} from "./tenant-file-eligibility.mjs";

export {
  RECERTIFICATION_OCCUPANCY_ENGINE_BUILD,
  RECERTIFICATION_OCCUPANCY_RULE_ID,
  evaluateRecertificationOccupancyControls,
} from "./recertification-occupancy-controls.mjs";

export {
  CONTROLLED_FY2026_GEOGRAPHY_CROSSWALK,
  CONTROLLED_FY2026_INCOME_LIMIT_SOURCES,
  FY2026_LIMIT_ACTIVATION_STATUS,
  FY2026_LIMIT_INGESTION_ENGINE_BUILD,
  evaluateFy2026IncomeLimitSourceActivation,
  normalizeFy2026IncomeLimitDollar,
  selectFy2026IncomeLimit,
  validateFy2026IncomeLimitProgramHandoff,
  validateFy2026IncomeLimitRecords,
  validateFy2026IncomeLimitSelection,
} from "./fy2026-income-limit-ingestion.mjs";

export {
  FY2026_XLSX_PARSER_BUILD,
  parseControlledFy2026Workbook,
} from "./fy2026-xlsx-workbook-parser.mjs";

export {
  ENTERPRISE_PROJECT_AUTHORITY_ENGINE_BUILD,
  createEnterpriseProjectAuthorityGateway,
} from "./enterprise-project-authority-intake.mjs";

export {
  STATE_RULE_PACK_RELEASE_ENGINE_BUILD,
  createStateRulePackReleaseGateway,
} from "./state-rule-pack-release.mjs";
