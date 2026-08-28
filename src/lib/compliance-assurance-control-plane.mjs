/**
 * Deterministic control plane for supervised compliance assurance.
 *
 * This module never resolves missing evidence, interprets uncited exceptions,
 * or converts an engine result into a final legal/compliance determination.
 * It turns layered-program output, regulatory conflicts, audit remediation,
 * human-review outcomes, security probes, and production-file observations
 * into explicit release gates for a human compliance reviewer.
 */

export const ASSURANCE_ENGINE_BUILD = "compliance-assurance-2026.08.1";

export const ASSURANCE_STATUS = Object.freeze({
  READY_FOR_HUMAN_DECISION: "READY_FOR_HUMAN_DECISION",
  PENDING: "PENDING",
  CONFLICTING: "CONFLICTING",
  NOT_DETERMINED: "NOT_DETERMINED",
  BLOCKED: "BLOCKED",
});

const PROGRAM_CODES = new Set([
  "LIHTC",
  "HUD_PBV",
  "HUD_MFH_PROJECT_BASED",
  "HCV_TENANT_BASED",
  "HOME",
  "RURAL_DEVELOPMENT",
  "LOCAL_PROGRAM",
  "STATE_HFA",
  "PROJECT_AUTHORITY",
]);

const SEVERITIES = new Set(["critical", "major", "minor"]);
const FINDING_STATUSES = new Set(["OPEN", "IN_REMEDIATION", "READY_FOR_REVIEW", "CLOSED"]);
const DECISIONS = new Set(["ESCALATE", "DO_NOT_ESCALATE"]);

