import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const hudStageMigration = await readFile(
  new URL("../supabase/migrations/20260918164500_restore_hud_source_staging_rpc.sql", import.meta.url),
  "utf8",
);
const hudBoundaryMigration = await readFile(
  new URL("../supabase/migrations/20260918171500_harden_hud_source_staging_boundary.sql", import.meta.url),
  "utf8",
);
const stageScript = await readFile(
  new URL("./stage-hud-source-snapshot.mjs", import.meta.url),
  "utf8",
);
const operationsWorker = await readFile(
  new URL("../supabase/functions/operations-worker/index.ts", import.meta.url),
  "utf8",
);

import {
  HUD_DATASET_SCHEDULE_URL,
  TRACKED_HUD_DATASETS,
  compareHudSourceVersion,
  prepareHudSourceSnapshot,
  validateOfficialHudUrl,
} from "../src/lib/hud-source-pipeline.mjs";

const sampleHtml = `<html><head><title>Dataset Update Schedule</title></head><body><table>${TRACKED_HUD_DATASETS.map(
  ({ scheduleName }) => `<tr><td>${scheduleName}</td><td>FY 2026 data on 08/01/2026</td><td>2027</td></tr>`,
).join("")}</table></body></html>`;

test("only HTTPS HUD USER sources are accepted", () => {
  assert.equal(validateOfficialHudUrl(HUD_DATASET_SCHEDULE_URL), true);
  assert.equal(validateOfficialHudUrl("http://www.huduser.gov/portal/datasets"), false);
  assert.equal(validateOfficialHudUrl("https://huduser.gov.attacker.example/file"), false);
});

test("the schedule is deterministically hashed, parsed, and staged without activation", () => {
  const snapshot = prepareHudSourceSnapshot({
    sourceUrl: HUD_DATASET_SCHEDULE_URL,
    finalUrl: HUD_DATASET_SCHEDULE_URL,
    body: sampleHtml,
    contentType: "text/html; charset=utf-8",
    retrievedAt: "2026-08-25T05:00:00.000Z",
  });
  assert.equal(snapshot.stage_status, "VALIDATED_FOR_STAGING");
  assert.equal(snapshot.dataset_rows.length, TRACKED_HUD_DATASETS.length);
  assert.match(snapshot.source_sha256, /^[0-9a-f]{64}$/);
  assert.equal(snapshot.communication_allowed, false);
  assert.equal(snapshot.compliance_activation_allowed, false);
});

test("an incomplete or substituted page is blocked", () => {
  const blocked = prepareHudSourceSnapshot({
    sourceUrl: HUD_DATASET_SCHEDULE_URL,
    finalUrl: HUD_DATASET_SCHEDULE_URL,
    body: "<html>Dataset Update Schedule</html>",
    contentType: "text/html",
    retrievedAt: "2026-08-25T05:00:00.000Z",
  });
  assert.equal(blocked.stage_status, "BLOCKED");
  assert.equal(blocked.reason_code, "TRACKED_DATASET_ROWS_INCOMPLETE");
});

test("version comparison distinguishes initial, unchanged, and changed sources", () => {
  const a = "a".repeat(64);
  const b = "b".repeat(64);
  assert.equal(compareHudSourceVersion(null, a), "INITIAL");
  assert.equal(compareHudSourceVersion(a, a), "UNCHANGED");
  assert.equal(compareHudSourceVersion(a, b), "CHANGED");
});


test("production HUD staging RPC is secret-authenticated and fail-closed", () => {
  assert.match(hudStageMigration, /operations_stage_hud_source_v1/);
  assert.match(hudStageMigration, /github_operations_worker/);
  assert.match(hudStageMigration, /official HUD USER HTTPS source required/);
  assert.match(hudStageMigration, /tracked dataset rows incomplete/);
  assert.match(hudStageMigration, /compliance_activation_allowed', false/);
  assert.match(hudStageMigration, /communication_allowed', false/);
  assert.match(hudBoundaryMigration, /revoke all on function public\.operations_stage_hud_source_v1[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(hudBoundaryMigration, /grant execute on function public\.operations_stage_hud_source_v1[\s\S]*to service_role/i);
  assert.doesNotMatch(hudBoundaryMigration, /grant execute[\s\S]*to anon/i);
  assert.match(stageScript, /certivoiq-operations-worker/);
  assert.match(stageScript, /\/functions\/v1\/operations-worker\?mode=stage-hud-source/);
  assert.match(stageScript, /ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.doesNotMatch(stageScript, /CERTIVOIQ_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(stageScript, /OPERATIONS_WORKER_SECRET/);
  assert.match(operationsWorker, /hud-source-watch\.yml/);
  assert.match(operationsWorker, /searchParams\.get\("mode"\) === "stage-hud-source"/);
  assert.match(operationsWorker, /stageHudSource/);
  assert.match(operationsWorker, /authentication: "github_oidc"/);
});
