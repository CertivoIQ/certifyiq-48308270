import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260831201500_paid_license_database_integrity.sql",
  "utf8",
);

test("paid-license migration defines an authoritative organization source of truth", () => {
  assert.match(migration, /create table if not exists public\.enterprise_licenses/i);
  assert.match(migration, /Authoritative organization-level paid-license record/i);
  assert.match(migration, /paid_license_entitlement_reconciliation/i);
  assert.match(migration, /security_invoker\s*=\s*true/i);
});

test("state scopes reject invalid and duplicate jurisdictions", () => {
  assert.match(migration, /certivoiq_state_codes_valid/i);
  assert.match(migration, /candidate\s*<@\s*array/i);
  assert.match(migration, /count\(distinct state_code\)/i);
  assert.match(migration, /cardinality\(licensed_state_codes\) = 1/i);
});

test("annual prices are enforced at the database boundary", () => {
  assert.match(migration, /annual_price_cents\s*=\s*15000000/i);
  assert.match(migration, /annual_price_cents\s*=\s*6500000\s*\*\s*cardinality/i);
  assert.match(migration, /enterprise_licenses_authoritative_price_check/i);
});

test("browser roles cannot mutate paid-license control tables", () => {
  assert.match(migration, /revoke all on public\.enterprise_licenses from public, anon, authenticated/i);
  assert.match(migration, /revoke all on public\.enterprise_invoice_events from public, anon, authenticated/i);
  assert.match(migration, /grant select on public\.enterprise_licenses to authenticated/i);
  assert.match(
    migration,
    /grant usage, select, update on sequence public\.enterprise_license_number_seq to service_role/i,
  );
});

test("migration has bounded locking and validation controls", () => {
  assert.match(migration, /set lock_timeout = '5s'/i);
  assert.match(migration, /set statement_timeout = '60s'/i);
  assert.match(migration, /not valid/i);
  assert.match(migration, /validate constraint/i);
});

