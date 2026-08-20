export const SUBMISSION_AUTHORITY = Object.freeze({
  allowed: "ALLOWED",
  blocked: "BLOCKED",
});

export const SUBMISSION_STATUS = Object.freeze({
  authorized: "SUBMISSION_AUTHORIZED",
  reviewRequired: "HUMAN_REVIEW_REQUIRED",
  undetermined: "UNDETERMINED_FINDING",
  remediationRequired: "REMEDIATION_REQUIRED",
  staleApproval: "STALE_APPROVAL",
  expiredApproval: "EXPIRED_APPROVAL",
  revokedApproval: "REVOKED_APPROVAL",
  incomplete: "INCOMPLETE_REVIEW",
});

export function evaluateSubmissionAuthority({
  item,
  findings = [],
  reviews = [],
  manifest = null,
  evaluatedAt = new Date().toISOString(),
} = {}) {
  if (!item || item.status !== "completed" || !manifest?.manifest_sha256) {
    return {
      submissionAuthority: SUBMISSION_AUTHORITY.blocked,
      submissionStatus: SUBMISSION_STATUS.incomplete,
      reason:
        "The certification review and evidence manifest must be complete before submission.",
    };
  }

  const undetermined = findings.filter(
    (finding) => finding.status === "UNABLE_TO_DETERMINE",
  );

  if (undetermined.length) {
    return {
      submissionAuthority: SUBMISSION_AUTHORITY.blocked,
      submissionStatus: SUBMISSION_STATUS.undetermined,
      reason:
        "One or more findings remain unable to determine.",
      affectedFindingIds: undetermined.map((finding) => finding.id),
    };
  }

  const latestReviewByFinding = new Map();

  for (const review of reviews) {
    if (!review?.finding_id) continue;

    const current = latestReviewByFinding.get(review.finding_id);

    if (
      !current ||
      new Date(review.created_at).getTime() >
        new Date(current.created_at).getTime()
    ) {
      latestReviewByFinding.set(review.finding_id, review);
    }
  }

  const missingApproval = [];
  const remediation = [];
  const staleApproval = [];
  const expiredApproval = [];
  const revokedApproval = [];

  const evaluationTime = new Date(evaluatedAt).getTime();

  for (const finding of findings) {
    const review = latestReviewByFinding.get(finding.id);

    if (!review) {
      missingApproval.push(finding.id);
      continue;
    }

    if (review.decision === "remediation_requested") {
      remediation.push(finding.id);
      continue;
    }

    if (review.decision !== "approved") {
      missingApproval.push(finding.id);
      continue;
    }

    if (review.revoked_at) {
      revokedApproval.push(finding.id);
      continue;
    }

    if (
      review.expires_at &&
      evaluationTime >= new Date(review.expires_at).getTime()
    ) {
      expiredApproval.push(finding.id);
      continue;
    }

    if (
      review.manifest_sha256 &&
      review.manifest_sha256 !== manifest.manifest_sha256
    ) {
      staleApproval.push(finding.id);
    }
  }

  if (remediation.length) {
    return {
      submissionAuthority: SUBMISSION_AUTHORITY.blocked,
      submissionStatus: SUBMISSION_STATUS.remediationRequired,
      reason:
        "One or more current findings require remediation before submission.",
      affectedFindingIds: remediation,
    };
  }

  if (revokedApproval.length) {
    return {
      submissionAuthority: SUBMISSION_AUTHORITY.blocked,
      submissionStatus: SUBMISSION_STATUS.revokedApproval,
      reason:
        "One or more human approvals have been revoked.",
      affectedFindingIds: revokedApproval,
    };
  }

  if (expiredApproval.length) {
    return {
      submissionAuthority: SUBMISSION_AUTHORITY.blocked,
      submissionStatus: SUBMISSION_STATUS.expiredApproval,
      reason:
        "One or more human approvals have expired.",
      affectedFindingIds: expiredApproval,
    };
  }

  if (staleApproval.length) {
    return {
      submissionAuthority: SUBMISSION_AUTHORITY.blocked,
      submissionStatus: SUBMISSION_STATUS.staleApproval,
      reason:
        "One or more approvals refer to a prior evidence manifest.",
      affectedFindingIds: staleApproval,
    };
  }

  if (missingApproval.length) {
    return {
      submissionAuthority: SUBMISSION_AUTHORITY.blocked,
      submissionStatus: SUBMISSION_STATUS.reviewRequired,
      reason:
        "Every current finding requires human approval before submission.",
      affectedFindingIds: missingApproval,
    };
  }

  return {
    submissionAuthority: SUBMISSION_AUTHORITY.allowed,
    submissionStatus: SUBMISSION_STATUS.authorized,
    manifestSha256: manifest.manifest_sha256,
    approvedFindingIds: findings.map((finding) => finding.id),
  };
}
