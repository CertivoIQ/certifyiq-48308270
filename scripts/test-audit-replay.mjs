import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260910165308_audit_replay.sql", import.meta.url),
  "utf8",
);
const component = await readFile(
  new URL("../src/components/audit-replay-timeline.tsx", import.meta.url),
  "utf8",
);
const workspace = await readFile(
  new URL("../src/routes/_authenticated/audit-readiness.tsx", import.meta.url),
  "utf8",
);

test("projects the full certification lifecycle without replacing Evidence Record", () => {
  for (const event of [
    "certification_uploaded",
    "documents_uploaded",
    "document_classified",
    "extraction_completed",
    "deterministic_rules_executed",
    "finding_created",
    "evidence_added",
    "correction_submitted",
    "finding_resolved",
    "reviewer_action",
    "approval",
    "evidence_record_finalized",
  ]) assert.match(migration, new RegExp(event));
  assert.match(migration, /references public\.evidence_manifests/);
  assert.doesNotMatch(migration, /create table public\.evidence_manifests/);
});

test("enforces immutable tenant-scoped read-only replay", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /\(select auth\.uid\(\)\) = user_id/);
  assert.match(migration, /revoke all on public\.audit_replay_events from public, anon, authenticated/);
  assert.match(migration, /grant select on public\.audit_replay_events to authenticated/);
  assert.match(migration, /Audit Replay history is immutable/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.audit_replay_timeline\(uuid,timestamptz\) from public,anon/);
});

test("renders a point-in-time replay with version and evidence drill-down", () => {
  assert.match(component, /type="datetime-local"/);
  assert.match(component, /\.lte\("occurred_at"/);
  assert.match(component, /Rule version:/);
  assert.match(component, /Source version:/);
  assert.match(component, /Engine version:/);
  assert.match(component, /Calculation inputs:/);
  assert.match(component, /Existing Evidence Record/);
  assert.match(workspace, /<AuditReplayTimeline \/>/);
});
