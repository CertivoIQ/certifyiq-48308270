import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveRoutineSupportRequest } from "@/lib/support-routine-replies.mjs";
import {
  SUPPORT_PRIORITY,
  buildSupportActionPlan,
  classifySupportRequest,
} from "@/lib/support-triage.mjs";

function crmPriority(priority: string) {
  switch (priority) {
    case SUPPORT_PRIORITY.security:
      return "critical";
    case SUPPORT_PRIORITY.production:
    case SUPPORT_PRIORITY.billing:
      return "high";
    case SUPPORT_PRIORITY.compliance:
    case SUPPORT_PRIORITY.lowConfidence:
      return "normal";
    default:
      return "low";
  }
}

export const triageSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { message: string; confidence?: number }) => {
    const message = String(data?.message ?? "").trim();
    if (!message || message.length > 10_000) {
      throw new Error("A support message between 1 and 10,000 characters is required.");
    }

    const confidence =
      typeof data.confidence === "number" && Number.isFinite(data.confidence)
        ? Math.max(0, Math.min(1, data.confidence))
        : 0;

    return { message, confidence };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const classification = classifySupportRequest(data);
    const actionPlan = buildSupportActionPlan(classification);

    if (!actionPlan.createCase) {
      return {
        status: "AUTO_RESOLVED",
        classification,
        actionPlan,
        caseCreated: false,
        reply: resolveRoutineSupportRequest(data.message),
      } as const;
    }

    const subject = `SupportIQ: ${classification.category.replaceAll("_", " ")}`;
    const tags = [
      "supportiq",
      classification.category,
      classification.priority,
      classification.disposition,
      classification.humanRequired ? "authorized-review-required" : "auto-resolution-eligible",
    ];

    const { data: supportCase, error } = await supabase
      .from("support_cases")
      .insert({
        user_id: userId,
        subject,
        description: data.message,
        status: "open",
        priority: crmPriority(classification.priority),
        channel: "supportiq",
        tags,
        triage_category: classification.category,
        triage_priority: classification.priority,
        triage_disposition: classification.disposition,
        agent_confidence: data.confidence,
        human_required: classification.humanRequired,
        supportiq_metadata: {
          source: "authenticated_chat",
          gate: "deterministic-v1",
          actionPlan,
        },
      })
      .select("id, case_number, status, priority, created_at")
      .single();

    if (error) throw error;

    return {
      status:
        classification.priority === SUPPORT_PRIORITY.security
          ? "ESCALATED_IMMEDIATE"
          : "ESCALATED",
      classification,
      actionPlan,
      caseCreated: true,
      supportCase,
      reply:
        classification.priority === SUPPORT_PRIORITY.security
          ? "I created an immediate security/privacy escalation. Do not include additional sensitive resident data unless an authorized support agent requests it."
          : `I created support case ${supportCase.case_number} for authorized support review.`,
    } as const;
  });
