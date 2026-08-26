export const COMPLIANCE_SOURCE_STATUS_BUILD =
  "compliance-source-status-2026.08.25.1";

export const COMPLIANCE_SOURCE_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  CANDIDATE: "CANDIDATE",
  BLOCKED: "BLOCKED",
  SUPERSEDED: "SUPERSEDED",
  SOURCE_CHANGED: "SOURCE_CHANGED",
  AWAITING_REVIEW: "AWAITING_REVIEW",
  AWAITING_VP_VERIFICATION: "AWAITING_VP_VERIFICATION",
});

const STATUS_VALUES = new Set(Object.values(COMPLIANCE_SOURCE_STATUS));

function validTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function unique(values = []) {
  return [...new Set(values.map(String).filter(Boolean))].sort();
}

/**
 * Converts source/release control-plane facts into a display status without
 * granting compliance authority. Status presentation is descriptive only.
 */
export function deriveComplianceSourceStatus(input = {}) {
  if (input.superseded === true) return COMPLIANCE_SOURCE_STATUS.SUPERSEDED;
  if (input.sourceChanged === true) return COMPLIANCE_SOURCE_STATUS.SOURCE_CHANGED;
  if (input.blocked === true) return COMPLIANCE_SOURCE_STATUS.BLOCKED;
  if (input.vpVerificationRequired === true && input.vpVerified !== true) {
    return COMPLIANCE_SOURCE_STATUS.AWAITING_VP_VERIFICATION;
  }
  if (input.reviewRequired === true && input.reviewApproved !== true) {
    return COMPLIANCE_SOURCE_STATUS.AWAITING_REVIEW;
  }
  if (input.activated === true) return COMPLIANCE_SOURCE_STATUS.ACTIVE;
  return COMPLIANCE_SOURCE_STATUS.CANDIDATE;
}

export function buildComplianceSourceStatusRecord(input = {}) {
  const status = input.status
    ? String(input.status).toUpperCase()
    : deriveComplianceSourceStatus(input);
  if (!STATUS_VALUES.has(status)) {
    throw new RangeError(`Unsupported compliance source status: ${status}`);
  }
  if (!input.id || !input.authority || !input.sourceUrl) {
    throw new TypeError("id, authority, and sourceUrl are required");
  }
  if (!validTimestamp(input.lastCheckedAt)) {
    throw new TypeError("lastCheckedAt must be a valid timestamp");
  }
  const sourceUrl = new URL(String(input.sourceUrl));
  if (sourceUrl.protocol !== "https:") {
    throw new TypeError("sourceUrl must use HTTPS");
  }

  return Object.freeze({
    id: String(input.id),
    status,
    authority: String(input.authority),
    sourceUrl: sourceUrl.toString(),
    sourceTitle: input.sourceTitle ? String(input.sourceTitle) : null,
    effectiveFrom: input.effectiveFrom ? String(input.effectiveFrom) : null,
    effectiveTo: input.effectiveTo ? String(input.effectiveTo) : null,
    lastCheckedAt: new Date(input.lastCheckedAt).toISOString(),
    changedAt: input.changedAt && validTimestamp(input.changedAt)
      ? new Date(input.changedAt).toISOString()
      : null,
    jurisdictions: Object.freeze(unique(input.jurisdictions)),
    programs: Object.freeze(unique(input.programs)),
    reviewRequired: input.reviewRequired === true,
    vpVerificationRequired: input.vpVerificationRequired === true,
    complianceActivationAllowed: status === COMPLIANCE_SOURCE_STATUS.ACTIVE,
  });
}

export function summarizeComplianceSourceStatuses(records = []) {
  const normalized = records.map(buildComplianceSourceStatusRecord);
  const counts = Object.fromEntries(
    Object.values(COMPLIANCE_SOURCE_STATUS).map((status) => [
      status,
      normalized.filter((record) => record.status === status).length,
    ]),
  );
  return Object.freeze({
    build: COMPLIANCE_SOURCE_STATUS_BUILD,
    total: normalized.length,
    counts: Object.freeze(counts),
    needsAttention: Object.freeze(
      normalized.filter((record) =>
        [
          COMPLIANCE_SOURCE_STATUS.BLOCKED,
          COMPLIANCE_SOURCE_STATUS.SOURCE_CHANGED,
          COMPLIANCE_SOURCE_STATUS.AWAITING_REVIEW,
          COMPLIANCE_SOURCE_STATUS.AWAITING_VP_VERIFICATION,
        ].includes(record.status),
      ),
    ),
    records: Object.freeze(normalized),
  });
}
