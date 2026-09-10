import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260910170637_auditor_workspace.sql", import.meta.url),
  "utf8",
);
const component = await readFile(
  new URL("../src/components/auditor-workspace.tsx", import.meta.url),
  "utf8",
);
const workspace = await readFile(
  new URL("../src/routes/_authenticated/audit-readiness.tsx", import.meta.url),
  "utf8",
);

test("enforces temporary scoped read-only auditor grants", () => {
  assert.match(migration, /scope_type in \('enterprise','portfolio','property'\)/);
  assert.match(migration, /auditor access must expire within 90 days/);
  assert.match(migration, /auditor grant revoked/);
  assert.match(migration, /auditor grant expired/);
  assert.match(migration, /revoke all on public\.auditor_access_grants,public\.auditor_access_events/);
  assert.match(migration, /grant select on public\.auditor_access_grants,public\.auditor_access_events/);
  assert.match(migration, /c\.status='approved_filed'/);
  assert.match(migration, /i\.program_codes && _grant\.program_codes/);
  assert.match(migration, /i\.property_id::text=any\(_grant\.property_ids\)/);
});

test("logs access and prevents cross-customer visibility", () => {
  assert.match(migration, /workspace_opened/);
  assert.match(migration, /grant_revoked/);
  assert.match(migration, /Auditor access history is immutable/);
  assert.match(migration, /_actor <> _grant\.owner_user_id and _actor <> _grant\.auditor_user_id/);
  assert.match(migration, /i\.user_id=_grant\.owner_user_id/);
  assert.match(migration, /m\.user_id=_grant\.owner_user_id/);
  assert.match(migration, /security definer set search_path=''/);
  assert.match(migration, /revoke all on function public\.auditor_workspace_snapshot/);
});

test("renders create, revoke, expiry, and read-only snapshot controls", () => {
  assert.match(component, /Issue scoped read-only access/);
  assert.match(component, /Access expires/);
  assert.match(component, /Revoke/);
  assert.match(component, /Scoped workspace opened/);
  assert.match(component, /Evidence Records/);
  assert.match(workspace, /<AuditorWorkspace \/>/);
});
