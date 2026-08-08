export type SubmissionStatus = "draft" | "submitted" | "in_review" | "correction_required" | "accepted" | "withdrawn";
export type CorrectionStatus = "open" | "owner_responded" | "agency_review" | "accepted" | "reopened";
export type RuleReleaseStatus = "draft" | "expert_validated" | "agency_reviewed" | "agency_certified" | "suspended";

export type HfaAgency = { id: string; name: string; stateCode: string; authorityScope: string[] };
export type HfaMetric = { label: string; value: string; detail: string; tone?: "neutral" | "warning" | "critical" | "positive" };
export type HfaSubmission = {
  id: string;
  organizationName: string;
  propertyName: string;
  program: string;
  reportingPeriod: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  readinessScore: number;
  unresolvedFindings: number;
};
export type RulePackRelease = {
  id: string;
  stateCode: string;
  program: string;
  version: string;
  effectiveFrom: string;
  status: RuleReleaseStatus;
  sourceCount: number;
  testCount: number;
};
export type CorrectionCase = {
  id: string;
  submissionId: string;
  title: string;
  organizationName: string;
  propertyName: string;
  dueAt: string;
  status: CorrectionStatus;
  evidenceCount: number;
};

