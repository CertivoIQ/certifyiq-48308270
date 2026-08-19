import {
  evaluateTransmissionToken,
} from "./transmission-token.mjs";

export const TRANSMISSION_AUTHORITY = Object.freeze({
  allowed: "ALLOWED",
  blocked: "BLOCKED",
});

export const TRANSMISSION_STATUS = Object.freeze({
  authorized: "TRANSMISSION_AUTHORIZED",
  submissionAuthorityRequired: "SUBMISSION_AUTHORITY_REQUIRED",
  manifestMismatch: "PACKAGE_MANIFEST_MISMATCH",
  unauthorizedDestination: "UNAUTHORIZED_DESTINATION",
  duplicateTransmission: "DUPLICATE_TRANSMISSION",
  incompletePackage: "INCOMPLETE_TRANSMISSION_PACKAGE",
  tokenRequired: "TRANSMISSION_TOKEN_REQUIRED",
});

export function evaluateTransmissionAuthority({
  submissionAuthority,
  manifest,
  packageManifestSha256,
  destination,
  grant,
  priorSubmissions = [],
  token = null,
  submissionId = null,
  evaluatedAt = new Date().toISOString(),
} = {}) {
  if (
    submissionAuthority?.submissionAuthority !== "ALLOWED" ||
    submissionAuthority?.submissionStatus !== "SUBMISSION_AUTHORIZED"
  ) {
    return {
      transmissionAuthority: TRANSMISSION_AUTHORITY.blocked,
      transmissionStatus: TRANSMISSION_STATUS.submissionAuthorityRequired,
      reason:
        "The certification must have current persisted submission authority before a transmission package can be authorized.",
    };
  }

  if (
    !manifest?.id ||
    !manifest?.manifest_sha256 ||
    !packageManifestSha256
  ) {
    return {
      transmissionAuthority: TRANSMISSION_AUTHORITY.blocked,
      transmissionStatus: TRANSMISSION_STATUS.incompletePackage,
      reason:
        "The transmission package must include the current evidence manifest.",
    };
  }

  if (packageManifestSha256 !== manifest.manifest_sha256) {
    return {
      transmissionAuthority: TRANSMISSION_AUTHORITY.blocked,
      transmissionStatus: TRANSMISSION_STATUS.manifestMismatch,
      reason:
        "The transmission package does not match the currently authorized evidence manifest.",
      expectedManifestSha256: manifest.manifest_sha256,
      packageManifestSha256,
    };
  }

  if (!destination?.agencyId || !grant) {
    return {
      transmissionAuthority: TRANSMISSION_AUTHORITY.blocked,
      transmissionStatus: TRANSMISSION_STATUS.unauthorizedDestination,
      reason:
        "The destination agency must be explicitly authorized for this submission.",
    };
  }

  if (
    grant.agency_id !== destination.agencyId ||
    grant.revoked_at
  ) {
    return {
      transmissionAuthority: TRANSMISSION_AUTHORITY.blocked,
      transmissionStatus: TRANSMISSION_STATUS.unauthorizedDestination,
      reason:
        "The destination grant is missing, revoked, or does not match the selected agency.",
    };
  }

  const tokenResult = evaluateTransmissionToken({
    token,
    submissionId,
    manifestSha256: manifest.manifest_sha256,
    destinationAgencyId: destination.agencyId,
    evaluatedAt,
  });

  if (!tokenResult.authorized) {
    return {
      transmissionAuthority: TRANSMISSION_AUTHORITY.blocked,
      transmissionStatus: TRANSMISSION_STATUS.tokenRequired,
      tokenStatus: tokenResult.tokenStatus,
      reason: tokenResult.reason,
    };
  }

  const duplicate = priorSubmissions.find(
    (submission) =>
      submission.agency_id === destination.agencyId &&
      submission.evidence_manifest_id === manifest.id &&
      submission.status !== "withdrawn",
  );

  if (duplicate) {
    return {
      transmissionAuthority: TRANSMISSION_AUTHORITY.blocked,
      transmissionStatus: TRANSMISSION_STATUS.duplicateTransmission,
      reason:
        "This evidence manifest has already been submitted to the selected agency.",
      priorSubmissionId: duplicate.id,
    };
  }

  return {
    transmissionAuthority: TRANSMISSION_AUTHORITY.allowed,
    transmissionStatus: TRANSMISSION_STATUS.authorized,
    evidenceManifestId: manifest.id,
    manifestSha256: manifest.manifest_sha256,
    destinationAgencyId: destination.agencyId,
    transmissionTokenId: tokenResult.tokenId,
  };
}
