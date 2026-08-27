import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";
import { normalizeLicenseSelection, type LicenseSelection } from "@/lib/license-selection";

const PRODUCT_CODE = "certivoiq_enterprise";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LicensePricingClass = "standard" | "pha";

type EnterpriseInvoiceInput = {
  organizationId: string;
  crmAccountId?: string;
  organizationName: string;
  billingEmail: string;
  purchaseOrderNumber?: string;
  netDays?: number;
  allowCard?: boolean;
  environment: StripeEnv;
  workflowMode?: "manual" | "automated" | "sandbox_test";
  pricingClass: LicensePricingClass;
  stateCodes: string[];
};

export type EnterpriseInvoiceResult =
  | {
      ok: true;
      invoiceId: string;
      invoiceNumber: string | null;
      hostedInvoiceUrl: string | null;
      billingEmail?: string;
      workflowMode?: string;
      pricingClass: LicensePricingClass;
      annualPriceCents: number;
      stateCodes: string[];
    }
  | { error: string };

function licenseSelection(
  pricingClass: LicensePricingClass,
  stateCodes: string[],
): LicenseSelection {
  return normalizeLicenseSelection({
    licenseKind: pricingClass === "pha" ? "pha" : "multifamily_enterprise",
    stateCodes,
  });
}

function productLabel(pricingClass: LicensePricingClass): string {
  return pricingClass === "pha"
    ? "CertivoIQ PHA Annual License"
    : "CertivoIQ Multifamily Enterprise Annual License";
}

async function requireStaff(context: {
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }>;
  };
  userId: string;
}) {
  const { data: isStaff } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "staff",
  });
  if (!isStaff) throw new Response("Unauthorized", { status: 403 });
}

async function resolvePricingClass(
  supabase: unknown,
  crmAccountId: string,
): Promise<LicensePricingClass> {
  const db = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          single: () => PromiseLike<{
            data: { license_pricing_class?: string } | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
  const { data, error } = await db
    .from("crm_accounts")
    .select("license_pricing_class")
    .eq("id", crmAccountId)
    .single();
  if (error || !data) throw new Error("CRM pricing class could not be resolved");
  return data.license_pricing_class === "pha" ? "pha" : "standard";
}

async function issueEnterpriseInvoice(
  data: EnterpriseInvoiceInput,
): Promise<EnterpriseInvoiceResult> {
  const netDays = data.netDays ?? 30;

  try {
    const selection = licenseSelection(data.pricingClass, data.stateCodes);
    const amountCents = selection.annualAmountUsd * 100;
    const label = productLabel(data.pricingClass);
    const formattedAmount = `$${(amountCents / 100).toLocaleString()}`;
    const stateCodes = selection.stateCodes.join(",");
    const stripe = createStripeClient(data.environment);
    const existing = await stripe.customers.list({ email: data.billingEmail, limit: 1 });
    let customer = existing.data[0];
    if (!customer) {
      customer = await stripe.customers.create({
        name: data.organizationName,
        email: data.billingEmail,
        metadata: {
          organization_id: data.organizationId,
          license_pricing_class: data.pricingClass,
          license_kind: selection.licenseKind,
          licensed_state_codes: stateCodes,
          ...(data.crmAccountId ? { crm_account_id: data.crmAccountId } : {}),
        },
      });
    } else {
      await stripe.customers.update(customer.id, {
        name: data.organizationName,
        metadata: {
          ...customer.metadata,
          organization_id: data.organizationId,
          license_pricing_class: data.pricingClass,
          license_kind: selection.licenseKind,
          licensed_state_codes: stateCodes,
          ...(data.crmAccountId ? { crm_account_id: data.crmAccountId } : {}),
        },
      });
    }

    await stripe.invoiceItems.create({
      customer: customer.id,
      amount: amountCents,
      currency: "usd",
      description: `${label} — all currently available platform features`,
      metadata: {
        billing_model: "enterprise_invoice",
        license_product: PRODUCT_CODE,
        organization_id: data.organizationId,
        license_pricing_class: data.pricingClass,
        license_kind: selection.licenseKind,
        licensed_state_codes: stateCodes,
        state_pack_count: String(selection.stateCodes.length),
        price_lookup_key: selection.priceLookupKey,
        quantity: String(selection.quantity),
        annual_price_cents: String(amountCents),
        workflow_mode: data.workflowMode ?? "manual",
      },
    });

    const metadata = {
      billing_model: "enterprise_invoice",
      license_product: PRODUCT_CODE,
      annual_price_cents: String(amountCents),
      license_pricing_class: data.pricingClass,
      license_kind: selection.licenseKind,
      licensed_state_codes: stateCodes,
      state_pack_count: String(selection.stateCodes.length),
      price_lookup_key: selection.priceLookupKey,
      quantity: String(selection.quantity),
      organization_id: data.organizationId,
      ...(data.crmAccountId ? { crm_account_id: data.crmAccountId } : {}),
      organization_name: data.organizationName,
      billing_email: data.billingEmail,
      payment_method: data.allowCard ? "ach_or_card" : "ach",
      payment_terms: `net_${netDays}`,
      workflow_mode: data.workflowMode ?? "manual",
      ...(data.purchaseOrderNumber ? { purchase_order_number: data.purchaseOrderNumber } : {}),
    };

    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: netDays,
      auto_advance: true,
      description: data.workflowMode === "sandbox_test" ? `TEST — ${label}` : label,
      metadata,
      payment_settings: {
        payment_method_types: data.allowCard ? ["us_bank_account", "card"] : ["us_bank_account"],
      },
    } as Parameters<typeof stripe.invoices.create>[0]);

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    const sent = await stripe.invoices.sendInvoice(finalized.id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("crm_news").insert({
      kind: "billing",
      headline:
        data.workflowMode === "sandbox_test"
          ? `Sandbox test invoice issued — ${data.organizationName}`
          : `Enterprise invoice issued — ${data.organizationName}`,
      detail: `${sent.number ?? sent.id} · ${formattedAmount} · ${
        data.pricingClass === "pha" ? "PHA" : "Standard"
      } · Net ${netDays} · ${data.allowCard ? "ACH/card" : "ACH"} · ${
        data.workflowMode ?? "manual"
      }`,
      source: "CertivoIQ Enterprise Billing",
    });

    return {
      ok: true,
      invoiceId: sent.id,
      invoiceNumber: sent.number ?? null,
      hostedInvoiceUrl: sent.hosted_invoice_url ?? null,
      billingEmail: data.billingEmail,
      workflowMode: data.workflowMode ?? "manual",
      pricingClass: data.pricingClass,
      annualPriceCents: amountCents,
      stateCodes: selection.stateCodes,
    };
  } catch (error) {
    return { error: getStripeErrorMessage(error) };
  }
}

