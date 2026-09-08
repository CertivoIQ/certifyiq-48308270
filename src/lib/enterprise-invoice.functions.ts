import { assertPublicLicenseKind } from "@/lib/internal-segment-access";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";
import { normalizeLicenseSelection, type LicenseSelection } from "@/lib/license-selection";
import { assertNewPaidOnboardingAllowed } from "@/lib/paid-onboarding.server";
import { FOUNDERS_PROMOTION } from "@/lib/founders-promotion";
import { resolveFoundersInvoicePromotion } from "@/lib/founders-promotion.server";

const PRODUCT_CODE = "certivoiq_enterprise";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LicensePricingClass = "standard" | "pha";

type EnterpriseInvoiceInput = {
  organizationId: string;
  crmAccountId?: string;
  organizationName: string;
  billingEmail: string;
  purchaseOrderNumber?: string | undefined;
  promotionCode?: string | undefined;
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
      scheduleId: string;
      subscriptionId: string;
      invoiceId: string;
      invoiceNumber: string | null;
      hostedInvoiceUrl: string | null;
      billingEmail?: string;
      workflowMode?: string;
      pricingClass: LicensePricingClass;
      annualPriceCents: number;
      firstInstallmentCents: number;
      firstInvoiceAmountCents: number;
      monthlyInstallmentCents: number;
      commitmentMonths: 12;
      promotionCode: string | null;
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
    ? "CertivoIQ PHA Annual License — Monthly Invoicing"
    : "CertivoIQ Multifamily Enterprise Annual License — Monthly Invoicing";
}

function normalizePromotionCode(value?: string): string | undefined {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (!normalized) return undefined;
  if (!/^[A-Z0-9_-]{1,64}$/.test(normalized)) {
    throw new Error("Promotion code contains unsupported characters");
  }
  return normalized;
}

function invoiceDiscountAmount(invoice: {
  total_discount_amounts?: Array<{ amount?: number | null }> | null;
}) {
  return (invoice.total_discount_amounts ?? []).reduce(
    (total, discount) => total + Number(discount.amount ?? 0),
    0,
  );
}

async function requireMonthlyPrice(
  stripe: ReturnType<typeof createStripeClient>,
  lookupKey: string,
  expectedUnitAmount: number,
) {
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const price = prices.data[0];
  if (
    !price ||
    price.type !== "recurring" ||
    price.recurring?.interval !== "month" ||
    price.unit_amount !== expectedUnitAmount
  ) {
    throw new Error(`Configured monthly Stripe price is invalid: ${lookupKey}`);
  }
  return price;
}

