import type { StripeInvoiceLike } from "@/lib/stripe-webhook-types";
import type { StripeEnv } from "@/lib/stripe.server";

export type EnterpriseLicenseDb = {
  from(table: string): {
    select(columns?: string): any;
    insert(values: Record<string, unknown> | Record<string, unknown>[]): any;
    update(values: Record<string, unknown>): any;
    upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: Record<string, unknown>): any;
  };
};

const ANNUAL_LICENSE_CENTS = 6_500_000;
const PRODUCT_CODE = "certivoiq_enterprise";
const ACTIVE_DAYS = 365;

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function addDays(value: string, days: number): string {
  return new Date(new Date(value).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function invoiceMetadata(invoice: StripeInvoiceLike): Record<string, string> {
  return invoice.metadata ?? {};
}

function invoiceOrganizationId(invoice: StripeInvoiceLike): string | null {
  return invoiceMetadata(invoice)["organization_id"] || null;
}

function invoiceCrmAccountId(invoice: StripeInvoiceLike): string | null {
  return invoiceMetadata(invoice)["crm_account_id"] || null;
}

function activationException(invoice: StripeInvoiceLike): string | null {
  const metadata = invoiceMetadata(invoice);
  if (metadata["license_product"] && metadata["license_product"] !== PRODUCT_CODE) return "wrong_product";
  if (!invoiceOrganizationId(invoice)) return "missing_organization_id";
  if ((invoice.amount_paid ?? 0) <= 0) return "invoice_not_paid";
  if ((invoice.amount_due ?? 0) > 0 && (invoice.amount_paid ?? 0) < (invoice.amount_due ?? 0)) return "partial_payment";
  if (metadata["manual_review_required"] === "true") return metadata["manual_review_reason"] || "manual_review_required";
  return null;
}

async function recordEvent(
  db: EnterpriseLicenseDb,
  event: { id?: string; type?: string },
  invoice: StripeInvoiceLike,
  action: "recorded" | "activated" | "renewed" | "past_due" | "exception" | "ignored",
  detail?: string,
) {
  if (!event.id) return;
  await db.from("enterprise_invoice_events").upsert(
    {
      stripe_event_id: event.id,
      stripe_invoice_id: invoice.id ?? null,
      organization_id: invoiceOrganizationId(invoice),
      event_type: event.type ?? "unknown",
      invoice_status: invoice.status ?? null,
      amount_due_cents: invoice.amount_due ?? null,
      amount_paid_cents: invoice.amount_paid ?? null,
      currency: invoice.currency ?? null,
      action,
      detail: detail ?? null,
    },
    { onConflict: "stripe_event_id", ignoreDuplicates: true },
  );
}

async function updateCrm(
  db: EnterpriseLicenseDb,
  invoice: StripeInvoiceLike,
  state: "active" | "past_due" | "exception",
  startsAt?: string,
  expiresAt?: string,
) {
  const crmAccountId = invoiceCrmAccountId(invoice);
  if (!crmAccountId) return;
  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    last_touch: now,
    updated_at: now,
  };
  if (state === "active") {
    fields.stage = "won";
    fields.plan = "CertivoIQ Annual Platform License";
  }
  await db.from("crm_accounts").update(fields).eq("id", crmAccountId);

  await db.from("crm_news").insert({
    kind: state === "active" ? "subscriber" : "billing",
    headline:
      state === "active"
        ? "Enterprise license activated from paid invoice"
        : state === "past_due"
          ? "Enterprise invoice requires payment attention"
          : "Enterprise invoice routed for human review",
    detail:
      state === "active"
        ? `Annual license active${startsAt ? ` from ${startsAt}` : ""}${expiresAt ? ` through ${expiresAt}` : ""}.`
        : `Invoice ${invoice.number ?? invoice.id ?? "unknown"} requires attention.`,
    source: "CertivoIQ Enterprise Billing",
  });
}

/**
 * Invoice-first enterprise activation.
 * Paid invoices activate or renew organization access automatically.
 * Only objective exceptions are routed for human review.
 */
export async function applyEnterpriseInvoicePaid(
  db: EnterpriseLicenseDb,
  invoice: StripeInvoiceLike,
  env: StripeEnv,
  event: { id?: string; type?: string },
): Promise<{ action: "activated" | "renewed" | "exception" | "ignored"; reason?: string }> {
  const metadata = invoiceMetadata(invoice);
  if (metadata["billing_model"] !== "enterprise_invoice") {
    await recordEvent(db, event, invoice, "ignored", "not_enterprise_invoice");
    return { action: "ignored", reason: "not_enterprise_invoice" };
  }

  const exception = activationException(invoice);
  if (exception) {
    const organizationId = invoiceOrganizationId(invoice);
    if (organizationId) {
      await db.from("enterprise_licenses").upsert(
        {
          organization_id: organizationId,
          crm_account_id: invoiceCrmAccountId(invoice),
          product_code: PRODUCT_CODE,
          status: "pending",
          annual_price_cents: Number(metadata["annual_price_cents"] || ANNUAL_LICENSE_CENTS),
          currency: invoice.currency ?? "usd",
          stripe_customer_id: invoice.customer ?? null,
          stripe_invoice_id: invoice.id ?? null,
          payment_method: metadata["payment_method"] || null,
          payment_terms: metadata["payment_terms"] || null,
          purchase_order_number: metadata["purchase_order_number"] || null,
          exception_reason: exception,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,product_code" },
      );
    }
    await updateCrm(db, invoice, "exception");
    await recordEvent(db, event, invoice, "exception", exception);
    return { action: "exception", reason: exception };
  }

  const organizationId = invoiceOrganizationId(invoice)!;
  const now = isoFromUnix(invoice.status_transitions?.paid_at) ?? new Date().toISOString();
  const { data: existing } = await db
    .from("enterprise_licenses")
    .select("id,status,expires_at")
    .eq("organization_id", organizationId)
    .eq("product_code", PRODUCT_CODE)
    .maybeSingle();

  const priorExpiry = existing?.["expires_at"] as string | null | undefined;
  const stillCurrent = priorExpiry && new Date(priorExpiry).getTime() > new Date(now).getTime();
  const startsAt = stillCurrent ? priorExpiry! : now;
  const expiresAt = addDays(startsAt, ACTIVE_DAYS);
  const action = existing ? "renewed" : "activated";

  await db.from("enterprise_licenses").upsert(
    {
      organization_id: organizationId,
      crm_account_id: invoiceCrmAccountId(invoice),
      product_code: PRODUCT_CODE,
      status: "active",
      annual_price_cents: Number(metadata["annual_price_cents"] || ANNUAL_LICENSE_CENTS),
      currency: invoice.currency ?? "usd",
      starts_at: existing ? (existing["starts_at"] ?? now) : now,
      expires_at: expiresAt,
      renewal_at: expiresAt,
      stripe_customer_id: invoice.customer ?? null,
      stripe_invoice_id: invoice.id ?? null,
      payment_method: metadata["payment_method"] || "invoice",
      payment_terms: metadata["payment_terms"] || null,
      purchase_order_number: metadata["purchase_order_number"] || null,
      all_features: true,
      activated_at: now,
      activated_by: "stripe_invoice_automation",
      exception_reason: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,product_code" },
  );

  await updateCrm(db, invoice, "active", startsAt, expiresAt);
  await recordEvent(db, event, invoice, action, `${env}:${PRODUCT_CODE}`);
  return { action };
}

export async function applyEnterpriseInvoicePastDue(
  db: EnterpriseLicenseDb,
  invoice: StripeInvoiceLike,
  event: { id?: string; type?: string },
) {
  const metadata = invoiceMetadata(invoice);
  if (metadata["billing_model"] !== "enterprise_invoice") return;
  const organizationId = invoiceOrganizationId(invoice);
  if (!organizationId) {
    await recordEvent(db, event, invoice, "exception", "missing_organization_id");
    return;
  }
  await db
    .from("enterprise_licenses")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("product_code", PRODUCT_CODE);
  await updateCrm(db, invoice, "past_due");
  await recordEvent(db, event, invoice, "past_due");
}
