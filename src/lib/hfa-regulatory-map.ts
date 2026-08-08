/**
 * Row mappers for the HFA Regulatory Console. Pure, client-safe, and kept out
 * of the `.functions.ts` module so server-function splitting stays clean.
 */

import type {
  CorrectionCase,
  CorrectionEvidence,
  HfaAuditEvent,
  HfaSubmission,
  PreflightResult,
} from "@/lib/hfaRegulatoryTypes";

type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const nstr = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null =>
  typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : null;

export function mapSubmission(row: Row): HfaSubmission {
  const agency = row["hfa_agencies"] as { name?: string } | null | undefined;
  return {
    id: str(row["id"]),
    agencyId: str(row["agency_id"]),
    agencyName: agency?.name ?? null,
    ownerUserId: str(row["owner_user_id"]),
    organizationId: str(row["organization_id"]),
    propertyId: str(row["property_id"]),
    propertyName: nstr(row["property_name"]),
    certificationId: nstr(row["certification_id"]),
    program: str(row["program"]),
    reportingPeriod: str(row["reporting_period"]),
    status: str(row["status"]) as HfaSubmission["status"],
    evidenceManifestId: nstr(row["evidence_manifest_id"]),
    readinessScore: num(row["readiness_score"]),
    preflight: (row["preflight"] as PreflightResult | null) ?? null,
    previousSubmissionId: nstr(row["previous_submission_id"]),
    submittedAt: nstr(row["submitted_at"]),
    acceptedAt: nstr(row["accepted_at"]),
    createdAt: str(row["created_at"]),
  };
}

export function mapCorrectionCase(row: Row): CorrectionCase {
  return {
    id: str(row["id"]),
    submissionId: str(row["submission_id"]),
    findingRef: str(row["finding_ref"]),
    title: str(row["title"]),
    detail: nstr(row["detail"]),
    status: str(row["status"]) as CorrectionCase["status"],
    dueAt: str(row["due_at"]),
    ownerResponse: nstr(row["owner_response"]),
    ownerRespondedAt: nstr(row["owner_responded_at"]),
    disposition: nstr(row["disposition"]),
    closedAt: nstr(row["closed_at"]),
    createdAt: str(row["created_at"]),
  };
}

export function mapCorrectionEvidence(row: Row): CorrectionEvidence {
  return {
    id: str(row["id"]),
    correctionCaseId: str(row["correction_case_id"]),
    documentRef: str(row["document_ref"]),
    documentLabel: nstr(row["document_label"]),
    sha256: str(row["sha256"]),
    submittedAt: str(row["submitted_at"]),
  };
}

export function mapAuditEvent(row: Row): HfaAuditEvent {
  return {
    id: str(row["id"]),
    actorKind: str(row["actor_kind"]) as HfaAuditEvent["actorKind"],
    action: str(row["action"]),
    detail: (row["detail"] as HfaAuditEvent["detail"]) ?? {},
    createdAt: str(row["created_at"]),
  };
}
