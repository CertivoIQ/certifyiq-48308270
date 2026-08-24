import assert from "node:assert/strict";
import test from "node:test";

import { RISK_TIERS } from "../src/lib/operations-policy.mjs";
import {
  healthSummary,
  leaseIsOwned,
  planJobExecution,
  planWorkerFailure,
  validateWorkerRequest,
} from "../src/lib/operations-worker-runtime.mjs";

const now = new Date("2026-08-24T20:00:00Z");
const leased = {
  status: "running",
  leaseOwner: "source-monitor",
  leaseExpiresAt: "2026-08-24T20:02:00Z",
  heartbeatAt: "2026-08-24T19:59:30Z",
  riskTier: RISK_TIERS.PREPARE,
  action: "prepare_pull_request",
  attempts: 1,
  maxAttempts: 3,
};

test("worker identity and lease duration are validated", () => {
  assert.equal(validateWorkerRequest({ worker: "" }).valid, false);
  assert.equal(validateWorkerRequest({ worker: "worker", leaseSeconds: 10 }).valid, false);
  assert.deepEqual(validateWorkerRequest({ worker: " worker ", leaseSeconds: 120 }), {
    valid: true,
    worker: "worker",
    leaseSeconds: 120,
  });
});

test("only the lease owner may execute before expiry", () => {
  assert.equal(leaseIsOwned(leased, "source-monitor", now), true);
  assert.equal(leaseIsOwned(leased, "other-worker", now), false);
  assert.equal(leaseIsOwned(leased, "source-monitor", new Date("2026-08-24T20:03:00Z")), false);
});

test("Tier 2 preparation executes with a valid lease", () => {
  assert.deepEqual(planJobExecution({ job: leased, worker: "source-monitor", now }), {
    execute: true,
    reason: "AUTOMATIC_LOW_RISK",
  });
});

test("Tier 4 remains blocked without independent approval", () => {
  const result = planJobExecution({
    job: { ...leased, riskTier: RISK_TIERS.HUMAN_APPROVAL, action: "production_deploy" },
    worker: "source-monitor",
    now,
  });
  assert.equal(result.execute, false);
  assert.equal(result.reason, "VALID_SEPARATE_APPROVAL_REQUIRED");
});

test("retry cap deterministically quarantines", () => {
  assert.deepEqual(planWorkerFailure({ attempts: 2, maxAttempts: 3 }), {
    attempts: 3,
    status: "quarantined",
    openIncident: true,
    retryAfterMs: null,
  });
});

test("health summary detects stale workers and quarantine", () => {
  const result = healthSummary({
    now,
    jobs: [
      leased,
      { ...leased, leaseOwner: "stale", heartbeatAt: "2026-08-24T19:40:00Z" },
      { status: "quarantined", scheduledAt: "2026-08-24T19:00:00Z" },
      { status: "queued", scheduledAt: "2026-08-24T18:00:00Z" },
    ],
  });
  assert.equal(result.healthyRunning, 1);
  assert.equal(result.staleRunning, 1);
  assert.equal(result.quarantined, 1);
  assert.equal(result.oldestReadyAt, "2026-08-24T18:00:00Z");
  assert.equal(result.alert, true);
});
