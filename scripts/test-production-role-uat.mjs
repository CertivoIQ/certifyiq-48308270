import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../supabase/tests/production_role_cross_tenant_uat.sql", import.meta.url),
  "utf8",
);

test("production UAT is rollback-only", () => {
  assert.match(sql, /^-- Rollback-only production UAT/);
  assert.match(sql, /begin;/);
  assert.match(sql, /rollback;\s*$/);
});

test("production UAT covers both customer isolation and staff scope", () => {
  assert.match(sql, /Customer A tenant isolation failed/);
  assert.match(sql, /Customer B tenant isolation failed/);
  assert.match(sql, /Staff administrative visibility failed/);
  assert.match(sql, /Cross-user role probing was not blocked/);
  assert.match(sql, /Founder bootstrap retirement regressed/);
});

test("production UAT uses synthetic invalid-domain identities", () => {
  assert.equal((sql.match(/@certivoiq\.invalid/g) ?? []).length, 3);
});
