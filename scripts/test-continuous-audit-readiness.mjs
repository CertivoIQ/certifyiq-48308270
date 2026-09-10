import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260910171958_continuous_audit_readiness.sql", import.meta.url),
  "utf8",
);
const component = await readFile(
  new URL("../src/components/continuous-audit-readiness.tsx", import.meta.url),
  "utf8",
);
const workspace = await readFile(
  new URL("../src/routes/_authenticated/audit-readiness.tsx", import.meta.url),
  "utf8",
);

test("uses explainable deterministic deductions only", () => {
  for (const code of [
    "open_finding","overdue_certification","missing_signature",
    "expired_verification","unresolved_correction","stale_rule_pack_coverage",
    "required_report","upcoming_deadline",
  ]) assert.match(migration, new RegExp(code));
  assert.match(migration, /'method','deterministic-v1'/);
  assert.match(migration, /'source_table'/);
  assert.match(migration, /'entity_id'/);
  assert.match(migration, /'points_recovered'/);
  assert.doesNotMatch(migration, /openai|anthropic|machine learning|random\(/i);
});

test("is tenant-scoped and fails closed for anonymous callers", () => {
  assert.match(migration, /f\.user_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /a\.user_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /l\.workspace_user_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.audit_readiness_score\(date\) from public,anon/);
});

test("renders deduction drill-down and exact remediation queue", () => {
  assert.match(component, /Get me to 100/);
  assert.match(component, /Exact remediation queue/);
  assert.match(component, /points_recovered/);
  assert.match(component, /entity_id/);
  assert.match(component, /did not substitute an estimated score/);
  assert.match(workspace, /<ContinuousAuditReadiness \/>/);
});
