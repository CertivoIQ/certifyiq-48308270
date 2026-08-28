import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSURANCE_STATUS,
  assessAuditRemediation,
  assessCustomerFilePerformance,
  assessHumanEscalationAccuracy,
  assessLayeredProgramHandoff,
  assessRegulatoryIssues,
  evaluateComplianceAssuranceCase,
} from "../src/lib/compliance-assurance-control-plane.mjs";

const programs = ["LIHTC", "HOME", "HUD_PBV", "RURAL_DEVELOPMENT", "LOCAL_PROGRAM", "PROJECT_AUTHORITY"];

function layered(overrides = {}) {
  return {
    resolution_status: "COMPLETED",
    determination_status: "PASS",
    rule_engine_authority: "ALLOWED",
    applicable_program_codes: [...programs].sort(),
    confirmed_failure_indicators: [],
    human_approval_required: true,
    ...overrides,
  };
}

function authority(id, outcome = "ELIGIBLE", precedence = 1, overrides = {}) {
  return {
    authority_id: id,
    program_code: "LIHTC",
    citation: `Controlled citation ${id}`,
    source_sha256: "a".repeat(64),
    rule_key: "HOUSEHOLD_ELIGIBILITY",
    required_outcome: outcome,
    validated_precedence: precedence,
    effective_from: "2026-01-01",
    effective_to: null,
    source_validated: true,
    effective_date_validated: true,
    applicability_validated: true,
    ...overrides,
  };
}

function auditPackage() {
  return {
    manifest_sha256: "b".repeat(64),
    rule_pack_versions: ["LIHTC-2026.1"],
    source_versions: ["SOURCE-1"],
    calculation_trace_refs: ["CALC-1"],
    review_history_refs: ["REVIEW-1"],
  };
}

function escalationOutcomes(count = 30) {
  return Array.from({ length: count }, (_, index) => ({
    event_id: `EVENT-${index}`,
    reviewer_id: `REVIEWER-${index % 3}`,
    system_decision: index % 2 ? "ESCALATE" : "DO_NOT_ESCALATE",
    human_decision: index % 2 ? "ESCALATE" : "DO_NOT_ESCALATE",
    severity: index === 1 ? "critical" : "major",
    human_review_complete: true,
  }));
}

function observations(count = 100) {
  return Array.from({ length: count }, (_, index) => ({
    customer_key: `CUSTOMER-${index % 3}`,
    file_key: `FILE-${index}`,
    observed_on: `2026-${index < 50 ? "06" : "07"}-${String((index % 28) + 1).padStart(2, "0")}`,
    environment: "production",
    actual_customer_file: true,
    human_review_complete: true,
    system_result: index % 2 ? "PASS" : "FAIL",
    human_result: index % 2 ? "PASS" : "FAIL",
    workflow_success: true,
    audit_trail_complete: true,
    cross_tenant_access_denied: true,
    unresolved_evidence_blocked: true,
    severity: "major",
  }));
}

test("layered LIHTC, HUD, HOME, RD, local, and project authority handoff is reviewable", () => {
  const result = assessLayeredProgramHandoff(layered(), programs);
  assert.equal(result.status, "REVIEWABLE");
  assert.equal(result.rule_engine_authority, "ALLOWED_FOR_REVIEW_ONLY");
});

test("an unresolved layered result remains blocked", () => {
  const result = assessLayeredProgramHandoff(
    layered({ resolution_status: "NOT_DETERMINED", determination_status: "NOT_DETERMINED", rule_engine_authority: "BLOCKED" }),
    programs,
  );
  assert.equal(result.status, ASSURANCE_STATUS.BLOCKED);
  assert.equal(result.reason_code, "LAYERED_RESULT_NOT_REVIEWABLE");
});

