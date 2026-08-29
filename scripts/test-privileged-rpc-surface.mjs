import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260829020000_harden_privileged_rpc_surface.sql", import.meta.url),
  "utf8",
);

const exposedRpcs = [
  "claim_certivoiq_founder_admin",
  "claim_crm_staff_invitation",
  "crm_staff_can_manage",
  "crm_staff_is_admin",
  "operations_approve",
  "operations_reject",
  "review_state_rule_source_candidate",
];

test("founder bootstrap is retired without privileged table access", () => {
  assert.match(migration, /founder_bootstrap_retired/);
  assert.match(
    migration,
    /function public\.claim_certivoiq_founder_admin\(\)[\s\S]*?security invoker/i,
  );
});

test("public RPCs are invoker wrappers", () => {
  for (const name of exposedRpcs) {
    const pattern = new RegExp(
      `function public\\.${name}\\([^]*?security invoker`,
      "i",
    );
    assert.match(migration, pattern, `${name} must be SECURITY INVOKER`);
  }
});

test("elevated implementations are private and client grants are explicit", () => {
  assert.match(migration, /function private\.claim_crm_staff_invitation_impl/);
  assert.match(migration, /function private\.operations_approve_impl/);
  assert.match(migration, /function private\.operations_reject_impl/);
  assert.match(migration, /function private\.review_state_rule_source_candidate_impl/);
  assert.match(migration, /revoke all on schema private from public, anon/i);
  assert.match(migration, /grant usage on schema private to authenticated, service_role/i);
});

test("state-source verification remains fail closed", () => {
  assert.match(migration, /compliance_activation_allowed = false/);
  assert.match(migration, /Active Manager or Administrator authority required/);
  assert.match(migration, /A lowercase 64-character SHA-256 is required/);
});
