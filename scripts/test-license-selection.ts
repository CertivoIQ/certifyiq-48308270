import { describe, expect, test } from "bun:test";
import { normalizeLicenseSelection } from "../src/lib/license-selection";
import {
  ADDONS,
  ADDON_PRICE_ID_LIST,
  ADDON_PRICE_IDS,
  COMMERCIAL_TERMS,
  LICENSES,
  addonForPrice,
  isAddonPrice,
} from "../src/lib/plan-catalog";
import {
  applyEnterpriseTerminalEvent,
  enterpriseInvoiceActivationException,
  type EnterpriseLicenseDb,
} from "../src/lib/enterprise-licensing.server";
import type { StripeInvoiceLike } from "../src/lib/stripe-webhook-types";
import { paidOnboardingBlockReason } from "../src/lib/paid-onboarding.server";

type PaidInvoiceOptions = {
  subtotalCents?: number;
  discountCents?: number;
};

function paidInvoice(
  metadata: Record<string, string>,
  amountCents: number,
  options: PaidInvoiceOptions = {},
): StripeInvoiceLike {
  const subtotalCents = options.subtotalCents ?? amountCents;
  const discountCents = options.discountCents ?? 0;
  return {
    id: "in_test",
    subtotal: subtotalCents,
    total: amountCents,
    total_discount_amounts: discountCents ? [{ amount: discountCents }] : [],
    amount_due: amountCents,
    amount_paid: amountCents,
    collection_method: "send_invoice",
    period_start: 1_788_134_400,
    period_end: 1_790_812_800,
    currency: "usd",
    metadata: {
      billing_model: "enterprise_invoice_monthly",
      license_product: "certivoiq_enterprise",
      organization_id: "00000000-0000-4000-8000-000000000001",
      ...metadata,
    },
  } as StripeInvoiceLike;
}

type FakeRow = Record<string, unknown>;

class FakeEnterpriseQuery implements PromiseLike<{
  data: FakeRow | FakeRow[] | null;
  error: null;
}> {
  private filters: Array<[string, unknown]> = [];
  private operation: "select" | "update" | "insert" = "select";
  private values: FakeRow | FakeRow[] | null = null;

  constructor(private readonly rows: FakeRow[]) {}

  select() {
    this.operation = "select";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  update(values: FakeRow) {
    this.operation = "update";
    this.values = values;
    return this;
  }

  insert(values: FakeRow | FakeRow[]) {
    this.operation = "insert";
    this.values = values;
    return this;
  }

  upsert(values: FakeRow | FakeRow[]) {
    this.operation = "insert";
    this.values = values;
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.execute(true)) as PromiseLike<{
      data: FakeRow | null;
      error: null;
    }>;
  }

  then<TResult1 = { data: FakeRow | FakeRow[] | null; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: FakeRow | FakeRow[] | null;
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute(false)).then(onfulfilled, onrejected);
  }

  private matches(row: FakeRow) {
    return this.filters.every(([column, value]) => row[column] === value);
  }

  private execute(single: boolean) {
    const matches = this.rows.filter((row) => this.matches(row));
    if (this.operation === "update") {
      for (const row of matches) Object.assign(row, this.values);
      return { data: single ? (matches[0] ?? null) : matches, error: null };
    }
    if (this.operation === "insert") {
      const values = Array.isArray(this.values) ? this.values : [this.values ?? {}];
      this.rows.push(...values.map((row) => ({ ...row })));
      return { data: single ? (values[0] ?? null) : values, error: null };
    }
    return { data: single ? (matches[0] ?? null) : matches, error: null };
  }
}

const TERMINAL_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

