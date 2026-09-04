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

test("remaining human and external approvals are never labeled technically complete", () => {
  const expectedStatuses = {
    stripe_controlled_live_e2e: "human_required",
    tn_tx_independent_source_validation: "human_required",
    terms_privacy_counsel_review: "human_required",
    independent_penetration_test: "external_required",
    controlled_customer_pilot: "external_required",
    production_cutover_authorization: "human_required",
  };
  for (const [id, status] of Object.entries(expectedStatuses)) {
    assert.equal(config.gates.find((gate) => gate.id === id)?.status, status);
  }
});

test("state-rule requirement exposure is recorded as remediated from production evidence", () => {
  const gate = config.gates.find(
    (item) => item.id === "state_rule_document_requirements_rls",
  );
  assert.equal(gate?.status, "technical_complete");
  assert.equal(gate?.blocking, true);
  assert.match(gate?.evidence ?? "", /RLS enabled/i);
  assert.match(gate?.evidence ?? "", /zero findings/i);
});

test("Supabase leaked-password protection is recorded as verified complete", () => {
  const gate = config.gates.find((item) => item.id === "leaked_password_protection");
  assert.equal(gate?.status, "technical_complete");
  assert.equal(gate?.blocking, true);
  assert.match(gate?.evidence ?? "", /Pro plan/i);
  assert.match(gate?.evidence ?? "", /zero WARN/i);
  assert.match(gate?.evidence ?? "", /no auth_leaked_password_protection finding/i);
  assert.ok((gate?.evidence ?? "").includes("PLAN-BLOCKED-SECURITY-CONTROLS.md"));
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

test("successful isolated candidate deployment is recorded without cutover", () => {
  const candidate = config.gates.find(
    (item) => item.id === "cloudflare_candidate_deployment",
  );
  const cutover = config.gates.find(
    (item) => item.id === "production_cutover_authorization",
  );
  assert.equal(candidate?.status, "technical_complete");
  assert.match(candidate?.evidence ?? "", /33846067022/);
  assert.equal(cutover?.status, "human_required");
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
