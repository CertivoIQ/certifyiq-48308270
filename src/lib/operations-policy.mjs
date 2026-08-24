export const RISK_TIERS = Object.freeze({
  OBSERVE: "tier_1_observe",
  PREPARE: "tier_2_prepare",
  REVERSIBLE: "tier_3_reversible",
  HUMAN_APPROVAL: "tier_4_human_approval",
});

export const HUMAN_APPROVAL_ACTIONS = Object.freeze([
  "activate_compliance_rule",
  "change_compliance_authority",
  "publish_property_figure",
  "bulk_platform_email",
  "change_billing",
  "change_customer_access",
  "production_deploy",
]);

const REVERSIBLE_ACTIONS = new Set([
  "publish_crm_news",
  "retry_transient_job",
  "quarantine_source",
  "prepare_pull_request",
  "prepare_communication",
]);

export function boundedBackoffMs(attempt, { baseMs = 1_000, maxMs = 300_000 } = {}) {
  const safeAttempt = Math.max(0, Math.trunc(Number(attempt) || 0));
  return Math.min(maxMs, baseMs * 2 ** safeAttempt);
}

export function approvalIsValid(approval, now = new Date()) {
  if (!approval || approval.status !== "approved") return false;
  if (!approval.decidedBy || approval.decidedBy === approval.requestedBy) return false;
  return Date.parse(approval.expiresAt) > now.getTime();
}

export function authorizeOperationsAction({
  riskTier,
  action,
  actorId,
  approval = null,
  sourceEvidence = null,
  deterministicValidation = null,
  now = new Date(),
}) {
  if (HUMAN_APPROVAL_ACTIONS.includes(action) && riskTier !== RISK_TIERS.HUMAN_APPROVAL) {
    return { allowed: false, reason: "ACTION_REQUIRES_TIER_4" };
  }

  if (action === "activate_compliance_rule") {
    if (!sourceEvidence?.officialUrl || !sourceEvidence?.sha256) {
      return { allowed: false, reason: "OFFICIAL_SOURCE_EVIDENCE_REQUIRED" };
    }
    if (sourceEvidence.validationStatus !== "validated") {
      return { allowed: false, reason: "SOURCE_NOT_VALIDATED" };
    }
    if (deterministicValidation?.status !== "passed") {
      return { allowed: false, reason: "DETERMINISTIC_VALIDATION_REQUIRED" };
    }
  }

  if (riskTier === RISK_TIERS.OBSERVE || riskTier === RISK_TIERS.PREPARE) {
    return { allowed: true, reason: "AUTOMATIC_LOW_RISK" };
  }

  if (riskTier === RISK_TIERS.REVERSIBLE) {
    return REVERSIBLE_ACTIONS.has(action)
      ? { allowed: true, reason: "PREAPPROVED_REVERSIBLE_ACTION" }
      : { allowed: false, reason: "REVERSIBLE_ACTION_NOT_ALLOWLISTED" };
  }

  if (riskTier === RISK_TIERS.HUMAN_APPROVAL) {
    if (!approvalIsValid(approval, now)) {
      return { allowed: false, reason: "VALID_SEPARATE_APPROVAL_REQUIRED" };
    }
    if (actorId && actorId === approval.requestedBy) {
      return { allowed: false, reason: "REQUESTER_CANNOT_EXECUTE_OWN_TIER_4_ACTION" };
    }
    return { allowed: true, reason: "VALID_HUMAN_APPROVAL" };
  }

  return { allowed: false, reason: "UNKNOWN_RISK_TIER" };
}

export function nextFailureState({ attempts, maxAttempts }) {
  const nextAttempts = Math.max(0, Number(attempts) || 0) + 1;
  if (nextAttempts >= Math.max(1, Number(maxAttempts) || 1)) {
    return {
      attempts: nextAttempts,
      status: "quarantined",
      openIncident: true,
      retryAfterMs: null,
    };
  }
  return {
    attempts: nextAttempts,
    status: "retry_wait",
    openIncident: false,
    retryAfterMs: boundedBackoffMs(nextAttempts - 1),
  };
}

export function platformRecipientEligible({ authenticatedUserId, email, preferences, suppressed }) {
  return Boolean(
    authenticatedUserId &&
      email &&
      preferences?.regulatoryUpdates === true &&
      preferences?.unsubscribedAt == null &&
      suppressed !== true,
  );
}

export function crmProspectRecipientEligible() {
  return false;
}
