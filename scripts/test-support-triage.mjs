import test from "node:test";
import assert from "node:assert/strict";

import { resolveRoutineSupportRequest } from "../src/lib/support-routine-replies.mjs";
import {
  SUPPORT_DISPOSITION,
  SUPPORT_PRIORITY,
  buildSupportActionPlan,
  classifySupportRequest,
} from "../src/lib/support-triage.mjs";

test("security/privacy incident escalates immediately", () => {
  const result = classifySupportRequest({
    message: "A user can see another property's resident data. This is a privacy incident.",
    confidence: 0.99,
  });
  assert.equal(result.priority, SUPPORT_PRIORITY.security);
  assert.equal(result.disposition, SUPPORT_DISPOSITION.escalateImmediate);
  assert.equal(result.humanRequired, true);
  assert.equal(result.allowSensitiveAutomation, false);
});

test("production UI outage escalates to a human", () => {
  const result = classifySupportRequest({
    message: "The dashboard is blank and not loading for our users.",
    confidence: 0.99,
  });
  assert.equal(result.priority, SUPPORT_PRIORITY.production);
  assert.equal(result.humanRequired, true);
});

test("material billing request requires human authorization", () => {
  const result = classifySupportRequest({
    message: "We were charged twice and need a refund.",
    confidence: 0.99,
  });
  assert.equal(result.priority, SUPPORT_PRIORITY.billing);
  assert.equal(result.allowRefund, false);
});

test("compliance/legal interpretation remains human-gated", () => {
  const result = classifySupportRequest({
    message: "Can you override this finding and approve the certification?",
    confidence: 0.99,
  });
  assert.equal(result.priority, SUPPORT_PRIORITY.compliance);
  assert.equal(result.allowComplianceOverride, false);
});

test("low confidence queues review instead of guessing", () => {
  const result = classifySupportRequest({
    message: "Something seems unusual in my account.",
    confidence: 0.51,
  });
  assert.equal(result.priority, SUPPORT_PRIORITY.lowConfidence);
  assert.equal(result.disposition, SUPPORT_DISPOSITION.queueReview);
});

test("routine usage can auto-resolve at high confidence", () => {
  const result = classifySupportRequest({
    message: "How do I upload a certification?",
    confidence: 0.95,
  });
  assert.equal(result.priority, SUPPORT_PRIORITY.routine);
  assert.equal(result.disposition, SUPPORT_DISPOSITION.autoResolve);
  assert.equal(result.humanRequired, false);
});

test("unclassified message queues review", () => {
  const result = classifySupportRequest({
    message: "I have a question about my account.",
    confidence: 0.95,
  });
  assert.equal(result.priority, SUPPORT_PRIORITY.lowConfidence);
  assert.equal(result.humanRequired, true);
});

test("blank support request queues review", () => {
  const result = classifySupportRequest({ message: "", confidence: 1 });
  assert.equal(result.priority, SUPPORT_PRIORITY.lowConfidence);
});

test("security plan prohibits sensitive automation", () => {
  const classification = classifySupportRequest({
    message: "We have a security incident and suspicious login.",
    confidence: 0.99,
  });
  const plan = buildSupportActionPlan(classification);
  assert.equal(plan.notifyImmediately, true);
  assert.equal(plan.createCase, true);
  assert.ok(plan.prohibitedActions.includes("disclose_sensitive_data"));
});

test("billing plan cannot alter contracts", () => {
  const classification = classifySupportRequest({
    message: "There is an invoice dispute.",
    confidence: 0.99,
  });
  const plan = buildSupportActionPlan(classification);
  assert.ok(plan.prohibitedActions.includes("alter_contract"));
});

test("compliance plan cannot approve certifications", () => {
  const classification = classifySupportRequest({
    message: "Give legal advice and approve this certification.",
    confidence: 0.99,
  });
  const plan = buildSupportActionPlan(classification);
  assert.ok(plan.prohibitedActions.includes("approve_certification"));
});

test("routine plan resolves without human notification", () => {
  const classification = classifySupportRequest({
    message: "How do I add a property?",
    confidence: 0.95,
  });
  const plan = buildSupportActionPlan(classification);
  assert.equal(plan.notifyHuman, false);
  assert.equal(plan.createCase, false);
  assert.ok(plan.permittedActions.includes("answer_from_approved_docs"));
});

test("routine upload question receives a deterministic self-service reply", () => {
  const reply = resolveRoutineSupportRequest("How do I upload a certification?");
  assert.match(reply, /certification review upload workflow/i);
  assert.match(reply, /human approval/i);
});

test("NOT_DETERMINED explanation remains a blocking-state explanation", () => {
  const reply = resolveRoutineSupportRequest("What does NOT_DETERMINED mean?");
  assert.match(reply, /blocking state/i);
  assert.match(reply, /not a pass or fail/i);
});

test("submission guidance does not imply external delivery", () => {
  const reply = resolveRoutineSupportRequest("How does submission work?");
  assert.match(reply, /does not by itself mean/i);
  assert.match(reply, /external housing authority/i);
});

test("routine billing navigation escalates disputes instead of promising refunds", () => {
  const reply = resolveRoutineSupportRequest("Where is my invoice?");
  assert.match(reply, /Billing/i);
  assert.match(reply, /human review/i);
});
