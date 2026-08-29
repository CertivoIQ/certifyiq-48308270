import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isOrganizationEmail } from "@/lib/organization-email.mjs";

export const PHA_PERSONAS = [
  "executive",
  "compliance",
  "hcv",
  "public-housing",
  "finance-operations",
  "technology",
] as const;

export type PhaPersona = (typeof PHA_PERSONAS)[number];

const leadSchema = z.object({
  agencyName: z.string().trim().min(2).max(180),
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(140),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(60).optional(),
  currentPlatform: z.string().trim().max(120).optional(),
  persona: z.enum(PHA_PERSONAS),
  cta: z.string().trim().min(2).max(120),
  units: z.number().int().min(0).max(2_000_000).optional(),
  note: z.string().trim().max(1500).optional(),
  marketingConsent: z.boolean().default(false),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(180).optional(),
  website: z.string().max(0).optional(),
});

export const capturePhaCampaignLead = createServerFn({ method: "POST" })
  .inputValidator((input) => {
    const data = leadSchema.parse(input);
    const email = data.email.toLowerCase();
    if (!isOrganizationEmail(email)) {
      throw new Error("Please use your housing agency or organization email address.");
    }
    return { ...data, email };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const source = `PHA role campaign · ${data.persona}`;
    const notes = [
      `Role path: ${data.persona}.`,
      `CTA: ${data.cta}.`,
      `Current platform: ${data.currentPlatform || "Not provided"}.`,
      `Marketing consent: ${data.marketingConsent ? "yes" : "no"}.`,
      data.utmSource ? `UTM source: ${data.utmSource}.` : null,
      data.utmMedium ? `UTM medium: ${data.utmMedium}.` : null,
      data.utmCampaign ? `UTM campaign: ${data.utmCampaign}.` : null,
      data.note ? `Prospect note: ${data.note}` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const { data: emailMatch, error: emailLookupError } = await supabaseAdmin
      .from("crm_accounts")
      .select("id")
      .eq("corporate_email", data.email)
      .limit(1)
      .maybeSingle();
    if (emailLookupError) throw emailLookupError;

    let existing = emailMatch;
    if (!existing) {
      const { data: nameMatch, error: nameLookupError } = await supabaseAdmin
        .from("crm_accounts")
        .select("id")
        .ilike("name", data.agencyName)
        .limit(1)
        .maybeSingle();
      if (nameLookupError) throw nameLookupError;
      existing = nameMatch;
    }

    const accountPayload = {
      name: data.agencyName,
      account_type: "enterprise" as const,
      units: data.units ?? 0,
      stage: "new" as const,
      plan: "PHA Annual License — $150,000/year flat",
      owner: "Unassigned",
      source,
      corporate_email: data.email,
      phone: data.phone || null,
      responded: true,
      last_touch: `${data.cta} requested from ${data.persona} campaign page`,
      notes,
    };

    let accountId = existing?.id ?? null;
    if (accountId) {
      const { error } = await supabaseAdmin.from("crm_accounts").update(accountPayload).eq("id", accountId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("crm_accounts")
        .insert(accountPayload)
        .select("id")
        .single();
      if (error) throw error;
      accountId = inserted.id;
    }

    const { data: existingContact, error: contactLookupError } = await supabaseAdmin
      .from("crm_contacts")
      .select("id")
      .eq("account_id", accountId)
      .eq("email", data.email)
      .limit(1)
      .maybeSingle();
    if (contactLookupError) throw contactLookupError;

    const contactPayload = {
      account_id: accountId,
      name: data.name,
      title: data.title,
      email: data.email,
      phone: data.phone || null,
      is_primary: true,
      notes: `PHA campaign role: ${data.persona}. CTA: ${data.cta}. Marketing consent: ${data.marketingConsent ? "yes" : "no"}.`,
    };

    if (existingContact?.id) {
      const { error } = await supabaseAdmin.from("crm_contacts").update(contactPayload).eq("id", existingContact.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("crm_contacts").insert(contactPayload);
      if (error) throw error;
    }

    return {
      accountId,
      message: "Your request is confirmed. CertivoIQ now has the role and agency context needed for your tailored demonstration.",
    };
  });
