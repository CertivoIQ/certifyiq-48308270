import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

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


test("governance work is centralized in the Tasks workspace", () => {
  const appShell = readFileSync(
    new URL("../src/components/app-shell.tsx", import.meta.url),
    "utf8",
  );
  const tasksRoute = readFileSync(
    new URL("../src/routes/_authenticated/tasks.tsx", import.meta.url),
    "utf8",
  );
  const operationsMigration = readFileSync(
    new URL("../supabase/migrations/20260824220000_operations_control_plane.sql", import.meta.url),
    "utf8",
  );

  assert.match(appShell, /to:"\/tasks",label:"Tasks"/);
  assert.doesNotMatch(appShell, /NspireActivationAlert/);
  assert.match(tasksRoute, /pha_nspire_standard_releases/);
  assert.match(tasksRoute, /state_rule_pack_releases/);
  assert.match(tasksRoute, /state_rule_pack_candidates/);
  assert.match(tasksRoute, /state_rule_source_candidates/);
  assert.match(tasksRoute, /rule-pack-candidate:/);
  assert.match(tasksRoute, /rule-source-candidate:/);
  assert.match(tasksRoute, /const active = !candidate\.compliance_activation_allowed/);
  assert.match(tasksRoute, /if \(status === "verified"\) continue/);
  assert.doesNotMatch(
    tasksRoute,
    /for \(const candidate of sourceCandidates\) \{[\s\S]{0,220}const active = !candidate\.compliance_activation_allowed/,
  );
  assert.match(tasksRoute, /independent validation required/);
  assert.match(tasksRoute, /exact bytes .*required/);
  assert.match(tasksRoute, /operations_approvals/);
  assert.match(tasksRoute, /operations_source_versions/);
  assert.match(tasksRoute, /operations_incidents/);
  assert.match(tasksRoute, /Completed history/);

  const sourceTable = operationsMigration.match(
    /create table if not exists public\.operations_source_versions \([\s\S]*?\n\);/,
  )?.[0];
  assert.ok(sourceTable, "operations_source_versions schema is present");
  assert.doesNotMatch(sourceTable, /updated_at/);
  assert.match(tasksRoute, /\.order\("retrieved_at", \{ ascending: false \}\)/);
  assert.doesNotMatch(
    tasksRoute,
    /from\("operations_source_versions"\)[\s\S]{0,260}updated_at/,
  );
  assert.match(tasksRoute, /Task sources are unavailable/);
  assert.match(tasksRoute, /query\.error \? "—"/);
  assert.match(tasksRoute, /isMissingRelationError/);
  assert.match(tasksRoute, /source-unavailable:pha-nspire/);
  assert.match(tasksRoute, /NSPIRE controls remain unavailable and are not represented as complete/);
  assert.match(
    tasksRoute,
    /result\.error && !isMissingRelationError\(result\.error\)/,
  );
});