test("equal-precedence contradictory authorities produce CONFLICTING and legal escalation", () => {
  const result = assessRegulatoryIssues({
    eventDate: "2026-07-15",
    authorities: [authority("AUTH-A", "ELIGIBLE"), authority("AUTH-B", "INELIGIBLE")],
    exceptions: [],
  });
  assert.equal(result.status, ASSURANCE_STATUS.CONFLICTING);
  assert.equal(result.rule_engine_authority, "BLOCKED");
  assert.equal(result.escalation_destination, "LEGAL_AND_COMPLIANCE");
});

test("uncited or unapproved unusual exceptions never alter a determination", () => {
  const result = assessRegulatoryIssues({
    eventDate: "2026-07-15",
    authorities: [authority("AUTH-A")],
    exceptions: [{ exception_id: "EX-1", human_approval_status: "PENDING" }],
  });
  assert.equal(result.status, ASSURANCE_STATUS.PENDING);
  assert.equal(result.reason_code, "UNUSUAL_EXCEPTION_REQUIRES_APPROVAL");
});

test("audit findings cannot close without evidence and separation of duties", () => {
  const result = assessAuditRemediation({
    findings: [{
      finding_id: "F-1",
      severity: "major",
      status: "CLOSED",
      rule_id: "RULE-1",
      citation: "Controlled rule citation",
      evidence_refs: ["E-1"],
      remediation_summary: "Corrected and re-tested",
      verified_by: "USER-1",
      closed_by: "USER-1",
    }],
    auditPackage: auditPackage(),
  });
  assert.equal(result.status, ASSURANCE_STATUS.BLOCKED);
  assert.ok(result.missing_inputs.includes("findings[0].separation_of_duties"));
});

test("escalation accuracy documents recall, precision, agreement, and critical false negatives", () => {
  const result = assessHumanEscalationAccuracy(escalationOutcomes());
  assert.equal(result.status, "ACCURACY_GATE_MET");
  assert.equal(result.recall, 1);
  assert.equal(result.precision, 1);
  assert.equal(result.critical_false_negatives, 0);
});

test("a critical missed escalation blocks the accuracy gate", () => {
  const outcomes = escalationOutcomes();
  outcomes[1].system_decision = "DO_NOT_ESCALATE";
  const result = assessHumanEscalationAccuracy(outcomes);
  assert.equal(result.status, ASSURANCE_STATUS.PENDING);
  assert.equal(result.critical_false_negatives, 1);
  assert.equal(result.gates.zero_critical_false_negatives, false);
});

test("sustained performance requires reviewed production customer files and safety controls", () => {
  const result = assessCustomerFilePerformance(observations());
  assert.equal(result.status, "SUSTAINED_PERFORMANCE_GATE_MET");
  assert.equal(result.file_count, 100);
  assert.equal(result.customer_count, 3);
  assert.equal(result.human_agreement_rate, 1);
});

test("one cross-tenant access failure blocks sustained performance", () => {
  const sample = observations();
  sample[0].cross_tenant_access_denied = false;
  const result = assessCustomerFilePerformance(sample);
  assert.equal(result.status, ASSURANCE_STATUS.PENDING);
  assert.equal(result.cross_tenant_failure_count, 1);
});

test("the full control plane can only become ready for a human decision", () => {
  const result = evaluateComplianceAssuranceCase({
    event_date: "2026-07-15",
    applicable_program_codes: programs,
    layered_result: layered(),
    authorities: [authority("AUTH-A")],
    exceptions: [],
    audit_findings: [],
    audit_package: auditPackage(),
    escalation_outcomes: escalationOutcomes(),
    customer_file_observations: observations(),
    production_security: {
      rls_verified: true,
      cross_role_matrix_passed: true,
      invitation_workflow_passed: true,
      append_only_audit_verified: true,
      unauthorized_cross_tenant_access_count: 0,
    },
  });
  assert.equal(result.status, ASSURANCE_STATUS.READY_FOR_HUMAN_DECISION);
  assert.equal(result.determination_status, "PENDING_HUMAN_DECISION");
  assert.equal(result.rule_engine_authority, "BLOCKED_PENDING_HUMAN_DECISION");
  assert.equal(result.autonomous_compliance_determination_permitted, false);
});
