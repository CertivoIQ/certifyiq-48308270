import type { StripeInvoiceLike } from "@/lib/stripe-webhook-types";
import type { StripeEnv } from "@/lib/stripe.server";
import { FOUNDERS_PROMOTION } from "@/lib/founders-promotion";
import { FILE_RETENTION_DAYS } from "@/lib/plan-catalog";
import { normalizeLicenseSelection, type LicenseSelection } from "./license-selection.ts";

type EnterpriseDbRow = Record<string, unknown>;
type EnterpriseDbError = { code?: string; message?: string };
type EnterpriseDbResult = {
  data: EnterpriseDbRow | EnterpriseDbRow[] | string | null;
  error: EnterpriseDbError | null;
};

interface EnterpriseDbQuery extends PromiseLike<EnterpriseDbResult> {
  select(columns?: string): EnterpriseDbQuery;
  eq(column: string, value: unknown): EnterpriseDbQuery;
  maybeSingle(): PromiseLike<{
    data: EnterpriseDbRow | null;
    error: EnterpriseDbError | null;
  }>;
}

interface EnterpriseDbTable {
  select(columns?: string): EnterpriseDbQuery;
  insert(values: EnterpriseDbRow | EnterpriseDbRow[]): EnterpriseDbQuery;
  update(values: EnterpriseDbRow): EnterpriseDbQuery;
  upsert(
    values: EnterpriseDbRow | EnterpriseDbRow[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): EnterpriseDbQuery;
}

export type EnterpriseLicenseDb = {
  from(table: string): EnterpriseDbTable;
  rpc(functionName: string, args: Record<string, unknown>): PromiseLike<EnterpriseDbResult>;
};

const PRODUCT_CODE = "certivoiq_enterprise";

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function invoiceMetadata(invoice: StripeInvoiceLike): Record<string, string> {
  return {
    ...(invoice.parent?.subscription_details?.metadata ?? {}),
    ...(invoice.metadata ?? {}),
  };
}

function invoiceOrganizationId(invoice: StripeInvoiceLike): string | null {
  return invoiceMetadata(invoice)["organization_id"] || null;
}

function invoiceCrmAccountId(invoice: StripeInvoiceLike): string | null {
  return invoiceMetadata(invoice)["crm_account_id"] || null;
}

function invoiceSubscriptionId(invoice: StripeInvoiceLike): string | null {
  return invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null;
}

function invoiceAdminEmail(invoice: StripeInvoiceLike): string | null {
  return invoiceMetadata(invoice)["billing_email"] || invoice.customer_email || null;
}

function invoiceLicenseSelection(invoice: StripeInvoiceLike): LicenseSelection {
  const metadata = invoiceMetadata(invoice);
  return normalizeLicenseSelection({
    licenseKind: metadata["license_kind"] ?? "",
    stateCodes: (metadata["licensed_state_codes"] ?? "").split(",").filter(Boolean),
  });
}

function invoiceDiscountAmount(invoice: StripeInvoiceLike): number {
  return (invoice.total_discount_amounts ?? []).reduce(
    (total, discount) => total + Number(discount.amount ?? 0),
    0,
  );
}

export function enterpriseInvoiceActivationException(invoice: StripeInvoiceLike): string | null {
  const metadata = invoiceMetadata(invoice);
  if (metadata["license_product"] && metadata["license_product"] !== PRODUCT_CODE) {
    return "wrong_product";
  }
  if (!invoiceOrganizationId(invoice)) return "missing_organization_id";
  let selection: LicenseSelection;
  try {
    selection = invoiceLicenseSelection(invoice);
  } catch {
    return "invalid_license_state_selection";
  }
  const expectedAnnualCents = selection.annualAmountUsd * 100;
  if (metadata["billing_model"] !== "enterprise_invoice_monthly") {
    return "wrong_billing_model";
  }
  if (metadata["annual_price_cents"] !== String(expectedAnnualCents)) {
    return "license_price_metadata_mismatch";
  }
  if (metadata["contract_price_lookup_key"] !== selection.priceLookupKey) {
    return "license_price_key_mismatch";
  }
  if (metadata["commitment_months"] !== String(selection.commitmentMonths)) {
    return "license_commitment_mismatch";
  }
  if (metadata["first_installment_cents"] !== String(selection.firstInstallmentAmountCents)) {
    return "first_installment_metadata_mismatch";
  }
  if (metadata["monthly_installment_cents"] !== String(selection.monthlyAmountCents)) {
    return "monthly_installment_metadata_mismatch";
  }
  if (metadata["quantity"] !== String(selection.quantity)) {
    return "license_quantity_mismatch";
  }
  if (metadata["state_pack_count"] !== String(selection.stateCodes.length)) {
    return "license_state_count_mismatch";
  }
  const invoicePriceKey = metadata["invoice_price_lookup_key"];
  const expectedInvoiceCents =
    invoicePriceKey === selection.firstInstallmentPriceLookupKey
      ? selection.firstInstallmentAmountCents
      : invoicePriceKey === selection.priceLookupKey
        ? selection.monthlyAmountCents
        : null;
  if (expectedInvoiceCents === null) return "invoice_price_key_mismatch";
  if (invoice.collection_method !== "send_invoice") return "invoice_collection_method_mismatch";
  if (!invoice.period_end) return "missing_billing_period";
  if (invoice.subtotal != null && invoice.subtotal !== expectedInvoiceCents) {
    return "invoice_subtotal_mismatch";
  }

  const discountCents = invoiceDiscountAmount(invoice);
  let expectedPaymentCents = expectedInvoiceCents;
  const promotionCode = metadata["promotion_code"];
  if (promotionCode) {
    if (promotionCode !== FOUNDERS_PROMOTION.code) return "unknown_promotion_code";
    if (!metadata["promotion_code_id"]) return "promotion_identifier_missing";
    if (
      metadata["promotion_discount_months"] !==
      String(FOUNDERS_PROMOTION.discountedInstallments)
    ) {
      return "promotion_duration_mismatch";
    }
    if (discountCents <= 0) return "promotion_discount_missing";
    const exactExpectedDiscount =
      (expectedInvoiceCents * FOUNDERS_PROMOTION.percentOff) / 100;
    const roundingToleranceCents = Math.max(1, selection.quantity);
    if (Math.abs(discountCents - exactExpectedDiscount) > roundingToleranceCents) {
      return "promotion_discount_mismatch";
    }
    expectedPaymentCents = expectedInvoiceCents - discountCents;
  } else if (discountCents > 0) {
    return "unexpected_invoice_discount";
  }

  if (invoice.total != null && invoice.total !== expectedPaymentCents) {
    return "invoice_total_mismatch";
  }
  if (invoice.amount_due !== expectedPaymentCents) return "invoice_amount_mismatch";
  if ((invoice.amount_paid ?? 0) <= 0) return "invoice_not_paid";
  if ((invoice.amount_due ?? 0) > 0 && (invoice.amount_paid ?? 0) < (invoice.amount_due ?? 0)) {
    return "partial_payment";
  }
  if (invoice.amount_paid !== expectedPaymentCents) return "payment_amount_mismatch";
  if (metadata["manual_review_required"] === "true") {
    return metadata["manual_review_reason"] || "manual_review_required";
  }
  return null;
}

type EnterpriseEventAction =
  | "recorded"
  | "activated"
  | "renewed"
  | "past_due"
  | "exception"
  | "ignored"
  | "cancelled"
  | "credited"
  | "refunded"
  | "revoked";

async function claimEvent(
  db: EnterpriseLicenseDb,
  event: { id?: string; type?: string },
  invoice: StripeInvoiceLike,
): Promise<"claimed" | "duplicate" | "in_progress"> {
  if (!event.id) throw new Error("Enterprise webhook event is missing its Stripe event id");
  const { data, error } = await db.rpc("claim_enterprise_billing_event", {
    p_stripe_event_id: event.id,
    p_stripe_invoice_id: invoice.id ?? null,
    p_organization_id: invoiceOrganizationId(invoice),
    p_event_type: event.type ?? "unknown",
    p_invoice_status: invoice.status ?? null,
    p_amount_due_cents: invoice.amount_due ?? null,
    p_amount_paid_cents: invoice.amount_paid ?? null,
    p_currency: invoice.currency ?? null,
  });
  if (error) {
    throw new Error(`Enterprise event claim failed: ${error.message ?? "database error"}`);
  }
  const result = String(data ?? "");
  if (result === "claimed" || result === "duplicate" || result === "in_progress") {
    return result;
  }
  throw new Error(`Enterprise event claim returned an invalid state: ${result || "empty"}`);
}

async function completeEvent(
  db: EnterpriseLicenseDb,
  event: { id?: string },
  action: EnterpriseEventAction,
  detail?: string,
) {
  if (!event.id) return;
  const { error } = await db
    .from("enterprise_invoice_events")
    .update({
      action,
      detail: detail ?? null,
      processing_state: "completed",
      processed_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", event.id);
  if (error) {
    throw new Error(`Enterprise event completion failed: ${error.message ?? "database error"}`);
  }
}

async function failEvent(db: EnterpriseLicenseDb, event: { id?: string }, error: unknown) {
  if (!event.id) return;
  const detail = error instanceof Error ? error.message : "Unknown enterprise webhook failure";
  const { error: writeError } = await db
    .from("enterprise_invoice_events")
    .update({
      processing_state: "failed",
      last_error: detail.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", event.id);
  if (writeError) {
    console.error("Enterprise event failure state could not be recorded", event.id, writeError);
  }
}

async function previouslyAppliedEvent(
  db: EnterpriseLicenseDb,
  organizationId: string,
  eventId: string | undefined,
): Promise<boolean> {
  if (!eventId) return false;
  const { data, error } = await db
    .from("enterprise_licenses")
    .select("last_billing_event_id")
    .eq("organization_id", organizationId)
    .eq("product_code", PRODUCT_CODE)
    .maybeSingle();
  if (error) {
    throw new Error(`Enterprise license replay check failed: ${error.message ?? "database error"}`);
  }
  return data?.["last_billing_event_id"] === eventId;
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
    fields.plan =
      invoiceMetadata(invoice)["license_kind"] === "pha"
        ? "CertivoIQ PHA Annual License"
        : "CertivoIQ Multifamily Enterprise Annual License";
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

async function noteProvisioningIssue(
  db: EnterpriseLicenseDb,
  invoice: StripeInvoiceLike,
  detail: string,
) {
  await db.from("crm_news").insert({
    kind: "billing",
    headline: "Enterprise admin provisioning requires attention",
    detail: `Invoice ${invoice.number ?? invoice.id ?? "unknown"}: ${detail}`,
    source: "CertivoIQ Enterprise Billing",
  });
}

async function provisionEnterpriseAdmin(
  db: EnterpriseLicenseDb,
  invoice: StripeInvoiceLike,
  env: StripeEnv,
  organizationId: string,
  expiresAt: string,
  selection: LicenseSelection,
): Promise<string> {
  const email = invoiceAdminEmail(invoice);
  if (!email) {
    await noteProvisioningIssue(db, invoice, "No billing/admin email was recorded.");
    return "admin_email_missing";
  }

  try {
    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let userId = profile?.["id"] as string | undefined;
    let invited = false;

    if (!userId && env === "live") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          organization_id: organizationId,
          certivoiq_enterprise_admin: true,
        },
      });
      if (error) {
        await noteProvisioningIssue(db, invoice, `Admin invitation failed: ${error.message}`);
        return "admin_invite_failed";
      }
      userId = data.user?.id;
      invited = Boolean(userId);
    }

    if (!userId) {
      if (env === "sandbox") return "sandbox_invite_suppressed";
      await noteProvisioningIssue(
        db,
        invoice,
        "Admin user could not be resolved after invitation.",
      );
      return "admin_user_unresolved";
    }

    const { data: license, error: licenseReadError } = await db
      .from("enterprise_licenses")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("product_code", PRODUCT_CODE)
      .maybeSingle();
    if (licenseReadError || !license?.["id"]) {
      await noteProvisioningIssue(
        db,
        invoice,
        "Active organization license could not be resolved.",
      );
      return "license_membership_unresolved";
    }

    const licenseId = String(license["id"]);
    const now = new Date().toISOString();

    const { error: memberError } = await db.from("enterprise_license_members").upsert(
      {
        license_id: licenseId,
        user_id: userId,
        role: "admin",
      },
      { onConflict: "license_id,user_id" },
    );
    if (memberError) {
      await noteProvisioningIssue(
        db,
        invoice,
        `Admin membership failed: ${memberError.message ?? "database error"}`,
      );
      return "admin_membership_failed";
    }

    const { error: accessError } = await db.from("account_access").upsert(
      {
        user_id: userId,
        environment: env,
        status: "active",
        plan_id: selection.licenseKind,
        price_id: selection.priceLookupKey,
        license_kind: selection.licenseKind,
        licensed_state_codes: selection.stateCodes,
        unit_limit: null,
        property_limit: null,
        ai_doc_allowance: null,
        access_until: expiresAt,
        files_purge_at: null,
        files_purged_at: null,
        subscribed_at: now,
        demo_data_cleared_at: now,
        welcome_sent_at: now,
        launchpad_started_at: now,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );
    if (accessError) {
      await noteProvisioningIssue(
        db,
        invoice,
        `Admin entitlement failed: ${accessError.message ?? "database error"}`,
      );
      return "admin_entitlement_failed";
    }

    await db.from("crm_news").insert({
      kind: "subscriber",
      headline: invited
        ? "Enterprise administrator invited"
        : "Enterprise administrator provisioned",
      detail: `${email} is attached as an administrator for the active organization license.`,
      source: "CertivoIQ Enterprise Billing",
    });

    return invited ? "admin_invited" : "existing_admin_provisioned";
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown provisioning error";
    await noteProvisioningIssue(db, invoice, detail);
    return "admin_provisioning_failed";
  }
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
  if (metadata["billing_model"] !== "enterprise_invoice_monthly") {
    const claim = await claimEvent(db, event, invoice);
    if (claim === "claimed") {
      await completeEvent(db, event, "ignored", "not_enterprise_invoice");
    }
    return { action: "ignored", reason: "not_enterprise_invoice" };
  }
  const claim = await claimEvent(db, event, invoice);
  if (claim !== "claimed") {
    return { action: "ignored", reason: "duplicate_event" };
  }

  try {
    const claimedOrganizationId = invoiceOrganizationId(invoice);
    if (
      claimedOrganizationId &&
      (await previouslyAppliedEvent(db, claimedOrganizationId, event.id))
    ) {
      await completeEvent(db, event, "ignored", "business_write_already_applied");
      return { action: "ignored", reason: "business_write_already_applied" };
    }
    const exception = enterpriseInvoiceActivationException(invoice);
    if (exception) {
      const organizationId = invoiceOrganizationId(invoice);
      if (organizationId) {
        await db.from("enterprise_licenses").upsert(
          {
            organization_id: organizationId,
            crm_account_id: invoiceCrmAccountId(invoice),
            product_code: PRODUCT_CODE,
            status: "pending",
            annual_price_cents: Number(metadata["annual_price_cents"] || 0),
            currency: invoice.currency ?? "usd",
            stripe_customer_id: invoice.customer ?? null,
            stripe_invoice_id: invoice.id ?? null,
            stripe_subscription_id: invoiceSubscriptionId(invoice),
            stripe_schedule_id: metadata["stripe_schedule_id"] || null,
            billing_interval: "month",
            commitment_months: 12,
            payment_method: metadata["payment_method"] || null,
            payment_terms: metadata["payment_terms"] || null,
            purchase_order_number: metadata["purchase_order_number"] || null,
            exception_reason: exception,
            last_billing_event_id: event.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,product_code" },
        );
      }
      await updateCrm(db, invoice, "exception");
      await completeEvent(db, event, "exception", exception);
      return { action: "exception", reason: exception };
    }

    const selection = invoiceLicenseSelection(invoice);
    const organizationId = invoiceOrganizationId(invoice)!;
    const now = isoFromUnix(invoice.status_transitions?.paid_at) ?? new Date().toISOString();
    const { data: existing } = await db
      .from("enterprise_licenses")
      .select("id,status,starts_at,expires_at,installments_paid,last_billing_event_id")
      .eq("organization_id", organizationId)
      .eq("product_code", PRODUCT_CODE)
      .maybeSingle();

    const startsAt =
      (existing?.["starts_at"] as string | null | undefined) ??
      isoFromUnix(invoice.period_start) ??
      now;
    const paidThrough = isoFromUnix(invoice.period_end)!;
    const installmentsPaid = Math.min(Number(existing?.["installments_paid"] ?? 0) + 1, 12);
    const action: "activated" | "renewed" =
      existing?.["status"] === "active" ? "renewed" : "activated";

    const { error: licenseWriteError } = await db.from("enterprise_licenses").upsert(
      {
        organization_id: organizationId,
        crm_account_id: invoiceCrmAccountId(invoice),
        product_code: PRODUCT_CODE,
        license_kind: selection.licenseKind,
        licensed_state_codes: selection.stateCodes,
        status: "active",
        annual_price_cents: selection.annualAmountUsd * 100,
        currency: invoice.currency ?? "usd",
        starts_at: startsAt,
        expires_at: paidThrough,
        paid_through: paidThrough,
        renewal_at: paidThrough,
        billing_interval: "month",
        commitment_months: selection.commitmentMonths,
        installments_paid: installmentsPaid,
        stripe_customer_id: invoice.customer ?? null,
        stripe_invoice_id: invoice.id ?? null,
        stripe_subscription_id: invoiceSubscriptionId(invoice),
        stripe_schedule_id: metadata["stripe_schedule_id"] || null,
        payment_method: metadata["payment_method"] || "invoice",
        payment_terms: metadata["payment_terms"] || null,
        purchase_order_number: metadata["purchase_order_number"] || null,
        all_features: true,
        activated_at: now,
        activated_by: "stripe_invoice_automation",
        exception_reason: null,
        last_billing_event_id: event.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,product_code" },
    );
    if (licenseWriteError) {
      throw new Error(
        `Enterprise license activation failed: ${licenseWriteError.message ?? "database error"}`,
      );
    }

    await updateCrm(db, invoice, "active", startsAt, paidThrough);
    const provisioning = await provisionEnterpriseAdmin(
      db,
      invoice,
      env,
      organizationId,
      paidThrough,
      selection,
    );
    await completeEvent(
      db,
      event,
      action,
      `${env}:${selection.licenseKind}:${selection.stateCodes.join(",")}:${provisioning}`,
    );
    return { action };
  } catch (error) {
    await failEvent(db, event, error);
    throw error;
  }
}

export async function applyEnterpriseInvoicePastDue(
  db: EnterpriseLicenseDb,
  invoice: StripeInvoiceLike,
  event: { id?: string; type?: string },
) {
  const metadata = invoiceMetadata(invoice);
  if (metadata["billing_model"] !== "enterprise_invoice_monthly") return;
  const claim = await claimEvent(db, event, invoice);
  if (claim !== "claimed") return;
  try {
    const organizationId = invoiceOrganizationId(invoice);
    if (!organizationId) {
      await completeEvent(db, event, "exception", "missing_organization_id");
      return;
    }
    if (await previouslyAppliedEvent(db, organizationId, event.id)) {
      await completeEvent(db, event, "ignored", "business_write_already_applied");
      return;
    }
    const { error } = await db
      .from("enterprise_licenses")
      .update({
        status: "past_due",
        exception_reason: "invoice_payment_failed",
        last_billing_event_id: event.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("product_code", PRODUCT_CODE);
    if (error) {
      throw new Error(`Enterprise past-due write failed: ${error.message ?? "database error"}`);
    }
    await updateCrm(db, invoice, "past_due");
    await completeEvent(db, event, "past_due");
  } catch (error) {
    await failEvent(db, event, error);
    throw error;
  }
}

export interface EnterpriseTerminalBillingObject {
  id?: string;
  invoice?: string | { id?: string | null } | null;
  subscription?: string | { id?: string | null } | null;
  customer?: string | null;
  status?: string | null;
  currency?: string | null;
  amount?: number | null;
  amount_refunded?: number | null;
  metadata?: Record<string, string> | null;
}

function objectId(value: string | { id?: string | null } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

async function licenseByOrganizationId(
  db: EnterpriseLicenseDb,
  organizationId: string,
): Promise<EnterpriseDbRow | null> {
  const { data, error } = await db
    .from("enterprise_licenses")
    .select(
      "id,organization_id,status,expires_at,stripe_invoice_id,stripe_subscription_id,last_billing_event_id",
    )
    .eq("organization_id", organizationId)
    .eq("product_code", PRODUCT_CODE)
    .maybeSingle();
  if (error) {
    throw new Error(`Enterprise terminal lookup failed: ${error.message ?? "database error"}`);
  }
  return data;
}

async function organizationIdForPaidInvoice(
  db: EnterpriseLicenseDb,
  invoiceId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("enterprise_invoice_events")
    .select("organization_id")
    .eq("stripe_invoice_id", invoiceId)
    .eq("event_type", "invoice.paid")
    .maybeSingle();
  if (error) {
    throw new Error(
      `Enterprise paid-invoice lookup failed: ${error.message ?? "database error"}`,
    );
  }
  return data?.["organization_id"] ? String(data["organization_id"]) : null;
}

async function resolveTerminalLicense(
  db: EnterpriseLicenseDb,
  object: EnterpriseTerminalBillingObject,
): Promise<EnterpriseDbRow | null> {
  const organizationId = object.metadata?.["organization_id"];
  if (organizationId) {
    const license = await licenseByOrganizationId(db, organizationId);
    if (license) return license;
  }

  const invoiceId = objectId(object.invoice);
  if (invoiceId) {
    const { data, error } = await db
      .from("enterprise_licenses")
      .select(
        "id,organization_id,status,expires_at,stripe_invoice_id,stripe_subscription_id,last_billing_event_id",
      )
      .eq("stripe_invoice_id", invoiceId)
      .maybeSingle();
    if (error)
      throw new Error(
        `Enterprise invoice reversal lookup failed: ${error.message ?? "database error"}`,
      );
    if (data) return data;

    const historicalOrganizationId = await organizationIdForPaidInvoice(db, invoiceId);
    if (historicalOrganizationId) {
      const historicalLicense = await licenseByOrganizationId(db, historicalOrganizationId);
      if (historicalLicense) return historicalLicense;
    }
  }

  const subscriptionId = objectId(object.subscription) ?? object.id ?? null;
  if (subscriptionId) {
    const { data, error } = await db
      .from("enterprise_licenses")
      .select(
        "id,organization_id,status,expires_at,stripe_invoice_id,stripe_subscription_id,last_billing_event_id",
      )
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (error)
      throw new Error(
        `Enterprise subscription terminal lookup failed: ${error.message ?? "database error"}`,
      );
    if (data) return data;
  }
  return null;
}

async function settledInvoiceAmount(
  db: EnterpriseLicenseDb,
  invoiceId: string | null,
): Promise<number | null> {
  if (!invoiceId) return null;
  const { data, error } = await db
    .from("enterprise_invoice_events")
    .select("amount_paid_cents")
    .eq("stripe_invoice_id", invoiceId)
    .eq("event_type", "invoice.paid")
    .maybeSingle();
  if (error) {
    throw new Error(
      `Enterprise paid amount lookup failed: ${error.message ?? "database error"}`,
    );
  }
  const amount = Number(data?.["amount_paid_cents"] ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function reversalAmount(
  object: EnterpriseTerminalBillingObject,
  eventType: string,
): number | null {
  const candidate = eventType === "charge.refunded" ? object.amount_refunded : object.amount;
  const amount = Number(candidate ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

async function noteFinancialAdjustmentReview(
  db: EnterpriseLicenseDb,
  organizationId: string,
  invoiceId: string | null,
  eventType: string,
  reversedAmount: number | null,
  settledAmount: number | null,
) {
  await db.from("crm_news").insert({
    kind: "billing",
    headline: "Enterprise financial adjustment requires review",
    detail: `Organization ${organizationId}; invoice ${invoiceId ?? "unknown"}; ${eventType}; reversed ${
      reversedAmount ?? "unknown"
    } cents of ${settledAmount ?? "unknown"} settled cents. Access was not revoked.`,
    source: "CertivoIQ Enterprise Billing",
  });
}

export async function applyEnterpriseTerminalEvent(
  db: EnterpriseLicenseDb,
  object: EnterpriseTerminalBillingObject,
  event: { id?: string; type?: string },
): Promise<{ action: "cancelled" | "credited" | "refunded" | "ignored"; reason?: string }> {
  const license = await resolveTerminalLicense(db, object);
  if (!license) return { action: "ignored", reason: "not_enterprise_license" };

  const eventType = event.type ?? "unknown";
  const action: "cancelled" | "credited" | "refunded" = eventType.startsWith("credit_note.")
    ? "credited"
    : eventType === "charge.refunded"
      ? "refunded"
      : "cancelled";
  const organizationId = String(license["organization_id"]);
  const invoiceId =
    objectId(object.invoice) ?? (license["stripe_invoice_id"] as string | null) ?? null;
  const envelope: StripeInvoiceLike = {
    ...(invoiceId ? { id: invoiceId } : {}),
    status: object.status ?? null,
    customer: object.customer ?? null,
    currency: object.currency ?? null,
    amount_paid: object.amount_refunded ?? object.amount ?? null,
    metadata: { ...(object.metadata ?? {}), organization_id: organizationId },
  };
  const claim = await claimEvent(db, event, envelope);
  if (claim !== "claimed") return { action: "ignored", reason: "duplicate_event" };
  if (license["last_billing_event_id"] === event.id) {
    await completeEvent(db, event, "ignored", "business_write_already_applied");
    return { action: "ignored", reason: "business_write_already_applied" };
  }

  try {
    if (action === "credited" || action === "refunded") {
      const settledAmount = await settledInvoiceAmount(db, invoiceId);
      const reversedAmount = reversalAmount(object, eventType);
      if (!settledAmount || !reversedAmount || reversedAmount < settledAmount) {
        await noteFinancialAdjustmentReview(
          db,
          organizationId,
          invoiceId,
          eventType,
          reversedAmount,
          settledAmount,
        );
        await completeEvent(
          db,
          event,
          "exception",
          `partial_or_unverified_financial_adjustment:${reversedAmount ?? "unknown"}/${
            settledAmount ?? "unknown"
          }`,
        );
        return {
          action: "ignored",
          reason: "partial_or_unverified_financial_adjustment",
        };
      }
    }

    const now = new Date().toISOString();
    const purgeAt = new Date(Date.now() + FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const licenseStatus = action === "cancelled" ? "cancelled" : "suspended";
    const { error: licenseError } = await db
      .from("enterprise_licenses")
      .update({
        status: licenseStatus,
        expires_at: now,
        renewal_at: null,
        exception_reason: `${action}:${eventType}`,
        updated_at: now,
      })
      .eq("id", license["id"]);
    if (licenseError) {
      throw new Error(
        `Enterprise entitlement revocation failed: ${licenseError.message ?? "database error"}`,
      );
    }

    const { data: memberData, error: memberError } = await db
      .from("enterprise_license_members")
      .select("user_id")
      .eq("license_id", license["id"]);
    if (memberError) {
      throw new Error(
        `Enterprise member lookup failed: ${memberError.message ?? "database error"}`,
      );
    }
    const members = Array.isArray(memberData) ? memberData : [];
    for (const member of members) {
      const { error: accessError } = await db
        .from("account_access")
        .update({
          status: "canceled",
          access_until: now,
          files_purge_at: purgeAt,
          updated_at: now,
        })
        .eq("user_id", member["user_id"]);
      if (accessError) {
        throw new Error(
          `Enterprise member revocation failed: ${accessError.message ?? "database error"}`,
        );
      }
    }

    await db.from("crm_news").insert({
      kind: "billing",
      headline:
        action === "cancelled" ? "Enterprise license cancelled" : "Enterprise payment reversed",
      detail: `Organization ${organizationId} access was revoked from ${eventType}.`,
      source: "CertivoIQ Enterprise Billing",
    });
    const { error: markerError } = await db
      .from("enterprise_licenses")
      .update({ last_billing_event_id: event.id ?? null, updated_at: now })
      .eq("id", license["id"]);
    if (markerError) {
      throw new Error(
        `Enterprise terminal replay marker failed: ${markerError.message ?? "database error"}`,
      );
    }
    await completeEvent(
      db,
      event,
      action,
      `organization:${organizationId}:members:${members.length}`,
    );
    return { action };
  } catch (error) {
    await failEvent(db, event, error);
    throw error;
  }
}