function terminalDb() {
  const tables: Record<string, FakeRow[]> = {
    enterprise_licenses: [
      {
        id: "license-1",
        organization_id: TERMINAL_ORGANIZATION_ID,
        product_code: "certivoiq_enterprise",
        status: "active",
        stripe_invoice_id: "in_terminal",
        stripe_subscription_id: "sub_terminal",
      },
    ],
    enterprise_license_members: [
      { license_id: "license-1", user_id: "user-1" },
      { license_id: "license-1", user_id: "user-2" },
    ],
    account_access: [
      { user_id: "user-1", status: "active" },
      { user_id: "user-2", status: "active" },
    ],
    enterprise_invoice_events: [
      {
        stripe_event_id: "evt_original_paid",
        stripe_invoice_id: "in_terminal",
        organization_id: TERMINAL_ORGANIZATION_ID,
        event_type: "invoice.paid",
        amount_paid_cents: 1_250_000,
        processing_state: "completed",
        action: "activated",
      },
    ],
    crm_news: [],
  };
  const db = {
    from(table: string) {
      tables[table] ??= [];
      return new FakeEnterpriseQuery(tables[table]);
    },
    async rpc(_name: string, args: Record<string, unknown>) {
      const eventId = String(args.p_stripe_event_id);
      const existing = tables.enterprise_invoice_events.find(
        (row) => row.stripe_event_id === eventId,
      );
      if (existing?.processing_state === "completed") return { data: "duplicate", error: null };
      if (existing?.processing_state === "processing") return { data: "in_progress", error: null };
      if (existing) {
        existing.processing_state = "processing";
        return { data: "claimed", error: null };
      }
      tables.enterprise_invoice_events.push({
        stripe_event_id: eventId,
        stripe_invoice_id: args.p_stripe_invoice_id,
        organization_id: args.p_organization_id,
        event_type: args.p_event_type,
        amount_paid_cents: args.p_amount_paid_cents,
        processing_state: "processing",
        action: "recorded",
      });
      return { data: "claimed", error: null };
    },
  } as unknown as EnterpriseLicenseDb;
  return { db, tables };
}

