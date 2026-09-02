import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(
  readFileSync(new URL("../config/launch-control-gates.json", import.meta.url), "utf8"),
);
const runbook = readFileSync(
  new URL("../docs/LAUNCH-OPERATIONS-RUNBOOK.md", import.meta.url),
  "utf8",
);

test("every launch gate has explicit ownership and blocking semantics", () => {
  assert.ok(config.gates.length >= 10);
  for (const gate of config.gates) {
    assert.ok(gate.id && gate.category && gate.status && gate.ownerRole);
    assert.equal(typeof gate.blocking, "boolean");
  }
});

test("remaining human approvals are never labeled technically complete", () => {
  const humanIds = [
    "leaked_password_protection",
    "stripe_sandbox_checkout",
    "nspire_independent_attestations",
    "tn_tx_independent_source_validation",
    "terms_privacy_counsel_review",
  ];
  for (const id of humanIds) {
    assert.equal(config.gates.find((gate) => gate.id === id)?.status, "human_required");
  }
});

test("founder MFA enrollment is recorded from production verification evidence", () => {
  const gate = config.gates.find((item) => item.id === "founder_mfa_enrollment");
  assert.equal(gate?.status, "technical_complete");
  assert.match(gate?.evidence ?? "", /verified TOTP factor/i);
  assert.match(gate?.evidence ?? "", /2026-09-02/);
});

test("runbook defines security, billing, regulatory, and recovery escalation", () => {
  for (const phrase of [
    "P0",
    "fail closed",
    "two distinct staff attestations",
    "Stripe webhook signatures",
    "non-destructive restore",
    "not a customer SLA",
  ]) {
    assert.match(runbook, new RegExp(phrase, "i"));
  }
});
