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
import { enterpriseInvoiceActivationException } from "../src/lib/enterprise-licensing.server";
import type { StripeInvoiceLike } from "../src/lib/stripe-webhook-types";
import { paidOnboardingBlockReason } from "../src/lib/paid-onboarding.server";

function paidInvoice(metadata: Record<string, string>, amountCents: number): StripeInvoiceLike {
  return {
    id: "in_test",
    amount_due: amountCents,
    amount_paid: amountCents,
    currency: "usd",
    metadata: {
      billing_model: "enterprise_invoice",
      license_product: "certivoiq_enterprise",
      organization_id: "00000000-0000-4000-8000-000000000001",
      ...metadata,
    },
  } as StripeInvoiceLike;
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
    expect(addonForPrice("merlin_month_to_month")).toEqual(
      ADDONS.merlin_month_to_month,
    );
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
      priceLookupKey: "multifamily_enterprise_annual",
      quantity: 3,
      annualAmountUsd: 195000,
    });
  });

  test("PHA remains a flat $150,000 with one operating state", () => {
    expect(normalizeLicenseSelection({ licenseKind: "pha", stateCodes: ["CA"] })).toMatchObject({
      quantity: 1,
      annualAmountUsd: 150000,
      priceLookupKey: "pha_annual",
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

  test("paid multifamily invoices activate only when amount, quantity, price, and states agree", () => {
    const metadata = {
      license_kind: "multifamily_enterprise",
      licensed_state_codes: "AR,MS,TN",
      state_pack_count: "3",
      price_lookup_key: "multifamily_enterprise_annual",
      quantity: "3",
      annual_price_cents: "19500000",
    };
    expect(enterpriseInvoiceActivationException(paidInvoice(metadata, 19_500_000))).toBeNull();
    expect(
      enterpriseInvoiceActivationException(paidInvoice({ ...metadata, quantity: "2" }, 19_500_000)),
    ).toBe("license_quantity_mismatch");
    expect(enterpriseInvoiceActivationException(paidInvoice(metadata, 13_000_000))).toBe(
      "invoice_amount_mismatch",
    );
  });

  test("PHA invoices remain flat and require exactly one operating state", () => {
    const metadata = {
      license_kind: "pha",
      licensed_state_codes: "CA",
      state_pack_count: "1",
      price_lookup_key: "pha_annual",
      quantity: "1",
      annual_price_cents: "15000000",
    };
    expect(enterpriseInvoiceActivationException(paidInvoice(metadata, 15_000_000))).toBeNull();
    expect(
      enterpriseInvoiceActivationException(
        paidInvoice({ ...metadata, licensed_state_codes: "CA,NV" }, 15_000_000),
      ),
    ).toBe("invalid_license_state_selection");
  });
});


describe("new paid-onboarding launch control", () => {
  const verifierUserId = "11111111-1111-4111-8111-111111111111";

  test("live creation fails closed when operational GO is absent", () => {
    expect(
      paidOnboardingBlockReason("live", {}, {
        PAID_ONBOARDING_ENABLED: "false",
        PAYMENTS_LIVE_VERIFIED: "true",
      }),
    ).toContain("temporarily disabled");
  });

  test("live creation fails closed when lifecycle verification is absent", () => {
    expect(
      paidOnboardingBlockReason("live", {}, {
        PAID_ONBOARDING_ENABLED: "true",
        PAYMENTS_LIVE_VERIFIED: "false",
      }),
    ).toContain("verification is complete");
  });

  test("general live creation is eligible only when both controls are true", () => {
    expect(
      paidOnboardingBlockReason("live", {}, {
        PAID_ONBOARDING_ENABLED: "true",
        PAYMENTS_LIVE_VERIFIED: "true",
      }),
    ).toBeNull();
  });

  test("verification mode is restricted to the designated authenticated user", () => {
    const config = {
      PAID_ONBOARDING_ENABLED: "false",
      PAYMENTS_LIVE_VERIFIED: "false",
      LIVE_BILLING_VERIFICATION_ENABLED: "true",
      LIVE_BILLING_VERIFIER_USER_ID: verifierUserId,
    };
    expect(
      paidOnboardingBlockReason("live", { actorUserId: verifierUserId }, config),
    ).toBeNull();
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
      paidOnboardingBlockReason("live", { actorUserId: verifierUserId }, {
        PAID_ONBOARDING_ENABLED: "false",
        PAYMENTS_LIVE_VERIFIED: "false",
        LIVE_BILLING_VERIFICATION_ENABLED: "true",
        LIVE_BILLING_VERIFIER_USER_ID: "",
      }),
    ).toContain("designated verifier");
  });

  test("sandbox remains available for controlled verification", () => {
    expect(paidOnboardingBlockReason("sandbox", {}, {})).toBeNull();
  });
});
