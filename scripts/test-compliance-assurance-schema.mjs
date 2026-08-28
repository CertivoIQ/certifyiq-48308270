import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260828360000_compliance_assurance_control_plane.sql",
  import.meta.url,
);
const optimizationUrl = new URL(
  "../supabase/migrations/20260828361000_optimize_compliance_assurance_rls.sql",
  import.meta.url,
);

const sql = await readFile(migrationUrl, "utf8");
const optimizationSql = await readFile(optimizationUrl, "utf8");
const statements = sql
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

const tables = [
  "compliance_assurance_cases",
  "compliance_regulatory_reviews",
  "compliance_remediation_actions",
  "compliance_escalation_outcomes",
  "compliance_customer_file_observations",
  "compliance_assurance_events",
];

test("every assurance table enables RLS", () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
});

test("anonymous and authenticated grants are revoked before narrow grants", () => {
  assert.match(sql, /revoke all on public\.compliance_assurance_cases[\s\S]+from anon, authenticated/i);
  const authenticatedGrants = statements.filter((statement) =>
    /\bto authenticated\b/i.test(statement),
  );
  assert.equal(authenticatedGrants.some((statement) => /^grant all\b/i.test(statement)), false);
});

test("authorization does not rely on user-editable metadata or deprecated auth.role", () => {
  assert.doesNotMatch(sql, /user_metadata|raw_user_meta_data|auth\.role\s*\(/i);
  assert.match(sql, /crm_staff_access[\s\S]+access_level in \('admin', 'manager'\)/i);
});

test("reviewer update policies cache auth identity once per statement", () => {
  for (const policy of [
    "reviewers update assurance cases",
    "reviewers update regulatory reviews",
    "reviewers update remediation actions",
  ]) {
    assert.match(optimizationSql, new RegExp(`alter policy "${policy}"`, "i"));
  }
  assert.equal(
    (optimizationSql.match(/private\.certivoiq_assurance_reviewer\(\(select auth\.uid\(\)\)\)/gi) ?? []).length,
    6,
  );
});

test("service-only production observations require real reviewed customer files", () => {
  assert.match(sql, /environment text not null check \(environment = 'production'\)/i);
  assert.match(sql, /actual_customer_file boolean not null check \(actual_customer_file\)/i);
  assert.match(sql, /human_review_complete boolean not null check \(human_review_complete\)/i);
  const customerObservationWrites = statements.filter(
    (statement) =>
      /^grant (?:insert|update|all)\b/i.test(statement) &&
      /compliance_customer_file_observations/i.test(statement) &&
      /\bto authenticated\b/i.test(statement),
  );
  assert.deepEqual(customerObservationWrites, []);
});

test("audit closure requires evidence and two-person verification", () => {
  assert.match(sql, /jsonb_array_length\(evidence_refs\) > 0/i);
  assert.match(sql, /verified_by <> closed_by/i);
});

test("assurance events are append-only", () => {
  assert.match(sql, /before update or delete on public\.compliance_assurance_events/i);
  assert.match(sql, /compliance assurance events are append-only/i);
});
