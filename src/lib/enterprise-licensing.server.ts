import type { StripeInvoiceLike } from "@/lib/stripe-webhook-types";
import type { StripeEnv } from "@/lib/stripe.server";
import { normalizeLicenseSelection, type LicenseSelection } from "./license-selection.ts";

type EnterpriseDbRow = Record<string, unknown>;
type EnterpriseDbError = { code?: string; message?: string };
type EnterpriseDbResult = {
  data: EnterpriseDbRow | EnterpriseDbRow[] | null;
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
  if (invoice.amount_due !== expectedInvoiceCents) return "invoice_amount_mismatch";
  if ((invoice.amount_paid ?? 0) <= 0) return "invoice_not_paid";
  if ((invoice.amount_due ?? 0) > 0 && (invoice.amount_paid ?? 0) < (invoice.amount_due ?? 0)) {
    return "partial_payment";
  }
  if (invoice.amount_paid !== expectedInvoiceCents) return "payment_amount_mismatch";
  if (metadata["manual_review_required"] === "true") {
    return metadata["manual_review_reason"] || "manual_review_required";
  }
  return null;
}

async function eventAlreadyRecorded(
  db: EnterpriseLicenseDb,
  event: { id?: string },
): Promise<boolean> {
  if (!event.id) return false;
  const { data, error } = await db
    .from("enterprise_invoice_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (error) throw new Error(`Enterprise event ledger read failed: ${error.message ?? "database error"}`);
  return Boolean(data?.["id"]);
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
    await recordEvent(db, event, invoice, "ignored", "not_enterprise_invoice");
    return { action: "ignored", reason: "not_enterprise_invoice" };
  }
  if (await eventAlreadyRecorded(db, event)) {
    return { action: "ignored", reason: "duplicate_event" };
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
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,product_code" },
      );
    }
    await updateCrm(db, invoice, "exception");
    await recordEvent(db, event, invoice, "exception", exception);
    return { action: "exception", reason: exception };
  }

  const selection = invoiceLicenseSelection(invoice);
  const organizationId = invoiceOrganizationId(invoice)!;
  const now = isoFromUnix(invoice.status_transitions?.paid_at) ?? new Date().toISOString();
  const { data: existing } = await db
    .from("enterprise_licenses")
    .select("id,status,starts_at,expires_at,installments_paid")
    .eq("organization_id", organizationId)
    .eq("product_code", PRODUCT_CODE)
    .maybeSingle();

  const startsAt =
    (existing?.["starts_at"] as string | null | undefined) ??
    isoFromUnix(invoice.period_start) ??
    now;
  const paidThrough = isoFromUnix(invoice.period_end)!;
  const installmentsPaid = Number(existing?.["installments_paid"] ?? 0) + 1;
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
  await recordEvent(
    db,
    event,
    invoice,
    action,
    `${env}:${selection.licenseKind}:${selection.stateCodes.join(",")}:${provisioning}`,
  );
  return { action };
}

export async function applyEnterpriseInvoicePastDue(
  db: EnterpriseLicenseDb,
  invoice: StripeInvoiceLike,
  event: { id?: string; type?: string },
) {
  const metadata = invoiceMetadata(invoice);
  if (metadata["billing_model"] !== "enterprise_invoice_monthly") return;
  if (await eventAlreadyRecorded(db, event)) return;
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


