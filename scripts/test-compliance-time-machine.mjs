import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20260910180500_compliance_time_machine.sql", import.meta.url), "utf8");
const component = await readFile(new URL("../src/components/compliance-time-machine.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../src/routes/_authenticated/compliance-control-center.tsx", import.meta.url), "utf8");

test("reconstructs only stored historical state", () => {
  assert.match(migration, /stored-versioned-state-v1/);
  assert.match(migration, /portfolio_readiness_snapshots/);
  assert.match(migration, /audit_replay_events/);
  assert.match(migration, /effective_from<=_as_of::date/);
  assert.match(migration, /Present-day state was not regenerated backward/);
  assert.doesNotMatch(migration, /audit_readiness_score\(/);
});

test("supports comparison and version drill-down", () => {
  assert.match(migration, /comparison_state/);
  assert.match(migration, /readiness_score/);
  assert.match(migration, /rule_version/);
  assert.match(migration, /source_version/);
  assert.match(migration, /engine_version/);
  assert.match(component, /Changes between selected dates/);
  assert.match(component, /Applicable rule versions/);
});

test("is tenant scoped and anonymous execution is revoked", () => {
  assert.match(migration, /e\.user_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /n\.user_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /a\.user_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /revoke all on function public\.compliance_time_machine/);
  assert.match(route, /<ComplianceTimeMachine \/>/);
});
