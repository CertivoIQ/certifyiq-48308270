export const SUPPORT_PRIORITY = Object.freeze({
  security: "P0_SECURITY",
  production: "P1_PRODUCTION_UI",
  billing: "P1_BILLING",
  compliance: "P2_COMPLIANCE_REVIEW",
  lowConfidence: "P2_SUPPORT_REVIEW",
  routine: "P3_ROUTINE",
});

export const SUPPORT_DISPOSITION = Object.freeze({
  escalateImmediate: "ESCALATE_IMMEDIATE",
  escalateHuman: "ESCALATE_HUMAN",
  queueReview: "QUEUE_REVIEW",
  autoResolve: "AUTO_RESOLVE",
});

const patterns = {
  security: [
    /unauthori[sz]ed access/i,
    /data (leak|breach|exposure)/i,
    /resident .* exposed/i,
    /tenant .* exposed/i,
    /suspicious login/i,
    /account hacked/i,
    /wrong user .* see/i,
    /privacy incident/i,
    /security incident/i,
  ],
  production: [
    /site .* down/i,
    /dashboard .* (blank|down|not loading)/i,
    /upload .* (broken|not working|fails)/i,
    /cannot log in/i,
    /can't log in/i,
    /production (error|outage)/i,
    /500 error/i,
    /service unavailable/i,
  ],
  billing: [
    /duplicate charge/i,
    /charged twice/i,
    /payment failed/i,
    /invoice dispute/i,
    /refund/i,
    /subscription .* (charged|billing)/i,
    /card .* declined/i,
  ],
  compliance: [
    /legal advice/i,
    /what should we legally/i,
    /interpret .* regulation/i,
    /compliance determination/i,
    /override .* finding/i,
    /approve .* certification/i,
    /tax credit recapture/i,
    /8823/i,
  ],
  routine: [
    /how do i upload/i,
    /where .* (manifest|finding|invoice|dashboard)/i,
    /invite .* (user|reviewer)/i,
    /reset .* password/i,
    /change .* password/i,
    /how do i add .* property/i,
    /what does .* not[_ -]?determined/i,
    /how .* submission .* work/i,
  ],
};

function matchesAny(text, expressions) {
  return expressions.some((expression) => expression.test(text));
}

export function classifySupportRequest({ message, confidence = 1 } = {}) {
  const text = String(message ?? "").trim();
  const normalizedConfidence = Number.isFinite(confidence)
    ? Math.max(0, Math.min(1, confidence))
    : 0;

  if (!text) {
    return {
      priority: SUPPORT_PRIORITY.lowConfidence,
      disposition: SUPPORT_DISPOSITION.queueReview,
      category: "unknown",
      humanRequired: true,
      reason: "A support request message is required.",
    };
  }

  if (matchesAny(text, patterns.security)) {
    return {
      priority: SUPPORT_PRIORITY.security,
      disposition: SUPPORT_DISPOSITION.escalateImmediate,
      category: "security_privacy",
      humanRequired: true,
      allowSensitiveAutomation: false,
      reason: "Potential security or privacy incident requires immediate human review.",
    };
  }

  if (matchesAny(text, patterns.production)) {
    return {
      priority: SUPPORT_PRIORITY.production,
      disposition: SUPPORT_DISPOSITION.escalateHuman,
      category: "production_ui",
      humanRequired: true,
      reason: "Potential production or user-interface incident requires human review.",
    };
  }

  if (matchesAny(text, patterns.billing)) {
    return {
      priority: SUPPORT_PRIORITY.billing,
      disposition: SUPPORT_DISPOSITION.escalateHuman,
      category: "billing",
      humanRequired: true,
      allowRefund: false,
      reason: "Material billing changes and disputes require human authorization.",
    };
  }

  if (matchesAny(text, patterns.compliance)) {
    return {
      priority: SUPPORT_PRIORITY.compliance,
      disposition: SUPPORT_DISPOSITION.escalateHuman,
      category: "compliance_legal",
      humanRequired: true,
      allowComplianceOverride: false,
      reason: "Compliance or legal interpretation must remain with an authorized human reviewer.",
    };
  }

  if (normalizedConfidence < 0.75) {
    return {
      priority: SUPPORT_PRIORITY.lowConfidence,
      disposition: SUPPORT_DISPOSITION.queueReview,
      category: "low_confidence",
      humanRequired: true,
      reason: "The support agent is not sufficiently confident to resolve this request automatically.",
    };
  }

  if (matchesAny(text, patterns.routine)) {
    return {
      priority: SUPPORT_PRIORITY.routine,
      disposition: SUPPORT_DISPOSITION.autoResolve,
      category: "routine_usage",
      humanRequired: false,
      reason: "Routine product guidance may be resolved automatically from approved support content.",
    };
  }

  return {
    priority: SUPPORT_PRIORITY.lowConfidence,
    disposition: SUPPORT_DISPOSITION.queueReview,
    category: "unclassified",
    humanRequired: true,
    reason: "Unclassified requests are queued rather than guessed.",
  };
}

export function buildSupportActionPlan(classification) {
  if (!classification) throw new Error("A support classification is required.");

  switch (classification.priority) {
    case SUPPORT_PRIORITY.security:
      return {
        notifyHuman: true,
        notifyImmediately: true,
        createCase: true,
        permittedActions: ["collect_minimum_incident_details", "preserve_transcript"],
        prohibitedActions: ["disclose_sensitive_data", "change_permissions", "close_incident"],
      };
    case SUPPORT_PRIORITY.production:
      return {
        notifyHuman: true,
        notifyImmediately: true,
        createCase: true,
        permittedActions: ["collect_error_details", "collect_browser_context", "summarize_incident"],
        prohibitedActions: ["claim_outage_resolved_without_verification"],
      };
    case SUPPORT_PRIORITY.billing:
      return {
        notifyHuman: true,
        notifyImmediately: false,
        createCase: true,
        permittedActions: ["collect_invoice_context", "summarize_billing_issue"],
        prohibitedActions: ["issue_large_refund", "alter_contract", "change_enterprise_terms"],
      };
    case SUPPORT_PRIORITY.compliance:
      return {
        notifyHuman: true,
        notifyImmediately: false,
        createCase: true,
        permittedActions: ["show_published_methodology", "show_existing_citations", "summarize_question"],
        prohibitedActions: ["override_finding", "approve_certification", "give_legal_advice"],
      };
    case SUPPORT_PRIORITY.routine:
      return {
        notifyHuman: false,
        notifyImmediately: false,
        createCase: false,
        permittedActions: ["answer_from_approved_docs", "guide_navigation", "provide_standard_troubleshooting"],
        prohibitedActions: ["invent_product_behavior", "access_unauthorized_account_data"],
      };
    default:
      return {
        notifyHuman: true,
        notifyImmediately: false,
        createCase: true,
        permittedActions: ["collect_context", "summarize_question"],
        prohibitedActions: ["guess", "take_sensitive_action"],
      };
  }
}
