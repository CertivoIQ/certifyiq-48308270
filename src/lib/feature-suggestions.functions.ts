import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  accessToken: z.string().min(20),
  category: z.enum(["feature", "workflow", "integration", "reporting", "accessibility", "other"]),
  priority: z.enum(["nice_to_have", "important", "critical"]),
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(20).max(5000),
  expectedOutcome: z.string().trim().max(2000).optional(),
  currentPage: z.string().trim().max(300).optional(),
});

type DeliveryStatus = "sent" | "suppressed" | "failed";

export const submitFeatureSuggestion = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    // Generated types intentionally lag this release migration until the next schema refresh.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabaseAdmin as any;

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    const user = authData.user;
    if (authError || !user?.email || !user.email_confirmed_at) {
      throw new Error("A verified CertivoIQ account is required to submit a suggestion.");
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await client
      .from("product_feature_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("submitted_by", user.id)
      .gte("created_at", oneHourAgo);
    if (countError) throw countError;
    if ((count ?? 0) >= 5) {
      throw new Error("You have submitted five suggestions in the last hour. Please try again later.");
    }

    const [{ data: ownProfile, error: ownError }, { data: membership, error: membershipError }, { data: crmAccess, error: crmError }] = await Promise.all([
      client
        .from("customer_workspace_profiles")
        .select("user_id,organization_type")
        .eq("user_id", user.id)
        .maybeSingle(),
      client
        .from("pha_workspace_memberships")
        .select("workspace_user_id,agency_role")
        .eq("member_user_id", user.id)
        .eq("active", true)
        .maybeSingle(),
      client
        .from("crm_staff_access")
        .select("access_level,status")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    if (ownError) throw ownError;
    if (membershipError) throw membershipError;
    if (crmError) throw crmError;

    let workspaceUserId = user.id;
    let workspaceType: "multifamily" | "pha" | "internal_crm" = "multifamily";
    let submitterRole = "workspace_owner";

    if (ownProfile?.organization_type === "pha") {
      workspaceType = "pha";
      submitterRole = "workspace_owner";
    } else if (ownProfile) {
      workspaceType = "multifamily";
      submitterRole = "workspace_owner";
    } else if (membership?.workspace_user_id) {
      workspaceUserId = membership.workspace_user_id;
      workspaceType = "pha";
      submitterRole = membership.agency_role;
    } else if (crmAccess?.status === "active") {
      workspaceType = "internal_crm";
      submitterRole = `crm_${crmAccess.access_level}`;
    }

    const createdAt = new Date().toISOString();
    const { data: suggestion, error: insertError } = await client
      .from("product_feature_suggestions")
      .insert({
        submitted_by: user.id,
        workspace_user_id: workspaceUserId,
        submitter_email: user.email.toLowerCase(),
        submitter_role: submitterRole,
        workspace_type: workspaceType,
        category: data.category,
        priority: data.priority,
        title: data.title,
        description: data.description,
        expected_outcome: data.expectedOutcome || null,
        current_page: data.currentPage || null,
      })
      .select("id")
      .single();
    if (insertError || !suggestion?.id) {
      throw insertError ?? new Error("Your suggestion could not be recorded.");
    }

    let deliveryStatus: DeliveryStatus = "failed";
    try {
      const result = await sendTemplateEmail("product-feature-suggestion", "", {
        templateData: {
          suggestionId: suggestion.id,
          submitterEmail: user.email.toLowerCase(),
          submitterRole,
          workspaceType,
          category: data.category,
          priority: data.priority,
          title: data.title,
          description: data.description,
          expectedOutcome: data.expectedOutcome || "Not provided",
          currentPage: data.currentPage || "Not provided",
          submittedAt: createdAt,
        },
        idempotencyKey: `product-feature-suggestion-${suggestion.id}`,
        replyTo: user.email,
      });
      deliveryStatus = result.sent ? "sent" : "suppressed";
      const { error: updateError } = await client
        .from("product_feature_suggestions")
        .update({
          email_delivery_status: deliveryStatus,
          emailed_at: result.sent ? new Date().toISOString() : null,
          email_delivery_error: result.sent ? null : result.reason,
        })
        .eq("id", suggestion.id);
      if (updateError) throw updateError;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed";
      await client
        .from("product_feature_suggestions")
        .update({ email_delivery_status: "failed", email_delivery_error: message })
        .eq("id", suggestion.id);
      deliveryStatus = "failed";
    }

    return {
      id: suggestion.id as string,
      status: "submitted" as const,
      deliveryStatus,
    };
  });
