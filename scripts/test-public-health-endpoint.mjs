import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  HEALTH_SERVICE_NAME,
  buildHealthPayload,
  healthResponseHeaders,
  normalizeDeploymentId,
  normalizeSourceRevision,
} from "../src/lib/build-identity.mjs";

const VALID_REVISION = "5886d9cd50b37cfd4c4492be5199dddeeb571514";
const VALID_DEPLOYMENT = "certivoiq-web:2026-08-31.1";

test("valid identifiers return a 200 ok payload", () => {
  const result = buildHealthPayload({
    CERTIVOIQ_SOURCE_REVISION: VALID_REVISION,
    CERTIVOIQ_DEPLOYMENT_ID: VALID_DEPLOYMENT,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    ok: true,
    status: "ok",
    service: HEALTH_SERVICE_NAME,
    sourceRevision: VALID_REVISION,
    deploymentId: VALID_DEPLOYMENT,
  });
});

test("source revision is trimmed and normalized to lowercase", () => {
  const result = buildHealthPayload({
    CERTIVOIQ_SOURCE_REVISION: `  ${VALID_REVISION.toUpperCase()}  `,
    CERTIVOIQ_DEPLOYMENT_ID: `  ${VALID_DEPLOYMENT}  `,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.sourceRevision, VALID_REVISION);
  assert.equal(result.body.deploymentId, VALID_DEPLOYMENT);
});

test("missing or invalid identifiers return 503 without echoing values", () => {
  const cases = [
    {},
    { CERTIVOIQ_SOURCE_REVISION: VALID_REVISION },
    { CERTIVOIQ_DEPLOYMENT_ID: VALID_DEPLOYMENT },
    { CERTIVOIQ_SOURCE_REVISION: "", CERTIVOIQ_DEPLOYMENT_ID: VALID_DEPLOYMENT },
    { CERTIVOIQ_SOURCE_REVISION: "zz".repeat(20), CERTIVOIQ_DEPLOYMENT_ID: VALID_DEPLOYMENT },
    { CERTIVOIQ_SOURCE_REVISION: VALID_REVISION.slice(0, 39), CERTIVOIQ_DEPLOYMENT_ID: VALID_DEPLOYMENT },
    { CERTIVOIQ_SOURCE_REVISION: `${VALID_REVISION}a`, CERTIVOIQ_DEPLOYMENT_ID: VALID_DEPLOYMENT },
    { CERTIVOIQ_SOURCE_REVISION: VALID_REVISION, CERTIVOIQ_DEPLOYMENT_ID: "short" },
    { CERTIVOIQ_SOURCE_REVISION: VALID_REVISION, CERTIVOIQ_DEPLOYMENT_ID: "has space id" },
    { CERTIVOIQ_SOURCE_REVISION: VALID_REVISION, CERTIVOIQ_DEPLOYMENT_ID: "bad/slash/value" },
    { CERTIVOIQ_SOURCE_REVISION: VALID_REVISION, CERTIVOIQ_DEPLOYMENT_ID: "x".repeat(129) },
  ];

  for (const env of cases) {
    const result = buildHealthPayload(env);
    assert.equal(result.status, 503, `expected 503 for ${JSON.stringify(env)}`);
    assert.deepEqual(result.body, {
      ok: false,
      status: "misconfigured",
      service: HEALTH_SERVICE_NAME,
    });

    const serialized = JSON.stringify(result.body);
    for (const value of Object.values(env)) {
      if (typeof value === "string" && value.length > 0) {
        assert.equal(serialized.includes(value), false, "invalid value must not be echoed");
      }
    }
  }
});

test("undefined environment is treated as misconfigured", () => {
  assert.equal(buildHealthPayload(undefined).status, 503);
});

test("normalizers reject non-string input", () => {
  for (const value of [null, undefined, 42, {}, []]) {
    assert.equal(normalizeSourceRevision(value), null);
    assert.equal(normalizeDeploymentId(value), null);
  }
});

test("responses are uncached JSON", () => {
  const headers = healthResponseHeaders();
  assert.equal(headers["cache-control"], "no-store");
  assert.match(headers["content-type"], /^application\/json/);
});

test("payload shape carries no secrets or environment data", () => {
  const ok = buildHealthPayload({
    CERTIVOIQ_SOURCE_REVISION: VALID_REVISION,
    CERTIVOIQ_DEPLOYMENT_ID: VALID_DEPLOYMENT,
  }).body;

  assert.deepEqual(Object.keys(ok).sort(), [
    "deploymentId",
    "ok",
    "service",
    "sourceRevision",
    "status",
  ]);

  const failure = buildHealthPayload({}).body;
  assert.deepEqual(Object.keys(failure).sort(), ["ok", "service", "status"]);
});

test("route handler only reads the two build identity variables", () => {
  const route = fs.readFileSync("src/routes/api/public/health.ts", "utf8");
  const referenced = [...route.matchAll(/process\.env\[?["']([A-Z0-9_]+)["']\]?/g)].map((m) => m[1]);
  assert.deepEqual(referenced.sort(), ["CERTIVOIQ_DEPLOYMENT_ID", "CERTIVOIQ_SOURCE_REVISION"]);
  assert.match(route, /createFileRoute\("\/api\/public\/health"\)/);
  assert.match(route, /GET:/);
});
