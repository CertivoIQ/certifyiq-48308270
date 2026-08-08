/**
 * HFA Regulatory Console — Phase 1 types and deterministic helpers.
 *
 * Nothing in this module talks to the database. Every authorization decision
 * that matters is enforced server-side by row-level security; the predicates
 * here mirror those rules so they can be unit tested, and so the UI can hide
 * controls the server would refuse anyway.
 *
 * CertivoIQ is not endorsed, certified or partnered with any government
 * agency. Agency records in this console exist only because an owner
 * explicitly submitted a package to that agency.
 */

export type HfaSubmissionStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "correction_required"
  | "accepted"
  | "withdrawn";

export type CorrectionCaseStatus =
  | "open"
  | "owner_responded"
  | "agency_review"
  | "accepted"
  | "reopened";

export type AgencyRole = "agency_admin" | "rule_reviewer" | "monitor" | "read_only";

export const AGENCY_REVIEW_ROLES: readonly AgencyRole[] = ["agency_admin", "monitor"];

export type HfaAgency = {
  id: string;
  name: string;
  stateCode: string;
  authorityScope: string[];
  isDemo: boolean;
};

export type AgencyMembership = {
  agencyId: string;
  userId: string;
  role: AgencyRole;
};

export type SubmissionGrant = {
  submissionId: string;
  agencyId: string;
  grantedBy: string;
  grantedAt: string;
  revokedAt: string | null;
};

export type HfaSubmission = {
  id: string;
  agencyId: string;
  agencyName: string | null;
  ownerUserId: string;
  organizationId: string;
  propertyId: string;
  propertyName: string | null;
  certificationId: string | null;
  program: string;
  reportingPeriod: string;
  status: HfaSubmissionStatus;
  evidenceManifestId: string | null;
  readinessScore: number | null;
  preflight: PreflightResult | null;
  previousSubmissionId: string | null;
  submittedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

export type CorrectionCase = {
  id: string;
  submissionId: string;
  findingRef: string;
  title: string;
  detail: string | null;
  status: CorrectionCaseStatus;
  dueAt: string;
  ownerResponse: string | null;
  ownerRespondedAt: string | null;
  disposition: string | null;
  closedAt: string | null;
  createdAt: string;
};

export type CorrectionEvidence = {
  id: string;
  correctionCaseId: string;
  documentRef: string;
  documentLabel: string | null;
  sha256: string;
  submittedAt: string;
};

export type HfaAuditEvent = {
  id: string;
  actorKind: "owner" | "agency" | "system";
  action: string;
  detail: Record<string, string | number | boolean | null>;
  createdAt: string;
};

/* ------------------------------------------------------------------ preflight */

export type PreflightCheck = {
  id: string;
  label: string;
  /** A required check that is not satisfied blocks submission. */
  required: boolean;
  satisfied: boolean;
  note?: string;
};

export type PreflightResult = {
  checks: PreflightCheck[];
  /** Percentage of weighted checks satisfied, 0–100 with two decimals. */
  readinessScore: number;
  blockers: string[];
  canSubmit: boolean;
  /** True when the determination engine could not reach a Pass/Fail outcome. */
  unableToDetermine: boolean;
};

export type PreflightInput = {
  checks: PreflightCheck[];
  /** Set when the controlling state rule pack is not validated for decisions. */
  stateRuleUnvalidated?: boolean;
};

/**
 * Owner preflight. Required checks are weighted double, so a package that
 * satisfies only optional items cannot look nearly ready.
 */
export function runPreflight(input: PreflightInput): PreflightResult {
  const checks = input.checks;
  const weight = (c: PreflightCheck) => (c.required ? 2 : 1);
  const total = checks.reduce((sum, c) => sum + weight(c), 0);
  const earned = checks.reduce((sum, c) => sum + (c.satisfied ? weight(c) : 0), 0);
  const readinessScore = total === 0 ? 0 : Math.round((earned / total) * 10000) / 100;

  const blockers = checks
    .filter((c) => c.required && !c.satisfied)
    .map((c) => c.note ?? `${c.label} is incomplete.`);

  if (input.stateRuleUnvalidated) {
    blockers.push(
      "The controlling state rule pack is not validated, so this package would be submitted as unable to determine.",
    );
  }

  return {
    checks,
    readinessScore,
    blockers,
    canSubmit: blockers.length === 0,
    unableToDetermine: Boolean(input.stateRuleUnvalidated),
  };
}

/* ------------------------------------------------- authorization predicates */

export type AccessContext = {
  userId: string;
  memberships: AgencyMembership[];
};

/** A grant is active only while it exists and has not been revoked. */
export function isGrantActive(grant: SubmissionGrant | undefined | null): boolean {
  return Boolean(grant) && grant!.revokedAt === null;
}

/**
 * Mirrors `public.agency_can_view_submission`. An agency may read a submission
 * only when: the submission names that agency, the owner left draft state, an
 * unrevoked grant exists for that exact agency, and the viewer is a member of
 * it. Membership alone never exposes an owner's portfolio.
 */
export function agencyCanViewSubmission(
  ctx: AccessContext,
  submission: Pick<HfaSubmission, "id" | "agencyId" | "status">,
  grants: SubmissionGrant[],
): boolean {
  if (submission.status === "draft") return false;
  const grant = grants.find(
    (g) => g.submissionId === submission.id && g.agencyId === submission.agencyId,
  );
  if (!isGrantActive(grant)) return false;
  return ctx.memberships.some((m) => m.agencyId === submission.agencyId && m.userId === ctx.userId);
}

/** Mirrors `public.agency_can_review_submission`. */
export function agencyCanReviewSubmission(
  ctx: AccessContext,
  submission: Pick<HfaSubmission, "id" | "agencyId" | "status">,
  grants: SubmissionGrant[],
): boolean {
  if (!agencyCanViewSubmission(ctx, submission, grants)) return false;
  return ctx.memberships.some(
    (m) =>
      m.agencyId === submission.agencyId &&
      m.userId === ctx.userId &&
      AGENCY_REVIEW_ROLES.includes(m.role),
  );
}

/** Owners keep control of their own records; accepted packages are immutable. */
export function ownerCanEditSubmission(
  userId: string,
  submission: Pick<HfaSubmission, "ownerUserId" | "status">,
): boolean {
  return submission.ownerUserId === userId && submission.status !== "accepted";
}

/* ------------------------------------------------------------------ display */

export const SUBMISSION_STATUS_LABEL: Record<HfaSubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In review",
  correction_required: "Corrections required",
  accepted: "Accepted",
  withdrawn: "Withdrawn",
};

export const CORRECTION_STATUS_LABEL: Record<CorrectionCaseStatus, string> = {
  open: "Open",
  owner_responded: "Owner responded",
  agency_review: "Agency review",
  accepted: "Closed — accepted",
  reopened: "Reopened",
};

export type ConsoleTone = "seal" | "flag" | "reject" | "neutral";

export const SUBMISSION_STATUS_TONE: Record<HfaSubmissionStatus, ConsoleTone> = {
  draft: "neutral",
  submitted: "neutral",
  in_review: "neutral",
  correction_required: "flag",
  accepted: "seal",
  withdrawn: "reject",
};

export const CORRECTION_STATUS_TONE: Record<CorrectionCaseStatus, ConsoleTone> = {
  open: "flag",
  owner_responded: "neutral",
  agency_review: "neutral",
  accepted: "seal",
  reopened: "reject",
};

/** Days remaining before a correction deadline; negative when overdue. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}