describe("authoritative license pricing and jurisdiction selection", () => {
  test("the catalog exposes only the two approved annual licenses", () => {
    expect(Object.keys(LICENSES).sort()).toEqual(["multifamily_enterprise", "pha"]);
  });

  test("the catalog exposes both approved Merlin billing options", () => {
    expect(Object.keys(ADDONS).sort()).toEqual([
      "merlin_annual_agreement_monthly",
      "merlin_month_to_month",
    ]);
    expect(ADDONS.merlin_annual_agreement_monthly).toMatchObject({
      addonId: "merlin",
      amountUsd: 5_000,
      billingInterval: "month",
      commitmentMonths: 12,
    });
    expect(ADDONS.merlin_month_to_month).toMatchObject({
      addonId: "merlin",
      amountUsd: 6_000,
      billingInterval: "month",
      commitmentMonths: null,
    });
    expect(ADDON_PRICE_ID_LIST.sort()).toEqual([
      "merlin_annual_agreement_monthly",
      "merlin_month_to_month",
    ]);
    expect(ADDON_PRICE_IDS).toMatchObject({
      merlinAnnualAgreementMonthly: "merlin_annual_agreement_monthly",
      merlinMonthToMonth: "merlin_month_to_month",
    });
    expect(isAddonPrice("merlin_annual_agreement_monthly")).toBe(true);
    expect(isAddonPrice("merlin_month_to_month")).toBe(true);
    expect(isAddonPrice("multifamily_enterprise_annual")).toBe(false);
    expect(addonForPrice("merlin_month_to_month")).toEqual(ADDONS.merlin_month_to_month);
    expect(addonForPrice("unknown")).toBeNull();
  });

  test("the canonical commercial terms match the approved offer", () => {
    expect(COMMERCIAL_TERMS).toMatchObject({
      multifamilyAnnualPerStateUsd: 65_000,
      phaAnnualUsd: 150_000,
      merlinMonthlyUsd: 5_000,
      merlinAnnualUsd: 60_000,
      merlinAnnualCommitmentMonths: 12,
      merlinMonthToMonthUsd: 6_000,
    });
    expect(COMMERCIAL_TERMS).not.toHaveProperty("implementationOneTimeUsd");
    expect(COMMERCIAL_TERMS).not.toHaveProperty("merlinMonthlyCertificationCapacity");
    expect(COMMERCIAL_TERMS).not.toHaveProperty("merlinOveragePerCertificationUsd");
  });

  test("multifamily charges $65,000 for every unique selected state", () => {
    expect(
      normalizeLicenseSelection({
        licenseKind: "multifamily_enterprise",
        stateCodes: ["tn", "MS", "AR"],
      }),
    ).toEqual({
      licenseKind: "multifamily_enterprise",
      stateCodes: ["AR", "MS", "TN"],
      priceLookupKey: "certivoiq_multifamily_state_monthly",
      firstInstallmentPriceLookupKey: "certivoiq_multifamily_state_monthly_first",
      quantity: 3,
      annualAmountUsd: 195000,
      monthlyAmountCents: 1_625_001,
      firstInstallmentAmountCents: 1_624_989,
      commitmentMonths: 12,
    });
  });

  test("PHA remains a flat $150,000 with one operating state", () => {
    expect(normalizeLicenseSelection({ licenseKind: "pha", stateCodes: ["CA"] })).toMatchObject({
      quantity: 1,
      annualAmountUsd: 150000,
      priceLookupKey: "certivoiq_pha_monthly",
      firstInstallmentPriceLookupKey: "certivoiq_pha_monthly",
      monthlyAmountCents: 1_250_000,
      firstInstallmentAmountCents: 1_250_000,
      commitmentMonths: 12,
    });
  });

  test.each([
    { licenseKind: "professional", stateCodes: ["CA"] },
    { licenseKind: "pha", stateCodes: ["CA", "NV"] },
    { licenseKind: "multifamily_enterprise", stateCodes: [] },
    { licenseKind: "multifamily_enterprise", stateCodes: ["CA", "CA"] },
    { licenseKind: "multifamily_enterprise", stateCodes: ["XX"] },
  ])("fails closed for invalid selection %#", (selection) => {
    expect(() => normalizeLicenseSelection(selection)).toThrow();
  });

  test("paid multifamily monthly invoices activate only when amount, cadence, quantity, price, and states agree", () => {
    const metadata = {
      license_kind: "multifamily_enterprise",
      licensed_state_codes: "AR,MS,TN",
      state_pack_count: "3",
      contract_price_lookup_key: "certivoiq_multifamily_state_monthly",
      invoice_price_lookup_key: "certivoiq_multifamily_state_monthly_first",
      quantity: "3",
      annual_price_cents: "19500000",
      first_installment_cents: "1624989",
      monthly_installment_cents: "1625001",
      commitment_months: "12",
    };
    expect(enterpriseInvoiceActivationException(paidInvoice(metadata, 1_624_989))).toBeNull();
    expect(
      enterpriseInvoiceActivationException(paidInvoice({ ...metadata, quantity: "2" }, 1_624_989)),
    ).toBe("license_quantity_mismatch");
    expect(enterpriseInvoiceActivationException(paidInvoice(metadata, 1_625_001))).toBe(
      "invoice_subtotal_mismatch",
    );
    expect(
      enterpriseInvoiceActivationException(
        paidInvoice(
          { ...metadata, invoice_price_lookup_key: "certivoiq_multifamily_state_monthly" },
          1_625_001,
        ),
      ),
    ).toBeNull();
  });

  test("a signed FOUNDERS50 invoice activates at exactly half of the base installment", () => {
    const metadata = {
      license_kind: "multifamily_enterprise",
      licensed_state_codes: "AR,MS,TN",
      state_pack_count: "3",
      contract_price_lookup_key: "certivoiq_multifamily_state_monthly",
      invoice_price_lookup_key: "certivoiq_multifamily_state_monthly_first",
      quantity: "3",
      annual_price_cents: "19500000",
      first_installment_cents: "1624989",
      monthly_installment_cents: "1625001",
      commitment_months: "12",
      promotion_code: "FOUNDERS50",
      promotion_code_id: "promo_founders50",
      promotion_discount_months: "12",
    };
    expect(
      enterpriseInvoiceActivationException(
        paidInvoice(metadata, 812_494, {
          subtotalCents: 1_624_989,
          discountCents: 812_495,
        }),
      ),
    ).toBeNull();
    expect(
      enterpriseInvoiceActivationException(
        paidInvoice(metadata, 1_624_989, { subtotalCents: 1_624_989 }),
      ),
    ).toBe("promotion_discount_missing");
    expect(
      enterpriseInvoiceActivationException(
        paidInvoice(
          { ...metadata, promotion_code: "NOT_APPROVED" },
          812_494,
          { subtotalCents: 1_624_989, discountCents: 812_495 },
        ),
      ),
    ).toBe("unknown_promotion_code");
  });

  test("unidentified invoice discounts fail closed", () => {
    const metadata = {
      license_kind: "pha",
      licensed_state_codes: "CA",
      state_pack_count: "1",
      contract_price_lookup_key: "certivoiq_pha_monthly",
      invoice_price_lookup_key: "certivoiq_pha_monthly",
      quantity: "1",
      annual_price_cents: "15000000",
      first_installment_cents: "1250000",
      monthly_installment_cents: "1250000",
      commitment_months: "12",
    };
    expect(
      enterpriseInvoiceActivationException(
        paidInvoice(metadata, 625_000, {
          subtotalCents: 1_250_000,
          discountCents: 625_000,
        }),
      ),
    ).toBe("unexpected_invoice_discount");
  });

  test("PHA invoices remain flat and require exactly one operating state", () => {
    const metadata = {
      license_kind: "pha",
      licensed_state_codes: "CA",
      state_pack_count: "1",
      contract_price_lookup_key: "certivoiq_pha_monthly",
      invoice_price_lookup_key: "certivoiq_pha_monthly",
      quantity: "1",
      annual_price_cents: "15000000",
      first_installment_cents: "1250000",
      monthly_installment_cents: "1250000",
      commitment_months: "12",
    };
    expect(enterpriseInvoiceActivationException(paidInvoice(metadata, 1_250_000))).toBeNull();
    expect(
      enterpriseInvoiceActivationException(
        paidInvoice({ ...metadata, licensed_state_codes: "CA,NV" }, 1_250_000),
      ),
    ).toBe("invalid_license_state_selection");
  });
});

