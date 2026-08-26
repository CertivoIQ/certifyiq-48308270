import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

const ANNUAL_LICENSE_CENTS = 6_500_000;
const PRODUCT_CODE = "certivoiq_enterprise";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EnterpriseInvoiceResult =
  | { ok: true; invoiceId: string; invoiceNumber: string | null; hostedInvoiceUrl: string | null }
  | { error: string };

/**
 * Staff-only enterprise invoice creation. This replaces consumer-style
 * checkout for the $65,000 annual organization license.
 */
export const createEnterpriseLicenseInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      crmAccountId?: string;
      organizationName: string;
      billingEmail: string;
      purchaseOrderNumber?: string;
      netDays?: number;
      allowCard?: boolean;
      environment: StripeEnv;
    }) => {
      if (!UUID_PATTERN.test(data.organizationId)) throw new Error("Invalid organizationId");
      if (data.crmAccountId && !UUID_PATTERN.test(data.crmAccountId)) throw new Error("Invalid crmAccountId");
      if (!data.organizationName.trim()) throw new Error("Organization name is required");
      if (!/^\S+@\S+\.\S+$/.test(data.billingEmail)) throw new Error("Valid billing email is required");
      const netDays = data.netDays ?? 30;
      if (netDays < 0 || netDays > 120) throw new Error("Payment terms must be between Net 0 and Net 120");
      return { ...data, netDays };
    },
  )
  .handler(async ({ data, context }): Promise<EnterpriseInvoiceResult> => {
    const { data: isStaff } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "staff",
    });
    if (!isStaff) throw new Response("Unauthorized", { status: 403 });

    try {
      const stripe = createStripeClient(data.environment);
      const existing = await stripe.customers.list({ email: data.billingEmail, limit: 1 });
      let customer = existing.data[0];
      if (!customer) {
        customer = await stripe.customers.create({
          name: data.organizationName,
          email: data.billingEmail,
          metadata: {
            organization_id: data.organizationId,
            ...(data.crmAccountId ? { crm_account_id: data.crmAccountId } : {}),
          },
        });
      } else {
        await stripe.customers.update(customer.id, {
          name: data.organizationName,
          metadata: {
            ...customer.metadata,
            organization_id: data.organizationId,
            ...(data.crmAccountId ? { crm_account_id: data.crmAccountId } : {}),
          },
        });
      }

      await stripe.invoiceItems.create({
        customer: customer.id,
        amount: ANNUAL_LICENSE_CENTS,
        currency: "usd",
        description: "CertivoIQ Annual Organization License — all currently available platform features",
        metadata: {
          billing_model: "enterprise_invoice",
          license_product: PRODUCT_CODE,
          organization_id: data.organizationId,
        },
      });

      const metadata = {
        billing_model: "enterprise_invoice",
        license_product: PRODUCT_CODE,
        annual_price_cents: String(ANNUAL_LICENSE_CENTS),
        organization_id: data.organizationId,
        ...(data.crmAccountId ? { crm_account_id: data.crmAccountId } : {}),
        organization_name: data.organizationName,
        billing_email: data.billingEmail,
        payment_method: data.allowCard ? "ach_or_card" : "ach",
        payment_terms: `net_${data.netDays}`,
        ...(data.purchaseOrderNumber ? { purchase_order_number: data.purchaseOrderNumber } : {}),
      };

      const invoice = await stripe.invoices.create({
        customer: customer.id,
        collection_method: "send_invoice",
        days_until_due: data.netDays,
        auto_advance: true,
        description: "CertivoIQ annual organization license",
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
        headline: `Enterprise invoice issued — ${data.organizationName}`,
        detail: `${sent.number ?? sent.id} · $65,000 · Net ${data.netDays} · ${data.allowCard ? "ACH/card" : "ACH"}`,
        source: "CertivoIQ Enterprise Billing",
      });

      return {
        ok: true,
        invoiceId: sent.id,
        invoiceNumber: sent.number ?? null,
        hostedInvoiceUrl: sent.hosted_invoice_url ?? null,
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
