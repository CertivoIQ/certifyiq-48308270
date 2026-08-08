import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MailMergeInput {
  accountIds: string[];
  subject: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  campaignId?: string | null;
}

export interface MailMergeResult {
  sent: number;
  skipped: { company: string; reason: string }[];
}

/**
 * Staff-only mail merge: personalizes the subject/body per lead, sends through
 * the managed email domain and logs every attempt to the CRM activity feed.
 */
export const sendMailMerge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: MailMergeInput) => {
    if (!Array.isArray(input?.accountIds) || input.accountIds.length === 0) {
      throw new Error("Select at least one lead");
    }
    if (input.accountIds.length > 200) throw new Error("Send to at most 200 leads at a time");
    if (!input.subject?.trim()) throw new Error("Subject is required");
    if (!input.body?.trim()) throw new Error("Message body is required");
    return input;
  })
  .handler(async ({ data, context }): Promise<MailMergeResult> => {
    const { data: isStaff } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "staff",
    });
    if (!isStaff) throw new Response("Unauthorized", { status: 403 });

    const { mergeTokens } = await import("@/lib/crm");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

    const { data: accounts, error } = await context.supabase
      .from("crm_accounts")
      .select("*")
      .in("id", data.accountIds);
    if (error) throw error;

    const { data: contacts } = await context.supabase
      .from("crm_contacts")
      .select("*")
      .in("account_id", data.accountIds);

    const actorEmail = (context.claims as { email?: string } | null)?.email ?? null;
    const skipped: MailMergeResult["skipped"] = [];
    let sent = 0;

    for (const account of accounts ?? []) {
      const people = (contacts ?? []).filter((c) => c.account_id === account.id);
      const primary = people.find((c) => c.is_primary && c.email) ?? people.find((c) => c.email);
      const to = primary?.email ?? account.corporate_email;

      if (!to) {
        skipped.push({ company: account.name, reason: "No verified email on file" });
        continue;
      }

      const subject = mergeTokens(data.subject, account, primary?.name ?? null);
      const bodyText = mergeTokens(data.body, account, primary?.name ?? null);

      try {
        const result = await sendTemplateEmail("mail-merge", to, {
          templateData: {
            subject,
            bodyText,
            ...(data.ctaLabel ? { ctaLabel: data.ctaLabel } : {}),
            ...(data.ctaUrl ? { ctaUrl: data.ctaUrl } : {}),
            ...(actorEmail ? { agentEmail: actorEmail, agentName: "CertivoIQ Sales" } : {}),
          },
          ...(actorEmail ? { replyTo: actorEmail } : {}),
        });

        if (!result.sent) {
          skipped.push({ company: account.name, reason: "Recipient unsubscribed or undeliverable" });
        } else {
          sent++;
        }

        await context.supabase.from("crm_activities").insert({
          account_id: account.id,
          contact_id: primary?.id ?? null,
          campaign_id: data.campaignId ?? null,
          kind: "email",
          subject,
          body: bodyText,
          outcome: result.sent ? "sent" : "suppressed",
          actor_email: actorEmail,
          created_by: context.userId,
        });

        await context.supabase
          .from("crm_accounts")
          .update({
            last_contact_on: new Date().toISOString().slice(0, 10),
            next_followup_on: new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10),
            last_touch: `Mail merge: ${subject}`,
          })
          .eq("id", account.id);
      } catch (err) {
        skipped.push({
          company: account.name,
          reason: err instanceof Error ? err.message : "Send failed",
        });
      }
    }

    if (data.campaignId && sent > 0) {
      const { data: campaign } = await context.supabase
        .from("crm_campaigns")
        .select("sent, status")
        .eq("id", data.campaignId)
        .maybeSingle();
      await context.supabase
        .from("crm_campaigns")
        .update({ sent: (campaign?.sent ?? 0) + sent, status: "sending" })
        .eq("id", data.campaignId);
    }

    return { sent, skipped };
  });