describe("new paid-onboarding launch control", () => {
  const verifierUserId = "11111111-1111-4111-8111-111111111111";

  test("live creation fails closed when operational GO is absent", () => {
    expect(
      paidOnboardingBlockReason(
        "live",
        {},
        {
          PAID_ONBOARDING_ENABLED: "false",
          PAYMENTS_LIVE_VERIFIED: "true",
        },
      ),
    ).toContain("temporarily disabled");
  });

  test("live creation fails closed when lifecycle verification is absent", () => {
    expect(
      paidOnboardingBlockReason(
        "live",
        {},
        {
          PAID_ONBOARDING_ENABLED: "true",
          PAYMENTS_LIVE_VERIFIED: "false",
        },
      ),
    ).toContain("verification is complete");
  });

  test("general live creation is eligible only when both controls are true", () => {
    expect(
      paidOnboardingBlockReason(
        "live",
        {},
        {
          PAID_ONBOARDING_ENABLED: "true",
          PAYMENTS_LIVE_VERIFIED: "true",
        },
      ),
    ).toBeNull();
  });

  test("verification mode is restricted to the designated authenticated user", () => {
    const config = {
      PAID_ONBOARDING_ENABLED: "false",
      PAYMENTS_LIVE_VERIFIED: "false",
      LIVE_BILLING_VERIFICATION_ENABLED: "true",
      LIVE_BILLING_VERIFIER_USER_ID: verifierUserId,
    };
    expect(paidOnboardingBlockReason("live", { actorUserId: verifierUserId }, config)).toBeNull();
    expect(
      paidOnboardingBlockReason(
        "live",
        { actorUserId: "22222222-2222-4222-8222-222222222222" },
        config,
      ),
    ).toContain("designated verifier");
  });

  test("verification mode fails closed without a valid verifier id", () => {
    expect(
      paidOnboardingBlockReason(
        "live",
        { actorUserId: verifierUserId },
        {
          PAID_ONBOARDING_ENABLED: "false",
          PAYMENTS_LIVE_VERIFIED: "false",
          LIVE_BILLING_VERIFICATION_ENABLED: "true",
          LIVE_BILLING_VERIFIER_USER_ID: "",
        },
      ),
    ).toContain("designated verifier");
  });

  test("sandbox remains available for controlled verification", () => {
    expect(paidOnboardingBlockReason("sandbox", {}, {})).toBeNull();
  });
});

