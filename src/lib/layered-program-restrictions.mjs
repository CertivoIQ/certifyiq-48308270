/**
 * Deterministic layered-program restriction reconciliation.
 *
 * The engine evaluates one property, unit, household, and event. It selects
 * the lowest monetary cap only within an explicitly validated comparison
 * group and never collapses unlike concepts such as LIHTC gross rent, HCV
 * rent to owner, HUD contract rent, tenant-paid rent, or Rural Development
 * basic and note rents.
 */

export const LAYERED_RULE_ID = "FED-LAYERED-PROGRAM-RESTRICTIONS-001";
export const LAYERED_ENGINE_BUILD = "layered-program-engine-2026.08.2";

const PROGRAM_CODES = new Set([
  "LIHTC",
  "PROJECT_AUTHORITY",
  "HCV_TENANT_BASED",
  "HUD_PBV",
  "HUD_MFH_PROJECT_BASED",
  "HOME",
  "HTF",
  "RURAL_DEVELOPMENT",
  "TAX_EXEMPT_BOND",
  "STATE_HFA",
  "LOCAL_PROGRAM",
]);

const MONETARY_METRICS = new Set([
  "MAXIMUM_GROSS_RENT",
  "MAXIMUM_RENT_TO_OWNER",
  "MAXIMUM_TENANT_PAID_RENT",
  "MAXIMUM_CONTRACT_RENT",
  "MAXIMUM_BASIC_RENT",
  "MAXIMUM_NOTE_RENT",
]);

const REQUIREMENT_STATUSES = new Set(["PASS", "FAIL", "NOT_DETERMINED"]);
const PERIODS = new Set(["MONTHLY", "ANNUAL"]);

const HUD_HAP_DOCUMENT_TYPES = Object.freeze({
  HCV_TENANT_BASED: new Set(["HUD_52641", "HUD_52642"]),
  HUD_PBV: new Set(["HUD_52530_A", "HUD_52530_B", "HUD_PBV_HAP_CONTRACT"]),
  HUD_MFH_PROJECT_BASED: new Set(["HUD_MFH_HAP_CONTRACT"]),
});

const KNOWN_DOCUMENT_PROGRAM = new Map(
  Object.entries(HUD_HAP_DOCUMENT_TYPES).flatMap(([programCode, types]) =>
    [...types].map((documentType) => [documentType, programCode]),
  ),
);

function uniqueSorted(values = []) {
  return [...new Set(values.map(String))].sort();
}

function blocked(code, reason, missing = [], details = {}) {
  return {
    resolution_status: "NOT_DETERMINED",
    determination_status: "NOT_DETERMINED",
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    reason_code: code,
    reason,
    missing_inputs: uniqueSorted(missing),
    human_approval_required: true,
    ...details,
  };
}

