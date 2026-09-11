import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOrganizationEmail } from "@/lib/organization-email.mjs";

const LEAD_SOURCE = "3 FREE certification reviews";

export interface FreeReviewLeadInput {
  companyName: string;
  contactName: string;
  email: string;
}

export interface FreeReviewLeadResult {
  id: string;
  plan: string;
  created: boolean;
}

function platformLicense() {
  return "Annual Platform License";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const getFreeReviewLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("crm_accounts")
      .select("id, name, plan, units, properties, corporate_email, created_at")
      .eq("created_by", context.userId)
      .eq("source", LEAD_SOURCE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  });

export const captureFreeReviewLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: FreeReviewLeadInput) => {
    const companyName = data?.companyName?.trim();
    const contactName = data?.contactName?.trim();
    const email = data?.email?.trim().toLowerCase();

    if (!companyName) throw new Error("Company is required.");
    if (!contactName) throw new Error("Contact name is required.");
    if (!email || !isEmail(email) || !isOrganizationEmail(email)) {
      throw new Error("Use your organization website email address. Personal email providers are not eligible for the 3 FREE certification reviews.");
    }

    return { companyName, contactName, email };
  })
  .handler(async ({ data, context }): Promise<FreeReviewLeadResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const plan = platformLicense();
    const notes = "Warm lead captured before 3 FREE certification reviews. Minimal signup intentionally collects only company, contact name, and organization email.";

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("crm_accounts")
      .select("id")
      .eq("created_by", context.userId)
      .eq("source", LEAD_SOURCE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    const accountPayload = {
      name: data.companyName,
      account_type: "company" as const,
      units: 0,
      properties: 0,
      hq: "",
      stage: "trialing" as const,
      plan,
      owner: "Unassigned",
      source: LEAD_SOURCE,
      corporate_email: data.email,
      phone: null,
      states: [],
      programs: [],
      responded: true,
      last_touch: "3 FREE certification reviews started",
      notes,
      created_by: context.userId,
    };

    let accountId = existing?.id ?? null;
    if (accountId) {
      const { error } = await supabaseAdmin.from("crm_accounts").update(accountPayload).eq("id", accountId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabaseAdmin.from("crm_accounts").insert(accountPayload).select("id").single();
      if (error) throw error;
      accountId = inserted.id;
    }

    const { data: primaryContact, error: contactLookupError } = await supabaseAdmin
      .from("crm_contacts")
      .select("id")
      .eq("account_id", accountId)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();
    if (contactLookupError) throw contactLookupError;

    const contactPayload = {
      account_id: accountId,
      name: data.contactName,
      title: "",
      email: data.email,
      phone: null,
      notes: "3 FREE review lead.",
      is_primary: true,
    };

    if (primaryContact?.id) {
      const { error } = await supabaseAdmin.from("crm_contacts").update(contactPayload).eq("id", primaryContact.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("crm_contacts").insert(contactPayload);
      if (error) throw error;
    }

    return { id: accountId, plan, created: !existing };
  });