describe("enterprise terminal billing controls", () => {
  test("a full credit-note replay is claimed once and revokes every member entitlement", async () => {
    const { db, tables } = terminalDb();
    const object = {
      id: "cn_test",
      invoice: "in_terminal",
      amount: 1_250_000,
      currency: "usd",
    };
    const event = { id: "evt_credit_once", type: "credit_note.created" };

    const first = await applyEnterpriseTerminalEvent(db, object, event);
    const replay = await applyEnterpriseTerminalEvent(db, object, event);

    expect(first.action).toBe("credited");
    expect(replay).toEqual({ action: "ignored", reason: "duplicate_event" });
    expect(tables.enterprise_licenses[0]).toMatchObject({
      status: "suspended",
      last_billing_event_id: "evt_credit_once",
    });
    expect(tables.account_access.every((row) => row.status === "canceled")).toBe(true);
    expect(tables.account_access.every((row) => Boolean(row.access_until))).toBe(true);
    expect(
      tables.enterprise_invoice_events.find((row) => row.stripe_event_id === "evt_credit_once"),
    ).toMatchObject({
      action: "credited",
      processing_state: "completed",
    });
    expect(tables.crm_news).toHaveLength(1);
  });

  test("a partial credit is logged for review without revoking access", async () => {
    const { db, tables } = terminalDb();
    const result = await applyEnterpriseTerminalEvent(
      db,
      { id: "cn_partial", invoice: "in_terminal", amount: 100_000, currency: "usd" },
      { id: "evt_credit_partial", type: "credit_note.created" },
    );

    expect(result).toEqual({
      action: "ignored",
      reason: "partial_or_unverified_financial_adjustment",
    });
    expect(tables.enterprise_licenses[0]?.status).toBe("active");
    expect(tables.account_access.every((row) => row.status === "active")).toBe(true);
    expect(
      tables.enterprise_invoice_events.find((row) => row.stripe_event_id === "evt_credit_partial"),
    ).toMatchObject({
      action: "exception",
      processing_state: "completed",
    });
    expect(tables.crm_news[0]?.headline).toBe(
      "Enterprise financial adjustment requires review",
    );
  });

  test("a full reversal of a historical invoice still resolves the current organization license", async () => {
    const { db, tables } = terminalDb();
    tables.enterprise_licenses[0]!.stripe_invoice_id = "in_current";

    const result = await applyEnterpriseTerminalEvent(
      db,
      { id: "cn_historical", invoice: "in_terminal", amount: 1_250_000, currency: "usd" },
      { id: "evt_historical_credit", type: "credit_note.created" },
    );

    expect(result.action).toBe("credited");
    expect(tables.enterprise_licenses[0]?.status).toBe("suspended");
    expect(tables.account_access.every((row) => row.status === "canceled")).toBe(true);
  });

  test("subscription deletion cancels the license and its access without deleting audit rows", async () => {
    const { db, tables } = terminalDb();
    const result = await applyEnterpriseTerminalEvent(
      db,
      { id: "sub_terminal", status: "canceled" },
      { id: "evt_subscription_deleted", type: "customer.subscription.deleted" },
    );

    expect(result.action).toBe("cancelled");
    expect(tables.enterprise_licenses).toHaveLength(1);
    expect(tables.enterprise_licenses[0]?.status).toBe("cancelled");
    expect(tables.enterprise_license_members).toHaveLength(2);
    expect(tables.account_access.every((row) => row.status === "canceled")).toBe(true);
  });
});
