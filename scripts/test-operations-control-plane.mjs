import assert from "node:assert/strict";
import test from "node:test";

import {
  RISK_TIERS,
  authorizeOperationsAction,
  boundedBackoffMs,
  crmProspectRecipientEligible,
  nextFailureState,
  platformRecipientEligible,
} from "../src/lib/operations-policy.mjs";

const future = "2030-01-01T00:00:00.000Z";

test("Tier 4 cannot execute without valid approval", () => {
  assert.deepEqual(
    authorizeOperationsAction({
      riskTier: RISK_TIERS.HUMAN_APPROVAL,
      action: "bulk_platform_email",
      actorId: "worker",
    }),
    { allowed: false, reason: "VALID_SEPARATE_APPROVAL_REQUIRED" },
  );
});

test("requester cannot approve or execute own Tier 4 action", () => {
  const result = authorizeOperationsAction({
    riskTier: RISK_TIERS.HUMAN_APPROVAL,
    action: "production_deploy",
    actorId: "requester",
    approval: {
      status: "approved",
      requestedBy: "requester",
      decidedBy: "requester",
      expiresAt: future,
    },
    now: new Date("2026-08-24T00:00:00Z"),
  });
  assert.equal(result.allowed, false);
});

test("expired approval is rejected", () => {
  const result = authorizeOperationsAction({
    riskTier: RISK_TIERS.HUMAN_APPROVAL,
    action: "change_billing",
    actorId: "worker",
    approval: {
      status: "approved",
      requestedBy: "requester",
      decidedBy: "approver",
      expiresAt: "2026-08-23T00:00:00Z",
    },
    now: new Date("2026-08-24T00:00:00Z"),
  });
  assert.equal(result.reason, "VALID_SEPARATE_APPROVAL_REQUIRED");
});

test("compliance activation fails closed on missing or conflicting evidence", () => {
  const approval = {
    status: "approved",
    requestedBy: "requester",
    decidedBy: "approver",
    expiresAt: future,
  };
  assert.equal(
    authorizeOperationsAction({
      riskTier: RISK_TIERS.HUMAN_APPROVAL,
      action: "activate_compliance_rule",
      actorId: "worker",
      approval,
      sourceEvidence: { officialUrl: "https://hud.gov/example", sha256: "abc", validationStatus: "conflicting" },
      deterministicValidation: { status: "passed" },
      now: new Date("2026-08-24T00:00:00Z"),
    }).allowed,
    false,
  );
});

test("only allowlisted reversible actions run at Tier 3", () => {
  assert.equal(
    authorizeOperationsAction({
      riskTier: RISK_TIERS.REVERSIBLE,
      action: "publish_crm_news",
      actorId: "worker",
    }).allowed,
    true,
  );
  assert.equal(
    authorizeOperationsAction({
      riskTier: RISK_TIERS.REVERSIBLE,
      action: "production_deploy",
      actorId: "worker",
    }).allowed,
    false,
  );
});

test("retry cap quarantines and opens incident", () => {
  assert.deepEqual(nextFailureState({ attempts: 2, maxAttempts: 3 }), {
    attempts: 3,
    status: "quarantined",
    openIncident: true,
    retryAfterMs: null,
  });
  assert.equal(boundedBackoffMs(99), 300_000);
});

test("platform recipients require authenticated user preference and no suppression", () => {
  assert.equal(
    platformRecipientEligible({
      authenticatedUserId: "user-1",
      email: "user@example.com",
      preferences: { regulatoryUpdates: true, unsubscribedAt: null },
      suppressed: false,
    }),
    true,
  );
  assert.equal(crmProspectRecipientEligible({ email: "lead@example.com" }), false);
  assert.equal(
    platformRecipientEligible({
      authenticatedUserId: null,
      email: "lead@example.com",
      preferences: { regulatoryUpdates: true, unsubscribedAt: null },
      suppressed: false,
    }),
    false,
  );
});