function parseIsoDate(value, field) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${field} must be an ISO date in YYYY-MM-DD form`);
  }
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`${field} must be an ISO date in YYYY-MM-DD form`);
  }
  return text;
}

function moneyToCents(value, field) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    throw new Error(`${field} must be a valid non-negative monetary amount`);
  }
  const [whole, fraction = ""] = text.split(".");
  let cents = BigInt(whole) * 100n;
  const padded = `${fraction}000`;
  cents += BigInt(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) cents += 1n;
  return cents;
}

function formatCents(cents) {
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, "0");
  return `${whole}.${fraction}`;
}

function requiredTrue(record, fields, prefix) {
  return fields
    .filter((field) => record?.[field] !== true)
    .map((field) => `${prefix}.${field}`);
}

function requiredValues(record, fields, prefix) {
  return fields
    .filter((field) => record?.[field] === null || record?.[field] === undefined)
    .map((field) => `${prefix}.${field}`);
}

function validateProjectAuthority(input) {
  const result = input.project_authority_result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {
      error: blocked(
        "PROJECT_AUTHORITY_HANDOFF_MISSING",
        "The layered-program gate requires the completed Form 8609 and project-agreement authority result.",
        ["project_authority_result"],
      ),
    };
  }

  const envelope = result.authority_envelope;
  const handoff = result.gross_rent_floor_handoff;
  const capOutcome = String(handoff?.cap_outcome ?? "").toUpperCase();
  const requirements = {
    "project_authority_result.finding": result.finding === "READY",
    "project_authority_result.rule_engine_authority":
      result.rule_engine_authority === "ALLOWED",
    "project_authority_result.layered_program_review_required":
      result.layered_program_review_required === true,
    "project_authority_result.layered_program_rule_id":
      result.layered_program_rule_id === LAYERED_RULE_ID,
    "project_authority_result.authority_envelope":
      Boolean(envelope) && typeof envelope === "object" && !Array.isArray(envelope),
    "project_authority_result.authority_envelope.project_authority_validated":
      envelope?.project_authority_validated === true,
    "project_authority_result.authority_envelope.project_authority_inventory_complete":
      envelope?.project_authority_inventory_complete === true,
    "project_authority_result.gross_rent_floor_handoff":
      Boolean(handoff) && typeof handoff === "object" && !Array.isArray(handoff),
    "project_authority_result.gross_rent_floor_handoff.cap_outcome":
      capOutcome === "CAP_VALIDATED" || capOutcome === "NO_CAP_VALIDATED",
  };
  const missing = Object.entries(requirements)
    .filter(([, valid]) => !valid)
    .map(([field]) => field);
  if (missing.length) {
    return {
      error: blocked(
        "PROJECT_AUTHORITY_HANDOFF_NOT_VALIDATED",
        "The prior project-authority gate is incomplete, blocked, or unvalidated.",
        missing,
      ),
    };
  }
  const projectCap = handoff.project_maximum_gross_rent_cap;
  if (capOutcome === "CAP_VALIDATED" && (projectCap === null || projectCap === undefined)) {
    return {
      error: blocked(
        "PROJECT_AUTHORITY_CAP_HANDOFF_NOT_VALIDATED",
        "The project-authority handoff declares a validated cap but does not supply it.",
        ["project_authority_result.gross_rent_floor_handoff.project_maximum_gross_rent_cap"],
      ),
    };
  }
  if (capOutcome === "NO_CAP_VALIDATED" && projectCap !== null) {
    return {
      error: blocked(
        "PROJECT_AUTHORITY_CAP_HANDOFF_CONFLICT",
        "An explicit validated no-cap outcome cannot also supply a project gross-rent cap.",
        ["project_authority_result.gross_rent_floor_handoff"],
      ),
    };
  }
  if (String(result.property_id) !== String(input.property_id)) {
    return {
      error: blocked(
        "PROJECT_AUTHORITY_PROPERTY_CONFLICT",
        "The project-authority result belongs to a different property.",
        ["project_authority_result.property_id"],
      ),
    };
  }
  return { value: result };
}

function validateLayer(layer, index, eventDate) {
  const prefix = `layers[${index}]`;
  if (!layer || typeof layer !== "object" || Array.isArray(layer)) {
    return {
      error: blocked(
        "INVALID_LAYERED_PROGRAM_RECORD",
        "Each applicable program layer must be a structured record.",
        [prefix],
      ),
    };
  }

  const missing = [
    ...requiredTrue(
      layer,
      [
        "applicability_validated",
        "authority_documents_recognized",
        "authority_inventory_complete",
        "primary_authority_executed_or_issued",
        "current_rule_version_validated",
        "effective_date_validated",
        "unit_or_household_coverage_validated",
        "calculation_or_determination_validated",
        "amendments_waivers_inventory_complete",
      ],
      prefix,
    ),
    ...requiredValues(
      layer,
      [
        "layer_id",
        "program_code",
        "primary_authority_document_type",
        "authority_document_ids",
        "authority_citations",
        "effective_start_date",
        "constraints",
        "requirements",
      ],
      prefix,
    ),
  ];
  if (missing.length) {
    return {
      error: blocked(
        "MISSING_OR_UNVALIDATED_LAYER_AUTHORITY",
        "Each applicable layer requires complete, current, effective, executed, unit-linked authority and validated program-specific determinations.",
        missing,
      ),
    };
  }

  const programCode = String(layer.program_code).toUpperCase();
  const documentType = String(layer.primary_authority_document_type).toUpperCase();
  const layerId = String(layer.layer_id);
  if (!PROGRAM_CODES.has(programCode)) {
    return {
      error: blocked(
        "UNRECOGNIZED_LAYERED_PROGRAM",
        "The program layer is not recognized by this rule pack.",
        [`${prefix}.program_code`],
      ),
    };
  }
  if (!Array.isArray(layer.authority_document_ids) || !layer.authority_document_ids.length) {
    return {
      error: blocked(
        "LAYER_AUTHORITY_DOCUMENT_INVENTORY_INVALID",
        "Every layer requires at least one identified authority document.",
        [`${prefix}.authority_document_ids`],
      ),
    };
  }
  if (!Array.isArray(layer.authority_citations) || !layer.authority_citations.length) {
    return {
      error: blocked(
        "LAYER_AUTHORITY_CITATIONS_MISSING",
        "Every layer requires at least one human-readable authority citation.",
        [`${prefix}.authority_citations`],
      ),
    };
  }
  if (!Array.isArray(layer.constraints) || !Array.isArray(layer.requirements)) {
    return {
      error: blocked(
        "INVALID_LAYERED_PROGRAM_DETERMINATION",
        "Constraints and requirements must be structured lists.",
        [`${prefix}.constraints`, `${prefix}.requirements`],
      ),
    };
  }
  if (!layer.constraints.length && !layer.requirements.length) {
    return {
      error: blocked(
        "EMPTY_LAYERED_PROGRAM_DETERMINATION",
        "An applicable layer must contribute at least one monetary constraint or independent program requirement.",
        [`${prefix}.constraints`, `${prefix}.requirements`],
      ),
    };
  }

  const expectedProgram = KNOWN_DOCUMENT_PROGRAM.get(documentType);
  if (expectedProgram && expectedProgram !== programCode) {
    return {
      error: blocked(
        "HAP_DOCUMENT_PROGRAM_BRANCH_CONFLICT",
        "The recognized HUD HAP form was routed to the wrong tenant-based, project-based voucher, or multifamily project-based branch.",
        [`${prefix}.primary_authority_document_type`, `${prefix}.program_code`],
      ),
    };
  }
  if (
    HUD_HAP_DOCUMENT_TYPES[programCode] &&
    !HUD_HAP_DOCUMENT_TYPES[programCode].has(documentType)
  ) {
    return {
      error: blocked(
        "HAP_DOCUMENT_PROGRAM_BRANCH_NOT_VALIDATED",
        "The HUD assistance layer requires a recognized form for its exact HAP program branch.",
        [`${prefix}.primary_authority_document_type`],
      ),
    };
  }

  let effectiveStart;
  let effectiveEnd = null;
  try {
    effectiveStart = parseIsoDate(
      layer.effective_start_date,
      `${prefix}.effective_start_date`,
    );
    if (layer.effective_end_date !== null && layer.effective_end_date !== undefined) {
      effectiveEnd = parseIsoDate(
        layer.effective_end_date,
        `${prefix}.effective_end_date`,
      );
    }
  } catch (error) {
    return { error: blocked("INVALID_LAYER_EFFECTIVE_DATE", error.message) };
  }
  if (eventDate < effectiveStart || (effectiveEnd && eventDate > effectiveEnd)) {
    return {
      error: blocked(
        "LAYER_AUTHORITY_NOT_EFFECTIVE_FOR_EVENT_DATE",
        "A program layer is not effective for the certification or rent event date.",
        [`${prefix}.effective_start_date`, `${prefix}.effective_end_date`],
      ),
    };
  }

  const authorityDocumentIds = new Set(layer.authority_document_ids.map(String));
  const constraintIds = new Set();
  const constraints = [];
  for (const [constraintIndex, item] of layer.constraints.entries()) {
    const itemPrefix = `${prefix}.constraints[${constraintIndex}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return {
        error: blocked(
          "INVALID_MONETARY_CONSTRAINT",
          "Each monetary constraint must be a structured record.",
          [itemPrefix],
        ),
      };
    }
    const itemMissing = [
      ...requiredTrue(
        item,
        [
          "source_validated",
          "effective_for_event_date",
          "calculation_validated",
          "comparison_basis_validated",
        ],
        itemPrefix,
      ),
      ...requiredValues(
        item,
        [
          "constraint_id",
          "metric",
          "comparison_group",
          "maximum_amount",
          "currency",
          "period",
          "source_document_id",
          "citation",
        ],
        itemPrefix,
      ),
    ];
    if (itemMissing.length) {
      return {
        error: blocked(
          "MISSING_OR_UNVALIDATED_MONETARY_CONSTRAINT",
          "Each monetary cap requires validated source, effective date, calculation, and comparison-basis evidence.",
          itemMissing,
        ),
      };
    }

    const constraintId = String(item.constraint_id);
    const metric = String(item.metric).toUpperCase();
    const comparisonGroup = String(item.comparison_group);
    const currency = String(item.currency).toUpperCase();
    const period = String(item.period).toUpperCase();
    const sourceDocumentId = String(item.source_document_id);
    if (constraintIds.has(constraintId)) {
      return {
        error: blocked(
          "DUPLICATE_LAYER_CONSTRAINT_ID",
          "Constraint identifiers must be unique within a program layer.",
          [`${itemPrefix}.constraint_id`],
        ),
      };
    }
    constraintIds.add(constraintId);
    if (!MONETARY_METRICS.has(metric)) {
      return {
        error: blocked(
          "UNRECOGNIZED_MONETARY_CONSTRAINT_METRIC",
          "The monetary metric is not recognized and cannot be compared safely.",
          [`${itemPrefix}.metric`],
        ),
      };
    }
    if (!PERIODS.has(period)) {
      return {
        error: blocked(
          "INVALID_MONETARY_CONSTRAINT_PERIOD",
          "A monetary constraint must be monthly or annual.",
          [`${itemPrefix}.period`],
        ),
      };
    }
    if (!comparisonGroup.trim()) {
      return {
        error: blocked(
          "EMPTY_MONETARY_COMPARISON_GROUP",
          "Every monetary cap requires an explicit comparison-basis identifier.",
          [`${itemPrefix}.comparison_group`],
        ),
      };
    }
    if (!authorityDocumentIds.has(sourceDocumentId)) {
      return {
        error: blocked(
          "CONSTRAINT_SOURCE_OUTSIDE_LAYER_AUTHORITY",
          "The monetary cap cites a document outside the layer's complete authority inventory.",
          [`${itemPrefix}.source_document_id`],
        ),
      };
    }
    let maximumCents;
    try {
      maximumCents = moneyToCents(
        item.maximum_amount,
        `${itemPrefix}.maximum_amount`,
      );
    } catch (error) {
      return { error: blocked("INVALID_MONETARY_CONSTRAINT", error.message) };
    }
    constraints.push({
      constraint_id: constraintId,
      layer_id: layerId,
      program_code: programCode,
      metric,
      comparison_group: comparisonGroup,
      maximum_amount: formatCents(maximumCents),
      maximum_cents: maximumCents,
      currency,
      period,
      source_document_id: sourceDocumentId,
      citation: String(item.citation),
    });
  }

  const requirementIds = new Set();
  const requirements = [];
  for (const [requirementIndex, item] of layer.requirements.entries()) {
    const itemPrefix = `${prefix}.requirements[${requirementIndex}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return {
        error: blocked(
          "INVALID_PROGRAM_REQUIREMENT",
          "Each non-monetary or eligibility requirement must be a structured record.",
          [itemPrefix],
        ),
      };
    }
    const itemMissing = [
      ...requiredTrue(
        item,
        ["source_validated", "effective_for_event_date", "result_validated"],
        itemPrefix,
      ),
      ...requiredValues(
        item,
        [
          "requirement_id",
          "requirement_type",
          "status",
          "source_document_id",
          "citation",
        ],
        itemPrefix,
      ),
    ];
    if (itemMissing.length) {
      return {
        error: blocked(
          "MISSING_OR_UNVALIDATED_PROGRAM_REQUIREMENT",
          "Each independent program requirement requires validated authority, effective date, and determination evidence.",
          itemMissing,
        ),
      };
    }

    const requirementId = String(item.requirement_id);
    const status = String(item.status).toUpperCase();
    const sourceDocumentId = String(item.source_document_id);
    if (requirementIds.has(requirementId)) {
      return {
        error: blocked(
          "DUPLICATE_PROGRAM_REQUIREMENT_ID",
          "Requirement identifiers must be unique within a program layer.",
          [`${itemPrefix}.requirement_id`],
        ),
      };
    }
    requirementIds.add(requirementId);
    if (!REQUIREMENT_STATUSES.has(status)) {
      return {
        error: blocked(
          "INVALID_PROGRAM_REQUIREMENT_STATUS",
          "A program requirement must be PASS, FAIL, or NOT_DETERMINED.",
          [`${itemPrefix}.status`],
        ),
      };
    }
    if (!authorityDocumentIds.has(sourceDocumentId)) {
      return {
        error: blocked(
          "REQUIREMENT_SOURCE_OUTSIDE_LAYER_AUTHORITY",
          "The program requirement cites a document outside the layer's complete authority inventory.",
          [`${itemPrefix}.source_document_id`],
        ),
      };
    }
    requirements.push({
      requirement_id: requirementId,
      layer_id: layerId,
      program_code: programCode,
      requirement_type: String(item.requirement_type).toUpperCase(),
      status,
      source_document_id: sourceDocumentId,
      citation: String(item.citation),
    });
  }

  return {
    value: {
      layer_id: layerId,
      program_code: programCode,
      primary_authority_document_type: documentType,
      authority_document_ids: [...authorityDocumentIds].sort(),
      authority_citations: layer.authority_citations.map(String),
      effective_start_date: effectiveStart,
      effective_end_date: effectiveEnd,
      constraints,
      requirements,
    },
  };
}

function validateObservedAmounts(observedAmounts) {
  if (!Array.isArray(observedAmounts)) {
    return {
      error: blocked(
        "OBSERVED_AMOUNT_INVENTORY_INVALID",
        "Observed rent values must be supplied as a structured list.",
        ["observed_amounts"],
      ),
    };
  }
  const normalized = new Map();
  for (const [index, item] of observedAmounts.entries()) {
    const prefix = `observed_amounts[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return {
        error: blocked(
          "INVALID_OBSERVED_AMOUNT",
          "Each observed amount must be a structured record.",
          [prefix],
        ),
      };
    }
    const missing = [
      ...requiredTrue(
        item,
        [
          "source_validated",
          "measurement_basis_validated",
          "event_date_match_validated",
          "charge_inventory_complete",
        ],
        prefix,
      ),
      ...requiredValues(
        item,
        ["comparison_group", "metric", "amount", "currency", "period"],
        prefix,
      ),
    ];
    if (missing.length) {
      return {
        error: blocked(
          "MISSING_OR_UNVALIDATED_OBSERVED_AMOUNT",
          "Each observed rent value requires a complete charge inventory and validated source, basis, and event-date match.",
          missing,
        ),
      };
    }
    const comparisonGroup = String(item.comparison_group);
    const metric = String(item.metric).toUpperCase();
    const currency = String(item.currency).toUpperCase();
    const period = String(item.period).toUpperCase();
    if (normalized.has(comparisonGroup)) {
      return {
        error: blocked(
          "DUPLICATE_OR_CONFLICTING_OBSERVED_AMOUNT",
          "Each comparison group must have one reconciled observed value.",
          [`${prefix}.comparison_group`],
        ),
      };
    }
    if (!MONETARY_METRICS.has(metric) || !PERIODS.has(period)) {
      return {
        error: blocked(
          "INVALID_OBSERVED_AMOUNT_BASIS",
          "The observed metric or period is not recognized.",
          [`${prefix}.metric`, `${prefix}.period`],
        ),
      };
    }
    let amountCents;
    try {
      amountCents = moneyToCents(item.amount, `${prefix}.amount`);
    } catch (error) {
      return { error: blocked("INVALID_OBSERVED_AMOUNT", error.message) };
    }
    normalized.set(comparisonGroup, {
      comparison_group: comparisonGroup,
      metric,
      amount: formatCents(amountCents),
      amount_cents: amountCents,
      currency,
      period,
      rental_assistance_excluded: item.rental_assistance_excluded === true,
    });
  }
  return { value: normalized };
}