function uniqueSorted(values = []) {
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function fixed(value) {
  return value === null ? null : Number(value.toFixed(4));
}

function block(reasonCode, reason, missing = [], details = {}) {
  return {
    status: ASSURANCE_STATUS.BLOCKED,
    determination_status: "NOT_DETERMINED",
    rule_engine_authority: "BLOCKED",
    reason_code: reasonCode,
    reason,
    missing_inputs: uniqueSorted(missing),
    human_review_required: true,
    ...details,
  };
}

function requiredText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeProgramCodes(programCodes) {
  if (!Array.isArray(programCodes)) return null;
  const normalized = uniqueSorted(programCodes.map((item) => String(item).toUpperCase()));
  return normalized.length && normalized.every((item) => PROGRAM_CODES.has(item))
    ? normalized
    : null;
}

/** Validate that the existing layered-program engine supplied a reviewable handoff. */
export function assessLayeredProgramHandoff(layeredResult, expectedPrograms = []) {
  const programs = normalizeProgramCodes(expectedPrograms);
  if (!programs) {
    return block(
      "PROGRAM_INVENTORY_INVALID",
      "The applicable LIHTC, HUD, HOME, Rural Development, local, state, and project-authority inventory must be explicit.",
      ["applicable_program_codes"],
    );
  }
  if (!layeredResult || typeof layeredResult !== "object" || Array.isArray(layeredResult)) {
    return block(
      "LAYERED_RESULT_MISSING",
      "The deterministic layered-program engine result is required.",
      ["layered_result"],
    );
  }
  const represented = normalizeProgramCodes(layeredResult.applicable_program_codes);
  if (!represented || programs.join("|") !== represented.join("|")) {
    return block(
      "LAYERED_PROGRAM_INVENTORY_MISMATCH",
      "The reviewed program inventory does not match the deterministic layered-program handoff.",
      ["layered_result.applicable_program_codes"],
      { expected_program_codes: programs, represented_program_codes: represented ?? [] },
    );
  }
  if (
    layeredResult.rule_engine_authority !== "ALLOWED" ||
    !["PASS", "FAIL"].includes(layeredResult.determination_status) ||
    layeredResult.resolution_status !== "COMPLETED"
  ) {
    return block(
      "LAYERED_RESULT_NOT_REVIEWABLE",
      "An unresolved, conflicting, pending, or blocked program layer prevents a composite determination.",
      [],
      {
        layered_reason_code: layeredResult.reason_code ?? null,
        confirmed_failure_indicators: uniqueSorted(
          layeredResult.confirmed_failure_indicators ?? [],
        ),
      },
    );
  }
  if (layeredResult.human_approval_required !== true) {
    return block(
      "LAYERED_HUMAN_REVIEW_CONTROL_MISSING",
      "Layered-program output must remain subject to documented human approval.",
      ["layered_result.human_approval_required"],
    );
  }
  return {
    status: "REVIEWABLE",
    determination_status: layeredResult.determination_status,
    rule_engine_authority: "ALLOWED_FOR_REVIEW_ONLY",
    applicable_program_codes: programs,
    confirmed_failure_indicators: uniqueSorted(
      layeredResult.confirmed_failure_indicators ?? [],
    ),
    human_review_required: true,
  };
}

/**
 * Detect regulatory conflicts and explicitly cited unusual exceptions.
 * Authority priority is accepted only when it was supplied as validated data;
 * this function never invents a legal hierarchy or selects between equal peers.
 */
export function assessRegulatoryIssues({ authorities = [], exceptions = [], eventDate } = {}) {
  if (!validIsoDate(eventDate)) {
    return block(
      "REGULATORY_EVENT_DATE_INVALID",
      "A validated ISO event date is required to evaluate effective authority.",
      ["event_date"],
    );
  }
  if (!Array.isArray(authorities) || !authorities.length) {
    return block(
      "REGULATORY_AUTHORITY_INVENTORY_MISSING",
      "At least one current, controlled authority record is required.",
      ["authorities"],
    );
  }

  const normalized = [];
  const missing = [];
  for (const [index, authority] of authorities.entries()) {
    const prefix = `authorities[${index}]`;
    for (const field of ["authority_id", "program_code", "citation", "source_sha256", "rule_key", "required_outcome"]) {
      if (!requiredText(authority?.[field])) missing.push(`${prefix}.${field}`);
    }
    if (!Number.isInteger(authority?.validated_precedence)) {
      missing.push(`${prefix}.validated_precedence`);
    }
    for (const field of ["source_validated", "effective_date_validated", "applicability_validated"]) {
      if (authority?.[field] !== true) missing.push(`${prefix}.${field}`);
    }
    if (!validIsoDate(authority?.effective_from)) missing.push(`${prefix}.effective_from`);
    if (authority?.effective_to != null && !validIsoDate(authority.effective_to)) {
      missing.push(`${prefix}.effective_to`);
    }
    const programCode = String(authority?.program_code ?? "").toUpperCase();
    if (!PROGRAM_CODES.has(programCode)) missing.push(`${prefix}.program_code`);
    if (!missing.some((field) => field.startsWith(prefix))) {
      normalized.push({
        authority_id: String(authority.authority_id),
        program_code: programCode,
        citation: authority.citation.trim(),
        source_sha256: authority.source_sha256.trim().toLowerCase(),
        rule_key: authority.rule_key.trim(),
        required_outcome: authority.required_outcome.trim(),
        validated_precedence: authority.validated_precedence,
        effective_from: authority.effective_from,
        effective_to: authority.effective_to ?? null,
      });
    }
  }
  if (missing.length) {
    return block(
      "REGULATORY_AUTHORITY_NOT_VALIDATED",
      "Every authority needs a controlled source, citation, effective dates, applicability, rule key, outcome, and independently validated precedence.",
      missing,
    );
  }

  const effective = normalized.filter(
    (item) =>
      item.effective_from <= eventDate &&
      (item.effective_to === null || item.effective_to >= eventDate),
  );
  if (!effective.length) {
    return block(
      "NO_EFFECTIVE_AUTHORITY",
      "No validated authority record is effective for the event date.",
      ["authorities.effective_from", "authorities.effective_to"],
    );
  }

  const conflicts = [];
  const byRule = new Map();
  for (const item of effective) {
    const peers = byRule.get(item.rule_key) ?? [];
    peers.push(item);
    byRule.set(item.rule_key, peers);
  }
  for (const [ruleKey, items] of byRule) {
    const controllingPrecedence = Math.min(...items.map((item) => item.validated_precedence));
    const controllingPeers = items.filter(
      (item) => item.validated_precedence === controllingPrecedence,
    );
    const outcomes = uniqueSorted(controllingPeers.map((item) => item.required_outcome));
    if (outcomes.length > 1) {
      conflicts.push({
        rule_key: ruleKey,
        validated_precedence: controllingPrecedence,
        authority_ids: controllingPeers.map((item) => item.authority_id).sort(),
        required_outcomes: outcomes,
      });
    }
  }
  if (conflicts.length) {
    return {
      status: ASSURANCE_STATUS.CONFLICTING,
      determination_status: "CONFLICTING",
      rule_engine_authority: "BLOCKED",
      reason_code: "CONTROLLING_AUTHORITIES_CONFLICT",
      conflicts,
      escalation_destination: "LEGAL_AND_COMPLIANCE",
      human_review_required: true,
    };
  }

  if (!Array.isArray(exceptions)) {
    return block(
      "REGULATORY_EXCEPTION_INVENTORY_INVALID",
      "The unusual-exception inventory must be a structured list, including an empty list when none apply.",
      ["exceptions"],
    );
  }
  const pendingExceptions = [];
  for (const [index, exception] of exceptions.entries()) {
    const complete =
      requiredText(exception?.exception_id) &&
      requiredText(exception?.authority_id) &&
      requiredText(exception?.citation) &&
      requiredText(exception?.scope) &&
      exception?.source_validated === true &&
      exception?.applicability_validated === true &&
      exception?.human_approval_required === true;
    if (!complete || exception.human_approval_status !== "APPROVED") {
      pendingExceptions.push(exception?.exception_id ?? `exceptions[${index}]`);
    }
  }
  if (pendingExceptions.length) {
    return {
      status: ASSURANCE_STATUS.PENDING,
      determination_status: "NOT_DETERMINED",
      rule_engine_authority: "BLOCKED",
      reason_code: "UNUSUAL_EXCEPTION_REQUIRES_APPROVAL",
      pending_exception_ids: uniqueSorted(pendingExceptions),
      escalation_destination: "LEGAL_AND_COMPLIANCE",
      human_review_required: true,
    };
  }

  return {
    status: "CLEAR_FOR_HUMAN_REVIEW",
    determination_status: "NO_UNRESOLVED_CONFLICT",
    rule_engine_authority: "ALLOWED_FOR_REVIEW_ONLY",
    effective_authority_ids: effective.map((item) => item.authority_id).sort(),
    approved_exception_ids: exceptions.map((item) => String(item.exception_id)).sort(),
    human_review_required: true,
  };
}

/** Build an evidence-bound audit preparation and findings remediation gate. */
export function assessAuditRemediation({ findings = [], auditPackage = {} } = {}) {
  if (!Array.isArray(findings)) {
    return block("AUDIT_FINDINGS_INVALID", "Audit findings must be a structured list.", ["findings"]);
  }
  const invalid = [];
  const open = [];
  for (const [index, finding] of findings.entries()) {
    const prefix = `findings[${index}]`;
    if (!requiredText(finding?.finding_id)) invalid.push(`${prefix}.finding_id`);
    if (!SEVERITIES.has(finding?.severity)) invalid.push(`${prefix}.severity`);
    if (!FINDING_STATUSES.has(finding?.status)) invalid.push(`${prefix}.status`);
    if (!requiredText(finding?.rule_id)) invalid.push(`${prefix}.rule_id`);
    if (!requiredText(finding?.citation)) invalid.push(`${prefix}.citation`);
    if (!Array.isArray(finding?.evidence_refs)) invalid.push(`${prefix}.evidence_refs`);
    if (finding?.status === "CLOSED") {
      if (!finding.evidence_refs?.length) invalid.push(`${prefix}.evidence_refs`);
      if (!requiredText(finding.remediation_summary)) invalid.push(`${prefix}.remediation_summary`);
      if (!requiredText(finding.verified_by)) invalid.push(`${prefix}.verified_by`);
      if (!requiredText(finding.closed_by)) invalid.push(`${prefix}.closed_by`);
      if (finding.verified_by === finding.closed_by) invalid.push(`${prefix}.separation_of_duties`);
    } else {
      open.push({
        finding_id: finding?.finding_id ?? `findings[${index}]`,
        severity: finding?.severity ?? "unknown",
        status: finding?.status ?? "unknown",
        due_date: finding?.due_date ?? null,
      });
    }
  }
  if (invalid.length) {
    return block(
      "AUDIT_REMEDIATION_EVIDENCE_INCOMPLETE",
      "Findings require cited rules, evidence-bound remediation, documented verification, and separation of duties before closure.",
      invalid,
    );
  }
  const packageMissing = [
    "manifest_sha256",
    "rule_pack_versions",
    "source_versions",
    "calculation_trace_refs",
    "review_history_refs",
  ].filter((field) =>
    Array.isArray(auditPackage?.[field])
      ? auditPackage[field].length === 0
      : !requiredText(auditPackage?.[field]),
  );
  if (packageMissing.length) {
    return block(
      "AUDIT_PACKAGE_INCOMPLETE",
      "The audit package must bind source versions, rule versions, calculations, evidence, and human-review history to one manifest.",
      packageMissing.map((field) => `audit_package.${field}`),
      { open_findings: open },
    );
  }
  const criticalOpen = open.filter((item) => item.severity === "critical");
  return {
    status: criticalOpen.length ? ASSURANCE_STATUS.BLOCKED : open.length ? ASSURANCE_STATUS.PENDING : "AUDIT_READY",
    determination_status: criticalOpen.length ? "NOT_DETERMINED" : open.length ? "REMEDIATION_PENDING" : "AUDIT_PACKAGE_COMPLETE",
    rule_engine_authority: criticalOpen.length ? "BLOCKED" : "ALLOWED_FOR_REVIEW_ONLY",
    open_findings: open,
    critical_open_count: criticalOpen.length,
    audit_manifest_sha256: auditPackage.manifest_sha256,
    human_review_required: true,
  };
}

/** Compare system escalation recommendations with documented human labels. */
export function assessHumanEscalationAccuracy(
  outcomes = [],
  { minimumSampleSize = 30, minimumRecall = 0.95, minimumPrecision = 0.9 } = {},
) {
  if (!Array.isArray(outcomes)) {
    return block("ESCALATION_OUTCOMES_INVALID", "Escalation outcomes must be a structured list.", ["outcomes"]);
  }
  const reviewed = outcomes.filter(
    (item) =>
      item?.human_review_complete === true &&
      DECISIONS.has(item.system_decision) &&
      DECISIONS.has(item.human_decision) &&
      requiredText(item.reviewer_id) &&
      requiredText(item.event_id),
  );
  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;
  let criticalFalseNegatives = 0;
  for (const item of reviewed) {
    const predicted = item.system_decision === "ESCALATE";
    const actual = item.human_decision === "ESCALATE";
    if (predicted && actual) tp += 1;
    else if (predicted) fp += 1;
    else if (actual) {
      fn += 1;
      if (item.severity === "critical") criticalFalseNegatives += 1;
    } else tn += 1;
  }
  const recall = fixed(ratio(tp, tp + fn));
  const precision = fixed(ratio(tp, tp + fp));
  const agreement = fixed(ratio(tp + tn, reviewed.length));
  const sampleComplete = reviewed.length === outcomes.length;
  const gates = {
    all_outcomes_human_reviewed: sampleComplete,
    minimum_sample_met: reviewed.length >= minimumSampleSize,
    escalation_recall_met: recall !== null && recall >= minimumRecall,
    escalation_precision_met: precision !== null && precision >= minimumPrecision,
    zero_critical_false_negatives: criticalFalseNegatives === 0,
  };
  const releaseReady = Object.values(gates).every(Boolean);
  return {
    status: releaseReady ? "ACCURACY_GATE_MET" : ASSURANCE_STATUS.PENDING,
    determination_status: releaseReady ? "VALIDATED" : "NOT_DETERMINED",
    rule_engine_authority: releaseReady ? "ALLOWED_FOR_REVIEW_ONLY" : "BLOCKED",
    sample_size: reviewed.length,
    confusion_matrix: { true_positive: tp, true_negative: tn, false_positive: fp, false_negative: fn },
    recall,
    precision,
    agreement,
    critical_false_negatives: criticalFalseNegatives,
    gates,
    human_review_required: true,
  };
}

/** Verify sustained performance on reviewed production customer files. */
export function assessCustomerFilePerformance(
  observations = [],
  {
    minimumFiles = 100,
    minimumCustomers = 3,
    minimumWindowDays = 30,
    minimumWorkflowSuccess = 0.99,
    minimumAgreement = 0.95,
  } = {},
) {
  if (!Array.isArray(observations)) {
    return block("PERFORMANCE_OBSERVATIONS_INVALID", "Performance observations must be a structured list.", ["observations"]);
  }
  const eligible = observations.filter(
    (item) =>
      item?.environment === "production" &&
      item?.actual_customer_file === true &&
      item?.human_review_complete === true &&
      requiredText(item.customer_key) &&
      requiredText(item.file_key) &&
      validIsoDate(item.observed_on),
  );
  const customers = new Set(eligible.map((item) => item.customer_key));
  const dates = eligible.map((item) => item.observed_on).sort();
  const windowDays = dates.length
    ? Math.floor((new Date(`${dates.at(-1)}T00:00:00Z`) - new Date(`${dates[0]}T00:00:00Z`)) / 86400000) + 1
    : 0;
  const successful = eligible.filter((item) => item.workflow_success === true).length;
  const agreementCount = eligible.filter(
    (item) => item.system_result === item.human_result && requiredText(item.system_result),
  ).length;
  const workflowSuccess = fixed(ratio(successful, eligible.length));
  const agreement = fixed(ratio(agreementCount, eligible.length));
  const lostAuditTrails = eligible.filter((item) => item.audit_trail_complete !== true).length;
  const crossTenantFailures = eligible.filter((item) => item.cross_tenant_access_denied !== true).length;
  const unresolvedEvidenceBypasses = eligible.filter(
    (item) => item.unresolved_evidence_blocked !== true,
  ).length;
  const criticalIncorrect = eligible.filter(
    (item) => item.severity === "critical" && item.system_result !== item.human_result,
  ).length;
  const gates = {
    all_records_eligible: eligible.length === observations.length,
    minimum_files_met: eligible.length >= minimumFiles,
    minimum_customers_met: customers.size >= minimumCustomers,
    sustained_window_met: windowDays >= minimumWindowDays,
    workflow_success_met: workflowSuccess !== null && workflowSuccess >= minimumWorkflowSuccess,
    human_agreement_met: agreement !== null && agreement >= minimumAgreement,
    zero_lost_audit_trails: lostAuditTrails === 0,
    zero_cross_tenant_failures: crossTenantFailures === 0,
    zero_unresolved_evidence_bypasses: unresolvedEvidenceBypasses === 0,
    zero_critical_incorrect_results: criticalIncorrect === 0,
  };
  const releaseReady = Object.values(gates).every(Boolean);
  return {
    status: releaseReady ? "SUSTAINED_PERFORMANCE_GATE_MET" : ASSURANCE_STATUS.PENDING,
    determination_status: releaseReady ? "VALIDATED" : "NOT_DETERMINED",
    rule_engine_authority: releaseReady ? "ALLOWED_FOR_REVIEW_ONLY" : "BLOCKED",
    file_count: eligible.length,
    customer_count: customers.size,
    window_days: windowDays,
    workflow_success_rate: workflowSuccess,
    human_agreement_rate: agreement,
    lost_audit_trail_count: lostAuditTrails,
    cross_tenant_failure_count: crossTenantFailures,
    unresolved_evidence_bypass_count: unresolvedEvidenceBypasses,
    critical_incorrect_result_count: criticalIncorrect,
    gates,
    human_review_required: true,
  };
}

/** Assemble all controls without granting autonomous compliance authority. */
export function evaluateComplianceAssuranceCase(input = {}) {
  const layered = assessLayeredProgramHandoff(
    input.layered_result,
    input.applicable_program_codes,
  );
  const regulatory = assessRegulatoryIssues({
    authorities: input.authorities,
    exceptions: input.exceptions ?? [],
    eventDate: input.event_date,
  });
  const audit = assessAuditRemediation({
    findings: input.audit_findings ?? [],
    auditPackage: input.audit_package ?? {},
  });
  const escalation = assessHumanEscalationAccuracy(
    input.escalation_outcomes ?? [],
    input.escalation_thresholds,
  );
  const performance = assessCustomerFilePerformance(
    input.customer_file_observations ?? [],
    input.performance_thresholds,
  );
  const productionSecurity = {
    rls_verified: input.production_security?.rls_verified === true,
    cross_role_matrix_passed: input.production_security?.cross_role_matrix_passed === true,
    invitation_workflow_passed: input.production_security?.invitation_workflow_passed === true,
    append_only_audit_verified: input.production_security?.append_only_audit_verified === true,
    unauthorized_cross_tenant_access_count:
      Number(input.production_security?.unauthorized_cross_tenant_access_count ?? -1),
  };
  const securityReady =
    productionSecurity.rls_verified &&
    productionSecurity.cross_role_matrix_passed &&
    productionSecurity.invitation_workflow_passed &&
    productionSecurity.append_only_audit_verified &&
    productionSecurity.unauthorized_cross_tenant_access_count === 0;
  const componentStatuses = {
    layered: layered.status,
    regulatory: regulatory.status,
    audit: audit.status,
    escalation: escalation.status,
    performance: performance.status,
    production_security: securityReady ? "SECURITY_GATE_MET" : ASSURANCE_STATUS.BLOCKED,
  };
  const ready =
    layered.status === "REVIEWABLE" &&
    regulatory.status === "CLEAR_FOR_HUMAN_REVIEW" &&
    audit.status === "AUDIT_READY" &&
    escalation.status === "ACCURACY_GATE_MET" &&
    performance.status === "SUSTAINED_PERFORMANCE_GATE_MET" &&
    securityReady;
  return {
    status: ready ? ASSURANCE_STATUS.READY_FOR_HUMAN_DECISION : ASSURANCE_STATUS.BLOCKED,
    determination_status: ready ? "PENDING_HUMAN_DECISION" : "NOT_DETERMINED",
    rule_engine_authority: "BLOCKED_PENDING_HUMAN_DECISION",
    engine_build: ASSURANCE_ENGINE_BUILD,
    component_statuses: componentStatuses,
    components: { layered, regulatory, audit, escalation, performance, production_security: productionSecurity },
    human_review_required: true,
    autonomous_compliance_determination_permitted: false,
  };
}
