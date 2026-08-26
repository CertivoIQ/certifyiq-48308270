import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPLIANCE_SOURCE_STATUS,
  buildComplianceSourceStatusRecord,
  deriveComplianceSourceStatus,
  summarizeComplianceSourceStatuses,
} from "../src/lib/compliance-source-status.mjs";

test("status precedence keeps changed, blocked, and superseded sources from appearing active", () => {
  assert.equal(
    deriveComplianceSourceStatus({ activated: true, sourceChanged: true }),
    COMPLIANCE_SOURCE_STATUS.SOURCE_CHANGED,
  );
  assert.equal(
    deriveComplianceSourceStatus({ activated: true, blocked: true }),
    COMPLIANCE_SOURCE_STATUS.BLOCKED,
  );
  assert.equal(
    deriveComplianceSourceStatus({ activated: true, superseded: true }),
    COMPLIANCE_SOURCE_STATUS.SUPERSEDED,
  );
});

test("VP verification and review remain explicit operational gates", () => {
  assert.equal(
    deriveComplianceSourceStatus({ activated: false, vpVerificationRequired: true }),
    COMPLIANCE_SOURCE_STATUS.AWAITING_VP_VERIFICATION,
  );
  assert.equal(
    deriveComplianceSourceStatus({ activated: false, reviewRequired: true }),
    COMPLIANCE_SOURCE_STATUS.AWAITING_REVIEW,
  );
});

test("active is the only display state that permits compliance activation", () => {
  const active = buildComplianceSourceStatusRecord({
    id: "hud-home-2026",
    activated: true,
    authority: "HUD",
    sourceUrl: "https://www.huduser.gov/portal/datasets/HOME-Income-limits.html",
    lastCheckedAt: "2026-08-25T20:00:00Z",
    jurisdictions: ["US"],
    programs: ["HOME"],
  });
  assert.equal(active.status, COMPLIANCE_SOURCE_STATUS.ACTIVE);
  assert.equal(active.complianceActivationAllowed, true);

  const candidate = buildComplianceSourceStatusRecord({
    id: "candidate",
    authority: "State HFA",
    sourceUrl: "https://example.gov/qap.pdf",
    lastCheckedAt: "2026-08-25T20:00:00Z",
    jurisdictions: ["TN"],
    programs: ["LIHTC"],
  });
  assert.equal(candidate.status, COMPLIANCE_SOURCE_STATUS.CANDIDATE);
  assert.equal(candidate.complianceActivationAllowed, false);
});

test("summary surfaces all statuses requiring operational attention", () => {
  const common = {
    authority: "HUD",
    sourceUrl: "https://www.hud.gov/source",
    lastCheckedAt: "2026-08-25T20:00:00Z",
  };
  const summary = summarizeComplianceSourceStatuses([
    { ...common, id: "one", activated: true },
    { ...common, id: "two", sourceChanged: true },
    { ...common, id: "three", blocked: true },
    { ...common, id: "four", reviewRequired: true },
    { ...common, id: "five", vpVerificationRequired: true },
    { ...common, id: "six" },
  ]);

  assert.equal(summary.total, 6);
  assert.equal(summary.counts.ACTIVE, 1);
  assert.equal(summary.counts.CANDIDATE, 1);
  assert.equal(summary.needsAttention.length, 4);
});

test("invalid transport and timestamps are rejected", () => {
  assert.throws(
    () =>
      buildComplianceSourceStatusRecord({
        id: "bad",
        authority: "HUD",
        sourceUrl: "http://hud.gov/source",
        lastCheckedAt: "2026-08-25T20:00:00Z",
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      buildComplianceSourceStatusRecord({
        id: "bad-time",
        authority: "HUD",
        sourceUrl: "https://hud.gov/source",
        lastCheckedAt: "not-a-time",
      }),
    /lastCheckedAt/,
  );
});