/** Evaluate all validated, applicable program layers for one unit and event. */
export function evaluateLayeredProgramRestrictions(input = {}) {
  const missing = [
    "property_id",
    "unit_id",
    "household_id",
    "event_date",
    "base_program_code",
    "applicable_program_codes",
    "layers",
    "observed_amounts",
  ].filter((field) => input[field] === null || input[field] === undefined);

  for (const field of [
    "unit_identity_validated",
    "household_identity_validated",
    "program_inventory_complete",
    "program_inventory_sources_validated",
    "funding_sources_reconciled",
    "assistance_sources_reconciled",
    "unit_program_designations_validated",
  ]) {
    if (input[field] !== true) missing.push(field);
  }

  const stateFindingRequested = input.state_finding_requested === true;
  if (stateFindingRequested) {
    const statePack = input.state_rulepack;
    const statePackUsable = Boolean(
      statePack &&
        statePack.status === "validated" &&
        statePack.approvedBy &&
        statePack.effectiveFrom &&
        statePack.version &&
        Number(statePack.validatedRuleCount) > 0,
    );
    if (!statePackUsable) missing.push("state_rulepack");
  }
  if (missing.length) {
    return blocked(
      "LAYERED_PROGRAM_SCOPE_NOT_VALIDATED",
      "Unit, household, event, complete funding and assistance inventories, and any requested state authority must be validated.",
      missing,
    );
  }

  let eventDate;
  try {
    eventDate = parseIsoDate(input.event_date, "event_date");
  } catch (error) {
    return blocked("INVALID_LAYERED_PROGRAM_EVENT_DATE", error.message);
  }

  const projectAuthorityValidation = validateProjectAuthority(input);
  if (projectAuthorityValidation.error) return projectAuthorityValidation.error;
  const projectAuthority = projectAuthorityValidation.value;

  if (!Array.isArray(input.applicable_program_codes) || !Array.isArray(input.layers)) {
    return blocked(
      "LAYERED_PROGRAM_INVENTORY_INVALID",
      "Applicable program codes and layer records must be structured lists.",
      ["applicable_program_codes", "layers"],
    );
  }
  const applicableCodes = new Set(
    input.applicable_program_codes.map((value) => String(value).toUpperCase()),
  );
  if (
    !applicableCodes.size ||
    [...applicableCodes].some((programCode) => !PROGRAM_CODES.has(programCode))
  ) {
    return blocked(
      "UNRECOGNIZED_APPLICABLE_PROGRAM_INVENTORY",
      "The complete program inventory contains an empty or unrecognized program code.",
      ["applicable_program_codes"],
    );
  }
  const baseProgram = String(input.base_program_code).toUpperCase();
  if (!applicableCodes.has(baseProgram) || !applicableCodes.has("PROJECT_AUTHORITY")) {
    return blocked(
      "REQUIRED_BASE_OR_PROJECT_AUTHORITY_LAYER_MISSING",
      "The layered review must include both the base program and recorded project-authority layer.",
      ["base_program_code", "PROJECT_AUTHORITY"],
    );
  }

  const layers = [];
  const layerIds = new Set();
  for (const [index, layer] of input.layers.entries()) {
    const validation = validateLayer(layer, index, eventDate);
    if (validation.error) return validation.error;
    if (layerIds.has(validation.value.layer_id)) {
      return blocked(
        "DUPLICATE_LAYER_ID",
        "Every applicable authority layer requires a unique identity.",
        [validation.value.layer_id],
      );
    }
    layerIds.add(validation.value.layer_id);
    layers.push(validation.value);
  }

  const representedCodes = new Set(layers.map((layer) => layer.program_code));
  const inventoryDifference = [
    ...[...applicableCodes].filter((value) => !representedCodes.has(value)),
    ...[...representedCodes].filter((value) => !applicableCodes.has(value)),
  ];
  if (inventoryDifference.length) {
    return blocked(
      "APPLICABLE_PROGRAM_LAYER_INVENTORY_MISMATCH",
      "The complete applicable-program inventory does not match the supplied validated layer records.",
      inventoryDifference,
    );
  }

  const projectCapRaw =
    projectAuthority.gross_rent_floor_handoff?.project_maximum_gross_rent_cap;
  if (projectCapRaw !== null && projectCapRaw !== undefined) {
    let projectCapCents;
    try {
      projectCapCents = moneyToCents(
        projectCapRaw,
        "project_authority_result.gross_rent_floor_handoff.project_maximum_gross_rent_cap",
      );
    } catch (error) {
      return blocked("INVALID_PROJECT_AUTHORITY_CAP_HANDOFF", error.message);
    }
    const matchingProjectCap = layers
      .filter((layer) => layer.program_code === "PROJECT_AUTHORITY")
      .flatMap((layer) => layer.constraints)
      .some(
        (item) =>
          item.metric === "MAXIMUM_GROSS_RENT" &&
          item.maximum_cents === projectCapCents,
      );
    if (!matchingProjectCap) {
      return blocked(
        "PROJECT_AUTHORITY_CAP_NOT_RECONCILED",
        "The project rent cap from the Form 8609/LURA gate is missing or changed in the layered-program records.",
        ["PROJECT_AUTHORITY.MAXIMUM_GROSS_RENT"],
      );
    }
  }

  const observedValidation = validateObservedAmounts(input.observed_amounts);
  if (observedValidation.error) return observedValidation.error;
  const observedByGroup = observedValidation.value;

  const constraintsByGroup = new Map();
  const requirements = [];
  for (const layer of layers) {
    requirements.push(...layer.requirements);
    for (const item of layer.constraints) {
      const items = constraintsByGroup.get(item.comparison_group) ?? [];
      items.push(item);
      constraintsByGroup.set(item.comparison_group, items);
    }
  }

  const groupResults = [];
  const constraintFindingsByLayer = new Map();
  for (const group of [...constraintsByGroup.keys()].sort()) {
    const constraints = constraintsByGroup.get(group);
    const bases = new Set(
      constraints.map((item) => `${item.metric}|${item.currency}|${item.period}`),
    );
    if (bases.size !== 1) {
      return blocked(
        "NONCOMPARABLE_CONSTRAINTS_SHARE_GROUP",
        "Unlike monetary metrics, currencies, or periods were assigned to one comparison group.",
        [group],
      );
    }
    const observed = observedByGroup.get(group);
    if (!observed) {
      return blocked(
        "OBSERVED_AMOUNT_MISSING_FOR_CONSTRAINT_GROUP",
        "Every monetary comparison group requires one validated observed amount.",
        [group],
      );
    }
    const [metric, currency, period] = [...bases][0].split("|");
    if (
      observed.metric !== metric ||
      observed.currency !== currency ||
      observed.period !== period
    ) {
      return blocked(
        "OBSERVED_AMOUNT_COMPARISON_BASIS_CONFLICT",
        "The observed amount does not use the metric, currency, and period of its comparison group.",
        [group],
      );
    }
    const hasLihtcGrossRentConstraint = constraints.some(
      (item) =>
        item.program_code === "LIHTC" && item.metric === "MAXIMUM_GROSS_RENT",
    );
    if (hasLihtcGrossRentConstraint && observed.rental_assistance_excluded !== true) {
      return blocked(
        "LIHTC_RENTAL_ASSISTANCE_TREATMENT_NOT_VALIDATED",
        "The observed LIHTC gross-rent basis must exclude rental assistance payments while retaining tenant-paid utilities and required charges.",
        [`observed_amounts[${group}].rental_assistance_excluded`],
      );
    }

    const controllingCents = constraints.reduce(
      (minimum, item) =>
        minimum === null || item.maximum_cents < minimum
          ? item.maximum_cents
          : minimum,
      null,
    );
    const controlling = constraints.filter(
      (item) => item.maximum_cents === controllingCents,
    );
    const finding = observed.amount_cents <= controllingCents ? "PASS" : "FAIL";
    for (const item of constraints) {
      const findings = constraintFindingsByLayer.get(item.layer_id) ?? [];
      findings.push(observed.amount_cents <= item.maximum_cents ? "PASS" : "FAIL");
      constraintFindingsByLayer.set(item.layer_id, findings);
    }
    groupResults.push({
      comparison_group: group,
      metric,
      currency,
      period,
      observed_amount: observed.amount,
      controlling_maximum_amount: formatCents(controllingCents),
      controlling_constraint_ids: controlling.map((item) => item.constraint_id).sort(),
      controlling_layer_ids: controlling.map((item) => item.layer_id).sort(),
      controlling_program_codes: uniqueSorted(
        controlling.map((item) => item.program_code),
      ),
      finding,
      all_constraints: constraints.map(({ maximum_cents: _cents, ...item }) => item),
    });
  }

  const unresolvedRequirements = requirements.filter(
    (item) => item.status === "NOT_DETERMINED",
  );
  const failedRequirements = requirements.filter((item) => item.status === "FAIL");
  const failedGroups = groupResults.filter((item) => item.finding === "FAIL");
  const confirmedFailures = uniqueSorted([
    ...failedRequirements.map((item) => `REQUIREMENT:${item.requirement_id}`),
    ...failedGroups.map((item) => `RENT_GROUP:${item.comparison_group}`),
  ]);
  if (unresolvedRequirements.length) {
    return blocked(
      "LAYERED_PROGRAM_REQUIREMENT_NOT_DETERMINED",
      "At least one applicable program requirement is unresolved; the composite finding remains blocked even when another layer has a known failure.",
      unresolvedRequirements.map((item) => item.requirement_id),
      {
        unresolved_requirements: unresolvedRequirements,
        confirmed_failure_indicators: confirmedFailures,
      },
    );
  }

  const layerResults = layers.map((layer) => {
    const requirementStatuses = layer.requirements.map((item) => item.status);
    const constraintStatuses = constraintFindingsByLayer.get(layer.layer_id) ?? [];
    return {
      layer_id: layer.layer_id,
      program_code: layer.program_code,
      finding:
        requirementStatuses.includes("FAIL") || constraintStatuses.includes("FAIL")
          ? "FAIL"
          : "PASS",
      constraint_count: layer.constraints.length,
      requirement_count: layer.requirements.length,
      authority_citations: layer.authority_citations,
    };
  });

  const bondConstraintCount = layers
    .filter((layer) => layer.program_code === "TAX_EXEMPT_BOND")
    .flatMap((layer) => layer.constraints).length;
  const finding = confirmedFailures.length ? "FAIL" : "PASS";
  return {
    resolution_status: "COMPLETED",
    determination_status: finding,
    rule_engine_authority: "ALLOWED",
    finding,
    rule_id: LAYERED_RULE_ID,
    engine_build: LAYERED_ENGINE_BUILD,
    program: "LAYERED_AFFORDABLE_HOUSING",
    property_id: String(input.property_id),
    unit_id: String(input.unit_id),
    household_id: String(input.household_id),
    event_date: eventDate,
    authority_scope: stateFindingRequested
      ? "STATE_PROJECT_AND_FEDERAL"
      : "FEDERAL_AND_PROJECT_BASELINE_ONLY",
    applicable_program_codes: [...applicableCodes].sort(),
    layer_results: layerResults,
    monetary_comparison_groups: groupResults,
    independent_program_requirements: requirements,
    confirmed_failure_indicators: confirmedFailures,
    comparison_policy:
      "LOWEST_VALIDATED_CAP_CONTROLS_ONLY_WITHIN_THE_SAME_METRIC_CURRENCY_PERIOD_AND_COMPARISON_BASIS",
    eligibility_combination_policy:
      "EVERY_APPLICABLE_PROGRAM_REQUIREMENT_MUST_PASS_WITHOUT_COLLAPSING_DIFFERENT_INCOME_DEFINITIONS_INTO_ONE_LIMIT",
    lihtc_rental_assistance_excluded_from_gross_rent_basis: true,
    hap_assistance_does_not_cure_lihtc_noncompliance: true,
    tax_exempt_bond_constraint_inference_performed: false,
    tax_exempt_bond_monetary_constraint_count: bondConstraintCount,
    human_approval_required: true,
    human_approval_status: "PENDING",
    citations: [
      "26 USC 42(g)(2)",
      "24 CFR 92.252",
      "24 CFR 93.302",
      "24 CFR part 982",
      "24 CFR 983.301 and 983.304-.305",
      "7 CFR 3560.202",
      "26 USC 142(d)",
    ],
  };
}
