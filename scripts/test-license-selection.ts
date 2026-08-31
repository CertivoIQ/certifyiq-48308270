import { describe, expect, test } from "bun:test";
import { normalizeLicenseSelection } from "../src/lib/license-selection";
import { COMMERCIAL_TERMS, LICENSES } from "../src/lib/plan-catalog";
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

  test("the canonical commercial terms match the approved offer", () => {
    expect(COMMERCIAL_TERMS).toMatchObject({
      multifamilyAnnualPerStateUsd: 65_000,
      phaAnnualUsd: 150_000,
      merlinMonthlyUsd: 5_000,
      merlinAnnualUsd: 60_000,
      merlinAnnualCommitmentMonths: 12,
      merlinMonthToMonthUsd: 6_000,
      merlinMonthlyCertificationCapacity: 50_000,
      merlinOveragePerCertificationUsd: 0.15,
      implementationOneTimeUsd: 15_000,
    });
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
