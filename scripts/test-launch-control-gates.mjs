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
    "stripe_sandbox_checkout",
    "tn_tx_independent_source_validation",
    "terms_privacy_counsel_review",
  ];
  for (const id of humanIds) {
    assert.equal(config.gates.find((gate) => gate.id === id)?.status, "human_required");
  }
});

test("Supabase leaked-password protection is recorded as plan-blocked, not complete", () => {
  const gate = config.gates.find((item) => item.id === "leaked_password_protection");
  assert.equal(gate?.status, "plan_blocked");
  assert.equal(gate?.blocking, true);
  assert.match(gate?.evidence ?? "", /PLAN-BLOCKED-SECURITY-CONTROLS\.md/);
});

test("founder MFA enrollment is recorded from production verification evidence", () => {
  const gate = config.gates.find((item) => item.id === "founder_mfa_enrollment");
  assert.equal(gate?.status, "technical_complete");
  assert.match(gate?.evidence ?? "", /verified TOTP factor/i);
  assert.match(gate?.evidence ?? "", /2026-09-02/);
});

test("NSPIRE dual attestation is recorded from activated production evidence", () => {
  const gate = config.gates.find((item) => item.id === "nspire_independent_attestations");
  assert.equal(gate?.status, "technical_complete");
  assert.match(gate?.evidence ?? "", /two distinct staff attestations/i);
  assert.match(gate?.evidence ?? "", /9758d7703e574eb3f0ab923b58dc9040cf5f6e7a671db2785ebd4ec7ebee6254/i);
  assert.match(gate?.evidence ?? "", /activated as current/i);
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
