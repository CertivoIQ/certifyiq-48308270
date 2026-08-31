import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  HEALTH_CONTRACT_VERSION,
  HEALTH_SERVICE_NAME,
  buildHealthPayload,
  healthResponseHeaders,
} from "../src/lib/build-identity.mjs";

const EXPECTED_BODY = {
  ok: true,
  status: "ok",
  service: "certivoiq-web",
  contractVersion: 1,
};

test("liveness contract returns an exact 200 ok payload", () => {
  const result = buildHealthPayload();

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, EXPECTED_BODY);
  assert.equal(result.body.service, HEALTH_SERVICE_NAME);
  assert.equal(result.body.contractVersion, HEALTH_CONTRACT_VERSION);
});

test("liveness payload is deterministic and contains no deployment metadata", () => {
  assert.deepEqual(buildHealthPayload(), buildHealthPayload());

  const payload = JSON.stringify(buildHealthPayload().body);
  for (const forbidden of [
    "sourceRevision",
    "deploymentId",
    "timestamp",
    "url",
    "account",
    "credential",
    "secret",
    "token",
  ]) {
    assert.equal(payload.toLowerCase().includes(forbidden.toLowerCase()), false);
  }
});

test("responses are uncached JSON", () => {
  assert.deepEqual(healthResponseHeaders(), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
});

test("route exposes GET without reading runtime environment", () => {
  const route = fs.readFileSync("src/routes/api/public/health.ts", "utf8");
  const helper = fs.readFileSync("src/lib/build-identity.mjs", "utf8");

  assert.match(route, /createFileRoute\("\/api\/public\/health"\)/);
  assert.match(route, /GET:/);
  assert.match(route, /buildHealthPayload\(\)/);
  assert.doesNotMatch(route, /process\.env/);
  assert.doesNotMatch(helper, /process\.env/);
});
