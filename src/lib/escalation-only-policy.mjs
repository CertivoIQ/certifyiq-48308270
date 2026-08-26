export const ESCALATION_DESTINATIONS = Object.freeze({
  NONE: "none",
  OPERATIONS: "operations",
  COMPLIANCE: "compliance",
  SECURITY: "security",
  FINANCE: "finance",
  EXECUTIVE: "executive",
  LEGAL: "legal",
});

const FOUNDER_EVENTS = new Map([
  ["material_billing_dispute", ESCALATION_DESTINATIONS.EXECUTIVE],
  ["strategic_contract_exception", ESCALATION_DESTINATIONS.EXECUTIVE],
  ["executive_procurement_request", ESCALATION_DESTINATIONS.EXECUTIVE],
  ["severe_production_incident", ESCALATION_DESTINATIONS.EXECUTIVE],
  ["legal_claim_or_demand", ESCALATION_DESTINATIONS.LEGAL],
  ["regulatory_authority_conflict", ESCALATION_DESTINATIONS.LEGAL],
]);

const SPECIALIST_EVENTS = new Map([
  ["compliance_evidence_conflict", ESCALATION_DESTINATIONS.COMPLIANCE],
  ["compliance_source_changed", ESCALATION_DESTINATIONS.COMPLIANCE],
  ["rule_activation_requested", ESCALATION_DESTINATIONS.COMPLIANCE],
  ["security_review_requested", ESCALATION_DESTINATIONS.SECURITY],
  ["suspected_security_incident", ESCALATION_DESTINATIONS.SECURITY],
  ["payment_failure", ESCALATION_DESTINATIONS.FINANCE],
  ["support_bug_reproduced", ESCALATION_DESTINATIONS.OPERATIONS],
  ["job_quarantined", ESCALATION_DESTINATIONS.OPERATIONS],
  ["worker_stale", ESCALATION_DESTINATIONS.OPERATIONS],
]);

const ROUTINE_EVENTS = new Set([
  "lead_captured",
  "demo_completed",
  "support_answer_grounded",
  "source_monitor_unchanged",
  "operations_health_check",
  "customer_onboarding_step_completed",
  "review_completed_without_exception",
]);

function cleanEvent(event) {
  if (!event || typeof event !== "object") return null;
  const type = typeof event.type === "string" ? event.type.trim() : "";
  if (!type) return null;
  return {
    type,
    id: typeof event.id === "string" && event.id.trim() ? event.id.trim() : null,
    severity: typeof event.severity === "string" ? event.severity.trim().toLowerCase() : "normal",
    confidence: Number.isFinite(event.confidence) ? Number(event.confidence) : null,
    attempts: Number.isInteger(event.attempts) ? event.attempts : 0,
    customerImpact: Boolean(event.customerImpact),
    productionImpact: Boolean(event.productionImpact),
    sourceConflict: Boolean(event.sourceConflict),
  };
}

export function planEscalationOnlyOperation(rawEvent) {
  const event = cleanEvent(rawEvent);
  if (!event) {
    return {
      autonomous: false,
      notifyFounder: false,
      destination: ESCALATION_DESTINATIONS.OPERATIONS,
      reason: "INVALID_EVENT",
      action: "quarantine",
    };
  }

  if (event.sourceConflict || event.type === "regulatory_authority_conflict") {
    return {
      autonomous: false,
      notifyFounder: event.type === "regulatory_authority_conflict",
      destination:
        event.type === "regulatory_authority_conflict"
          ? ESCALATION_DESTINATIONS.LEGAL
          : ESCALATION_DESTINATIONS.COMPLIANCE,
      reason: "SOURCE_CONFLICT_REQUIRES_HUMAN_JUDGMENT",
      action: "block_and_escalate",
    };
  }

  if (FOUNDER_EVENTS.has(event.type)) {
    return {
      autonomous: false,
      notifyFounder: true,
      destination: FOUNDER_EVENTS.get(event.type),
      reason: "FOUNDER_ESCALATION_EVENT",
      action: "block_and_escalate",
    };
  }

  if (event.severity === "critical" && (event.customerImpact || event.productionImpact)) {
    return {
      autonomous: false,
      notifyFounder: true,
      destination: ESCALATION_DESTINATIONS.EXECUTIVE,
      reason: "CRITICAL_CUSTOMER_OR_PRODUCTION_IMPACT",
      action: "contain_and_escalate",
    };
  }

  if (SPECIALIST_EVENTS.has(event.type)) {
    return {
      autonomous: false,
      notifyFounder: false,
      destination: SPECIALIST_EVENTS.get(event.type),
      reason: "SPECIALIST_ESCALATION_EVENT",
      action: "route_to_specialist_queue",
    };
  }

  if (event.confidence !== null && event.confidence < 0.85) {
    return {
      autonomous: false,
      notifyFounder: false,
      destination: ESCALATION_DESTINATIONS.OPERATIONS,
      reason: "LOW_CONFIDENCE",
      action: "route_to_specialist_queue",
    };
  }

  if (event.attempts >= 3) {
    return {
      autonomous: false,
      notifyFounder: false,
      destination: ESCALATION_DESTINATIONS.OPERATIONS,
      reason: "RETRY_CAP_REACHED",
      action: "quarantine",
    };
  }

  if (ROUTINE_EVENTS.has(event.type)) {
    return {
      autonomous: true,
      notifyFounder: false,
      destination: ESCALATION_DESTINATIONS.NONE,
      reason: "ROUTINE_ALLOWLISTED_EVENT",
      action: "continue_without_notification",
    };
  }

  return {
    autonomous: false,
    notifyFounder: false,
    destination: ESCALATION_DESTINATIONS.OPERATIONS,
    reason: "UNCLASSIFIED_EVENT",
    action: "quarantine",
  };
}

export function founderEscalationSummary(event, decision) {
  if (!decision?.notifyFounder) return null;
  return {
    eventId: event?.id ?? null,
    eventType: event?.type ?? "unknown",
    destination: decision.destination,
    reason: decision.reason,
    requestedDecision:
      decision.destination === ESCALATION_DESTINATIONS.LEGAL
        ? "Obtain qualified legal or regulatory review."
        : "Review the contained event and choose the approved next action.",
  };
}
