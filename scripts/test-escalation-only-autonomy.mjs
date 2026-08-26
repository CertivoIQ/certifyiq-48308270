import assert from "node:assert/strict";
import test from "node:test";

import {
  ESCALATION_DESTINATIONS,
  founderEscalationSummary,
  planEscalationOnlyOperation,
} from "../src/lib/escalation-only-policy.mjs";

test("routine events continue without founder notification", () => {
  assert.deepEqual(planEscalationOnlyOperation({ type: "lead_captured", confidence: 0.99 }), {
    autonomous: true,
    notifyFounder: false,
    destination: "none",
    reason: "ROUTINE_ALLOWLISTED_EVENT",
    action: "continue_without_notification",
  });
});

test("unknown events fail closed into quarantine", () => {
  assert.equal(planEscalationOnlyOperation({ type: "new_unknown_event" }).action, "quarantine");
  assert.equal(planEscalationOnlyOperation(null).reason, "INVALID_EVENT");
});

test("compliance source conflicts are blocked and routed to compliance", () => {
  const decision = planEscalationOnlyOperation({
    type: "compliance_evidence_conflict",
    sourceConflict: true,
  });
  assert.equal(decision.autonomous, false);
  assert.equal(decision.notifyFounder, false);
  assert.equal(decision.destination, ESCALATION_DESTINATIONS.COMPLIANCE);
  assert.equal(decision.action, "block_and_escalate");
});

test("regulatory authority conflicts reach founder and legal review", () => {
  const event = { id: "event-1", type: "regulatory_authority_conflict", sourceConflict: true };
  const decision = planEscalationOnlyOperation(event);
  assert.equal(decision.notifyFounder, true);
  assert.equal(decision.destination, ESCALATION_DESTINATIONS.LEGAL);
  assert.deepEqual(founderEscalationSummary(event, decision), {
    eventId: "event-1",
    eventType: "regulatory_authority_conflict",
    destination: "legal",
    reason: "SOURCE_CONFLICT_REQUIRES_HUMAN_JUDGMENT",
    requestedDecision: "Obtain qualified legal or regulatory review.",
  });
});

test("critical customer or production impact reaches founder", () => {
  const decision = planEscalationOnlyOperation({
    type: "unexpected_runtime_event",
    severity: "critical",
    productionImpact: true,
  });
  assert.equal(decision.notifyFounder, true);
  assert.equal(decision.action, "contain_and_escalate");
});

test("specialist events do not interrupt founder", () => {
  const decision = planEscalationOnlyOperation({ type: "payment_failure" });
  assert.equal(decision.notifyFounder, false);
  assert.equal(decision.destination, ESCALATION_DESTINATIONS.FINANCE);
  assert.equal(decision.action, "route_to_specialist_queue");
});

test("low-confidence and exhausted-retry work never continues autonomously", () => {
  assert.equal(planEscalationOnlyOperation({ type: "lead_captured", confidence: 0.4 }).autonomous, false);
  assert.equal(planEscalationOnlyOperation({ type: "lead_captured", attempts: 3 }).action, "quarantine");
});