/** Staff-only manual invoice creation. Pricing is still CRM-authoritative. */
export const createEnterpriseLicenseInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Omit<EnterpriseInvoiceInput, "pricingClass">) => {
    if (!UUID_PATTERN.test(data.organizationId)) throw new Error("Invalid organizationId");
    if (data.crmAccountId && !UUID_PATTERN.test(data.crmAccountId))
      throw new Error("Invalid crmAccountId");
    if (!data.organizationName.trim()) throw new Error("Organization name is required");
    if (!/^\S+@\S+\.\S+$/.test(data.billingEmail))
      throw new Error("Valid billing email is required");
    if (!Array.isArray(data.stateCodes) || data.stateCodes.length > 51) {
      throw new Error("Invalid state rule-pack selection");
    }
    const netDays = data.netDays ?? 30;
    if (netDays < 0 || netDays > 120)
      throw new Error("Payment terms must be between Net 0 and Net 120");
    return { ...data, netDays, workflowMode: data.workflowMode ?? "manual" };
  })
  .handler(async ({ data, context }): Promise<EnterpriseInvoiceResult> => {
    await requireStaff(context);
    const crmAccountId = data.crmAccountId ?? data.organizationId;
    const pricingClass = await resolvePricingClass(context.supabase, crmAccountId);
    return issueEnterpriseInvoice({ ...data, pricingClass });
  });

/**
 * Staff-triggered automated workflow. The CRM is authoritative for the
 * organization, pricing class and billing contact; defaults are Net 30 and ACH-only.
 */
export const automateEnterpriseLicenseInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      accountId: string;
      purchaseOrderNumber?: string;
      netDays?: number;
      allowCard?: boolean;
      environment: StripeEnv;
      sandboxTest?: boolean;
      stateCodes: string[];
    }) => {
      if (!UUID_PATTERN.test(data.accountId)) throw new Error("Invalid accountId");
      if (data.sandboxTest && data.environment !== "sandbox") {
        throw new Error("Test invoices may only be created in sandbox");
      }
      if (!Array.isArray(data.stateCodes) || data.stateCodes.length > 51) {
        throw new Error("Invalid state rule-pack selection");
      }
      const netDays = data.netDays ?? 30;
      if (netDays < 0 || netDays > 120)
        throw new Error("Payment terms must be between Net 0 and Net 120");
      return { ...data, netDays };
    },
  )
  .handler(async ({ data, context }): Promise<EnterpriseInvoiceResult> => {
    await requireStaff(context);

    const db = context.supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            single: () => PromiseLike<{
              data: Record<string, unknown> | null;
              error: { message?: string } | null;
            }>;
            order: (
              column: string,
              options: { ascending: boolean },
            ) => PromiseLike<{
              data: Record<string, unknown>[] | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    };

    const { data: accountRaw, error: accountError } = await db
      .from("crm_accounts")
      .select("id,name,license_pricing_class")
      .eq("id", data.accountId)
      .single();
    if (accountError || !accountRaw) return { error: "CRM organization could not be resolved" };

    const account = accountRaw as {
      id: string;
      name: string;
      license_pricing_class?: string;
    };
    const pricingClass: LicensePricingClass =
      account.license_pricing_class === "pha" ? "pha" : "standard";

    const { data: contactsRaw, error: contactError } = await db
      .from("crm_contacts")
      .select("id,name,email,title")
      .eq("account_id", data.accountId)
      .order("created_at", { ascending: true });
    if (contactError) return { error: "CRM billing contacts could not be resolved" };

    const contacts = (contactsRaw ?? []) as Array<{
      id: string;
      name: string;
      email?: string | null;
      title?: string | null;
    }>;
    const withEmail = contacts.filter((contact) => Boolean(contact.email));
    const billingContact =
      withEmail.find((contact) =>
        /billing|finance|account|controller|cfo|procurement/i.test(contact.title ?? ""),
      ) ?? withEmail[0];
    if (!billingContact?.email) {
      return { error: "No verified billing email is available for this CRM organization" };
    }

    return issueEnterpriseInvoice({
      organizationId: account.id,
      crmAccountId: account.id,
      organizationName: account.name,
      billingEmail: billingContact.email,
      purchaseOrderNumber: data.purchaseOrderNumber,
      netDays: data.netDays,
      allowCard: data.allowCard ?? false,
      environment: data.environment,
      workflowMode: data.sandboxTest ? "sandbox_test" : "automated",
      pricingClass,
      stateCodes: data.stateCodes,
    });
  });

