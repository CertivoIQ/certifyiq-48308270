import { describe, expect, it } from "vitest";
import {
  agencyCanReviewSubmission,
  agencyCanViewSubmission,
  isGrantActive,
  ownerCanEditSubmission,
  runPreflight,
  type AgencyMembership,
  type SubmissionGrant,
} from "@/lib/hfaRegulatoryTypes";

/**
 * Tenant-isolation tests for the HFA console. These assert the predicates the
 * UI uses; the same rules are enforced independently by row-level security in
 * `agency_can_view_submission` / `agency_can_review_submission`.
 */

const AGENCY_A = "agency-a";
const AGENCY_B = "agency-b";

const member = (agencyId: string, userId: string, role: AgencyMembership["role"]): AgencyMembership => ({
  agencyId,
  userId,
  role,
});

const submission = (over: Partial<{ id: string; agencyId: string; status: string }> = {}) => ({
  id: "sub-1",
  agencyId: AGENCY_A,
  status: "submitted" as const,
  ...over,
}) as { id: string; agencyId: string; status: "submitted" };

const grant = (over: Partial<SubmissionGrant> = {}): SubmissionGrant => ({
  submissionId: "sub-1",
  agencyId: AGENCY_A,
  grantedBy: "owner-1",
  grantedAt: "2026-01-01T00:00:00Z",
  revokedAt: null,
  ...over,
});

describe("submission grants", () => {
  it("treats a revoked grant as inactive", () => {
    expect(isGrantActive(grant())).toBe(true);
    expect(isGrantActive(grant({ revokedAt: "2026-02-01T00:00:00Z" }))).toBe(false);
    expect(isGrantActive(undefined)).toBe(false);
  });
});

describe("agency isolation", () => {
  const ctxA = { userId: "user-a", memberships: [member(AGENCY_A, "user-a", "monitor")] };
  const ctxB = { userId: "user-b", memberships: [member(AGENCY_B, "user-b", "agency_admin")] };

  it("lets the granted agency read the submission", () => {
    expect(agencyCanViewSubmission(ctxA, submission(), [grant()])).toBe(true);
  });

  it("blocks a different agency from reading another agency's submission", () => {
    expect(agencyCanViewSubmission(ctxB, submission(), [grant()])).toBe(false);
  });

  it("blocks discovery of owner records with no grant at all", () => {
    expect(agencyCanViewSubmission(ctxA, submission(), [])).toBe(false);
  });

  it("blocks access to draft packages even with a grant row", () => {
    expect(
      agencyCanViewSubmission(ctxA, submission({ status: "draft" }) as never, [grant()]),
    ).toBe(false);
  });

  it("removes access immediately when the grant is revoked", () => {
    expect(
      agencyCanViewSubmission(ctxA, submission(), [grant({ revokedAt: "2026-03-01T00:00:00Z" })]),
    ).toBe(false);
  });

  it("ignores a grant that names a different agency than the submission", () => {
    expect(agencyCanViewSubmission(ctxA, submission(), [grant({ agencyId: AGENCY_B })])).toBe(false);
  });

  it("restricts review actions to monitor and admin roles", () => {
    const readOnly = { userId: "user-c", memberships: [member(AGENCY_A, "user-c", "read_only")] };
    const ruleReviewer = { userId: "user-d", memberships: [member(AGENCY_A, "user-d", "rule_reviewer")] };
    expect(agencyCanReviewSubmission(ctxA, submission(), [grant()])).toBe(true);
    expect(agencyCanReviewSubmission(readOnly, submission(), [grant()])).toBe(false);
    expect(agencyCanReviewSubmission(ruleReviewer, submission(), [grant()])).toBe(false);
  });
});

describe("owner control", () => {
  it("lets an owner edit an unaccepted submission", () => {
    expect(ownerCanEditSubmission("owner-1", { ownerUserId: "owner-1", status: "submitted" })).toBe(true);
  });

  it("makes an accepted submission immutable", () => {
    expect(ownerCanEditSubmission("owner-1", { ownerUserId: "owner-1", status: "accepted" })).toBe(false);
  });

  it("never lets another user edit someone else's submission", () => {
    expect(ownerCanEditSubmission("owner-2", { ownerUserId: "owner-1", status: "draft" })).toBe(false);
  });
});

describe("owner preflight", () => {
  const checks = [
    { id: "a", label: "Signed TIC", required: true, satisfied: true },
    { id: "b", label: "Income verification", required: true, satisfied: false },
    { id: "c", label: "Utility allowance", required: false, satisfied: true },
  ];

  it("blocks submission while a required item is incomplete", () => {
    const result = runPreflight({ checks });
    expect(result.canSubmit).toBe(false);
    expect(result.blockers).toHaveLength(1);
  });

  it("weights required checks double in the readiness score", () => {
    const result = runPreflight({ checks });
    expect(result.readinessScore).toBe(60);
  });

  it("allows submission when every required item is satisfied", () => {
    const result = runPreflight({ checks: checks.map((c) => ({ ...c, satisfied: true })) });
    expect(result.canSubmit).toBe(true);
    expect(result.readinessScore).toBe(100);
  });

  it("blocks submission and flags unable-to-determine for an unvalidated state pack", () => {
    const result = runPreflight({
      checks: checks.map((c) => ({ ...c, satisfied: true })),
      stateRuleUnvalidated: true,
    });
    expect(result.unableToDetermine).toBe(true);
    expect(result.canSubmit).toBe(false);
  });
});
