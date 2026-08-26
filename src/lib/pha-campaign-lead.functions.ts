import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const PHA_PERSONAS = ["executive", "compliance", "hcv", "public-housing", "finance", "it"] as const;
export type PhaPersona = (typeof PHA_PERSONAS)[number];

const leadSchema = z.object({
  agencyName: z.string().min(2).max(180),
  name: z.string().min(2).max(120),
  title: z.string().min(2).max(140),
  email: z.string().email().max(160),
  phone: z.string().max(60).optional(),
  currentPlatform: z.string().max(120).optional(),
  persona: z.enum(PHA_PERSONAS),
  cta: z.string().min(2).max(120),
  units: z.number().int().min(0).max(2_000_000).optional(),
  note: z.string().max(1500).optional(),
  marketingConsent: z.boolean().default(false),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(180).optional(),
});

export const capturePhaCampaignLead = createServerFn({ method: "POST" })
  .inputValidator((data) => leadSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const source = `PHA campaign · ${data.persona}`;
    const notes = [
      `CTA: ${data.cta}.`,
      `Current platform: ${data.currentPlatform?.trim() || "Not provided"}.`,
      `Marketing consent: ${data.marketingConsent ? "yes" : "no"}.`,
      data.utmSource ? `UTM source: ${data.utmSource}.` : null,
      data.utmMedium ? `UTM medium: ${data.utmMedium}.` : null,
      data.utmCampaign ? `UTM campaign: ${data.utmCampaign}.` : null,
      data.note?.trim() ? `Prospect note: ${data.note.trim()}` : null,
    ].filter(Boolean).join(" ");

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("crm_accounts")
      .select("id")
      .or(`corporate_email.eq.${email},name.ilike.${data.agencyName.trim()}`)
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const accountPayload = {
      name: data.agencyName.trim(),
      account_type: "enterprise" as const,
      units: data.units ?? 0,
      stage: "new" as const,
      plan: "PHA / Enterprise",
      owner: "Unassigned",
      source,
      corporate_email: email,
      phone: data.phone?.trim() || null,
      responded: true,
      last_touch: `${data.cta} requested from PHA campaign landing page`,
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
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (contactLookupError) throw contactLookupError;

    const contactPayload = {
      account_id: accountId,
      name: data.name.trim(),
      title: data.title.trim(),
      email,
      phone: data.phone?.trim() || null,
      is_primary: true,
      notes: `PHA campaign persona: ${data.persona}. CTA: ${data.cta}. Marketing consent: ${data.marketingConsent ? "yes" : "no"}.`,
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
      message: "Your request is in. A CertivoIQ PHA specialist can now follow up using the context you provided.",
    };
  });
