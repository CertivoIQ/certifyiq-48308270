import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LEAD_SOURCE = "3 FREE certification reviews";

export interface FreeReviewLeadInput {
  companyName: string;
  ownerName: string;
  ownerTitle: string;
  email: string;
  phone?: string | undefined;
  units: number;
  properties: number;
  hq: string;
  states: string[];
  programs: string[];
  marketingConsent: boolean;
}

export interface FreeReviewLeadResult {
  id: string;
  plan: string;
  created: boolean;
}

function planForUnits(units: number) {
  if (units <= 500) return "Professional";
  if (units <= 10_000) return "Business";
  return "Enterprise";
}

function cleanList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, 25);
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
    const ownerName = data?.ownerName?.trim();
    const ownerTitle = data?.ownerTitle?.trim();
    const email = data?.email?.trim().toLowerCase();
    const hq = data?.hq?.trim();
    const states = cleanList(data?.states ?? []);
    const programs = cleanList(data?.programs ?? []);
    const units = Number(data?.units);
    const properties = Number(data?.properties);

    if (!companyName) throw new Error("Company name is required.");
    if (!ownerName) throw new Error("Owner / decision-maker name is required.");
    if (!ownerTitle) throw new Error("Owner / decision-maker title is required.");
    if (!email || !isEmail(email)) throw new Error("A valid business email address is required.");
    if (!Number.isInteger(units) || units < 1) throw new Error("Portfolio unit count is required.");
    if (!Number.isInteger(properties) || properties < 1) throw new Error("Portfolio property count is required.");
    if (!hq) throw new Error("Headquarters / primary market is required.");
    if (!states.length) throw new Error("At least one state or market is required.");
    if (!programs.length) throw new Error("At least one housing program is required.");

    return {
      companyName,
      ownerName,
      ownerTitle,
      email,
      phone: data.phone?.trim() || undefined,
      units,
      properties,
      hq,
      states,
      programs,
      marketingConsent: Boolean(data.marketingConsent),
    };
  })
  .handler(async ({ data, context }): Promise<FreeReviewLeadResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const plan = planForUnits(data.units);
    const consentNote = data.marketingConsent ? "yes" : "no";
    const notes = [
      "Warm lead captured before 3 FREE certification reviews.",
      `Marketing email consent: ${consentNote}.`,
      "Plan recommendation is based on reported portfolio units.",
    ].join(" ");

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
      account_type: (data.units > 10_000 ? "enterprise" : "company") as "enterprise" | "company",
      units: data.units,
      properties: data.properties,
      hq: data.hq,
      stage: "trialing" as const,
      plan,
      owner: "Unassigned",
      source: LEAD_SOURCE,
      corporate_email: data.email,
      phone: data.phone ?? null,
      states: data.states,
      programs: data.programs,
      responded: true,
      last_touch: "3 FREE certification reviews requested — lead captured",
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
      name: data.ownerName,
      title: data.ownerTitle,
      email: data.email,
      phone: data.phone ?? null,
      notes: `3 FREE review lead. Marketing email consent: ${consentNote}.`,
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