async function requireStaff(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
}) {
  const { data: isStaff, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "staff",
  });
  if (error || !isStaff) throw new Response("Unauthorized", { status: 403 });
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
  actorUserId: string,
): Promise<EnterpriseInvoiceResult> {
  const netDays = data.netDays ?? 30;

  try {
    assertNewPaidOnboardingAllowed(data.environment, { actorUserId });
    assertPublicLicenseKind(data.pricingClass === "pha" ? "pha" : "multifamily_enterprise");
    const selection = licenseSelection(data.pricingClass, data.stateCodes);
    const amountCents = selection.annualAmountUsd * 100;
    const label = productLabel(data.pricingClass);
    const formattedAmount = `$${(amountCents / 100).toLocaleString()}`;
    const stateCodes = selection.stateCodes.join(",");
    const stripe = createStripeClient(data.environment);
    const foundersPromotion = await resolveFoundersInvoicePromotion(
      stripe,
      data.promotionCode,
    );

    const existing = await stripe.customers.list({ email: data.billingEmail, limit: 1 });
    let customer = existing.data[0];
    const customerMetadata = {
      ...(customer?.metadata ?? {}),
      organization_id: data.organizationId,
      license_pricing_class: data.pricingClass,
      license_kind: selection.licenseKind,
      licensed_state_codes: stateCodes,
      ...(data.crmAccountId ? { crm_account_id: data.crmAccountId } : {}),
    };
    if (!customer) {
      customer = await stripe.customers.create({
        name: data.organizationName,
        email: data.billingEmail,
        metadata: customerMetadata,
      });
    } else {
      customer = await stripe.customers.update(customer.id, {
        name: data.organizationName,
        metadata: customerMetadata,
      });
    }

    const metadata = {
      billing_model: "enterprise_invoice_monthly",
      license_product: PRODUCT_CODE,
      annual_price_cents: String(amountCents),
      first_installment_cents: String(selection.firstInstallmentAmountCents),
      monthly_installment_cents: String(selection.monthlyAmountCents),
      commitment_months: String(selection.commitmentMonths),
      license_pricing_class: data.pricingClass,
      license_kind: selection.licenseKind,
      licensed_state_codes: stateCodes,
      state_pack_count: String(selection.stateCodes.length),
      contract_price_lookup_key: selection.priceLookupKey,
      quantity: String(selection.quantity),
      organization_id: data.organizationId,
      ...(data.crmAccountId ? { crm_account_id: data.crmAccountId } : {}),
      organization_name: data.organizationName,
      billing_email: data.billingEmail,
      payment_method: "invoice_ach_or_bank_transfer",
      payment_terms: `net_${netDays}`,
      workflow_mode: data.workflowMode ?? "manual",
      ...(data.purchaseOrderNumber ? { purchase_order_number: data.purchaseOrderNumber } : {}),
      ...(foundersPromotion
        ? {
            promotion_code: foundersPromotion.code,
            promotion_code_id: foundersPromotion.promotionCodeId,
            promotion_discount_months: String(FOUNDERS_PROMOTION.discountedInstallments),
          }
        : {}),
    };

    if (data.allowCard) throw new Error("Base licenses are invoice-only; card payment is disabled");

    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 100,
    });
    if (
      existingSubscriptions.data.some(
        (subscription) =>
          subscription.metadata?.["organization_id"] === data.organizationId &&
          subscription.metadata?.["license_product"] === PRODUCT_CODE &&
          !["canceled", "incomplete_expired"].includes(subscription.status),
      )
    ) {
      throw new Error("An active or scheduled annual license already exists for this organization");
    }

    const regularPrice = await requireMonthlyPrice(
      stripe,
      selection.priceLookupKey,
      selection.monthlyAmountCents / selection.quantity,
    );
    const firstPrice =
      selection.firstInstallmentPriceLookupKey === selection.priceLookupKey
        ? regularPrice
        : await requireMonthlyPrice(
            stripe,
            selection.firstInstallmentPriceLookupKey,
            selection.firstInstallmentAmountCents / selection.quantity,
          );
    const regularProduct =
      typeof regularPrice.product === "string" ? regularPrice.product : regularPrice.product.id;
    const firstProduct =
      typeof firstPrice.product === "string" ? firstPrice.product : firstPrice.product.id;
    if (regularProduct !== firstProduct) {
      throw new Error("Monthly installment prices must belong to the same base-license product");
    }

    const firstPhaseMetadata = {
      ...metadata,
      invoice_price_lookup_key: selection.firstInstallmentPriceLookupKey,
      installment_phase: "first",
    };
    const regularPhaseMetadata = {
      ...metadata,
      invoice_price_lookup_key: selection.priceLookupKey,
      installment_phase: "regular",
    };
    const initialDiscounts = foundersPromotion
      ? [{ promotion_code: foundersPromotion.promotionCodeId }]
      : undefined;
    const continuationDiscounts = foundersPromotion
      ? [{ coupon: foundersPromotion.couponId }]
      : undefined;

    // Redeem the customer-facing code in phase 1. Multifamily changes prices
    // after month 1, so phase 2 explicitly continues the same approved coupon
    // for the remaining 11 invoices instead of relying on phase inheritance.
    const phases =
      selection.firstInstallmentPriceLookupKey === selection.priceLookupKey
        ? [
            {
              items: [{ price: regularPrice.id, quantity: selection.quantity }],
              duration: { interval: "month" as const, interval_count: 12 },
              metadata: regularPhaseMetadata,
              ...(initialDiscounts ? { discounts: initialDiscounts } : {}),
              description: data.workflowMode === "sandbox_test" ? `TEST — ${label}` : label,
            },
          ]
        : [
            {
              items: [{ price: firstPrice.id, quantity: selection.quantity }],
              duration: { interval: "month" as const, interval_count: 1 },
              metadata: firstPhaseMetadata,
              ...(initialDiscounts ? { discounts: initialDiscounts } : {}),
              description: data.workflowMode === "sandbox_test" ? `TEST — ${label}` : label,
            },
            {
              items: [{ price: regularPrice.id, quantity: selection.quantity }],
              duration: { interval: "month" as const, interval_count: 11 },
              metadata: regularPhaseMetadata,
              ...(continuationDiscounts ? { discounts: continuationDiscounts } : {}),
              description: data.workflowMode === "sandbox_test" ? `TEST — ${label}` : label,
              proration_behavior: "none" as const,
            },
          ];

    const schedule = await stripe.subscriptionSchedules.create({
      customer: customer.id,
      start_date: "now",
      end_behavior: "cancel",
      metadata,
      default_settings: {
        collection_method: "send_invoice",
        invoice_settings: { days_until_due: netDays },
        description: data.workflowMode === "sandbox_test" ? `TEST — ${label}` : label,
      },
      phases,
      expand: ["subscription"],
    } as Parameters<typeof stripe.subscriptionSchedules.create>[0]);
    const subscriptionId =
      typeof schedule.subscription === "string"
        ? schedule.subscription
        : schedule.subscription?.id;
    if (!subscriptionId) throw new Error("Stripe did not create the monthly subscription");

    const runtimeMetadata = {
      ...firstPhaseMetadata,
      stripe_schedule_id: schedule.id,
      stripe_subscription_id: subscriptionId,
    };

    await stripe.subscriptions.update(subscriptionId, {
      metadata: runtimeMetadata,
      payment_settings: {
        payment_method_types: ["us_bank_account", "customer_balance"],
        payment_method_options: {
          customer_balance: {
            funding_type: "bank_transfer",
            bank_transfer: { type: "us_bank_transfer" },
          },
        },
      },
    } as Parameters<typeof stripe.subscriptions.update>[1]);
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });
    const latestInvoice = subscription.latest_invoice;
    const invoice =
      typeof latestInvoice === "string"
        ? await stripe.invoices.retrieve(latestInvoice)
        : latestInvoice;
    if (!invoice) throw new Error("Stripe did not create the first monthly invoice");
    await stripe.invoices.update(invoice.id, { metadata: runtimeMetadata });
    const finalized =
      invoice.status === "draft" ? await stripe.invoices.finalizeInvoice(invoice.id) : invoice;

    if (foundersPromotion && invoiceDiscountAmount(finalized) <= 0) {
      await stripe.subscriptionSchedules.cancel(schedule.id).catch(() => undefined);
      throw new Error("FOUNDERS50 was not applied to the first monthly invoice");
    }

    const sent =
      finalized.status === "open" ? await stripe.invoices.sendInvoice(finalized.id) : finalized;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("crm_news").insert({
      kind: "billing",
      headline:
        data.workflowMode === "sandbox_test"
          ? `Sandbox test invoice issued — ${data.organizationName}`
          : `Enterprise invoice issued — ${data.organizationName}`,
      detail: `${sent.number ?? sent.id} · ${formattedAmount} annual commitment · ${
        data.pricingClass === "pha" ? "PHA" : "Standard"
      } · monthly invoice · Net ${netDays} · ACH/bank transfer · ${
        data.workflowMode ?? "manual"
      }${foundersPromotion ? ` · ${foundersPromotion.code} applied for 12 months` : ""}`,
      source: "CertivoIQ Enterprise Billing",
    });

    return {
      ok: true,
      scheduleId: schedule.id,
      subscriptionId,
      invoiceId: sent.id,
      invoiceNumber: sent.number ?? null,
      hostedInvoiceUrl: sent.hosted_invoice_url ?? null,
      billingEmail: data.billingEmail,
      workflowMode: data.workflowMode ?? "manual",
      pricingClass: data.pricingClass,
      annualPriceCents: amountCents,
      firstInstallmentCents: selection.firstInstallmentAmountCents,
      firstInvoiceAmountCents: sent.amount_due ?? selection.firstInstallmentAmountCents,
      monthlyInstallmentCents: selection.monthlyAmountCents,
      commitmentMonths: selection.commitmentMonths,
      promotionCode: foundersPromotion?.code ?? null,
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
    return {
      ...data,
      netDays,
      promotionCode: normalizePromotionCode(data.promotionCode),
      workflowMode: data.workflowMode ?? "manual",
    };
  })
  .handler(async ({ data, context }): Promise<EnterpriseInvoiceResult> => {
    await requireStaff(context);
    const crmAccountId = data.crmAccountId ?? data.organizationId;
    const pricingClass = await resolvePricingClass(context.supabase, crmAccountId);
    return issueEnterpriseInvoice({ ...data, pricingClass }, context.userId);
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
      purchaseOrderNumber?: string | undefined;
      promotionCode?: string | undefined;
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
      return {
        ...data,
        netDays,
        promotionCode: normalizePromotionCode(data.promotionCode),
      };
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

    return issueEnterpriseInvoice(
      {
        organizationId: account.id,
        crmAccountId: account.id,
        organizationName: account.name,
        billingEmail: billingContact.email,
        purchaseOrderNumber: data.purchaseOrderNumber,
        promotionCode: data.promotionCode,
        netDays: data.netDays,
        allowCard: data.allowCard ?? false,
        environment: data.environment,
        workflowMode: data.sandboxTest ? "sandbox_test" : "automated",
        pricingClass,
        stateCodes: data.stateCodes,
      },
      context.userId,
    );
  });
