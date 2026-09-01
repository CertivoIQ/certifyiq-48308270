/** Authoritative billing catalog. Browser input never selects a Stripe price. */
export type LicenseKind = "multifamily_enterprise" | "pha";
export type AddonKind = "merlin";
export type AddonBillingOption =
  | "merlin_annual_agreement_monthly"
  | "merlin_month_to_month";

export interface PlanEntitlement {
  planId: LicenseKind;
  priceId: string;
  annualPriceId: string;
  firstInstallmentPriceId: string;
  name: string;
  unitLimit: null;
  propertyLimit: null;
  aiDocAllowance: null;
  statePacks: number | null;
}

export interface AddonPrice {
  addonId: AddonKind;
  priceId: AddonBillingOption;
  name: string;
  amountUsd: number;
  billingInterval: "month";
  commitmentMonths: 12 | null;
}

export const COMMERCIAL_TERMS = Object.freeze({
  multifamilyAnnualPerStateUsd: 65_000,
  phaAnnualUsd: 150_000,
  merlinMonthlyUsd: 5_000,
  merlinAnnualUsd: 60_000,
  merlinAnnualCommitmentMonths: 12,
  merlinMonthToMonthUsd: 6_000,
});

export const LICENSES: Record<LicenseKind, PlanEntitlement & { annualAmountUsd: number }> = {
  multifamily_enterprise: {
    planId: "multifamily_enterprise",
    priceId: "certivoiq_multifamily_state_monthly",
    annualPriceId: "certivoiq_multifamily_state_annual",
    firstInstallmentPriceId: "certivoiq_multifamily_state_monthly_first",
    name: "CertivoIQ Multifamily Enterprise",
    annualAmountUsd: COMMERCIAL_TERMS.multifamilyAnnualPerStateUsd,
    unitLimit: null,
    propertyLimit: null,
    aiDocAllowance: null,
    statePacks: null,
  },
  pha: {
    planId: "pha",
    priceId: "certivoiq_pha_monthly",
    annualPriceId: "certivoiq_pha_annual",
    firstInstallmentPriceId: "certivoiq_pha_monthly",
    name: "CertivoIQ PHA",
    annualAmountUsd: COMMERCIAL_TERMS.phaAnnualUsd,
    unitLimit: null,
    propertyLimit: null,
    aiDocAllowance: null,
    statePacks: 1,
  },
};

export const ADDONS: Record<AddonBillingOption, AddonPrice> = {
  merlin_annual_agreement_monthly: {
    addonId: "merlin",
    priceId: "merlin_annual_agreement_monthly",
    name: "Merlin — 12-month agreement",
    amountUsd: COMMERCIAL_TERMS.merlinMonthlyUsd,
    billingInterval: "month",
    commitmentMonths: COMMERCIAL_TERMS.merlinAnnualCommitmentMonths,
  },
  merlin_month_to_month: {
    addonId: "merlin",
    priceId: "merlin_month_to_month",
    name: "Merlin — month-to-month",
    amountUsd: COMMERCIAL_TERMS.merlinMonthToMonthUsd,
    billingInterval: "month",
    commitmentMonths: null,
  },
};

export const PLAN_ENTITLEMENTS: Record<string, PlanEntitlement> = Object.fromEntries(
  Object.values(LICENSES).flatMap((license) => [
    [license.priceId, license],
    [license.firstInstallmentPriceId, license],
    [license.annualPriceId, license],
  ]),
);
export const PLAN_PRICE_ID_LIST = Object.keys(PLAN_ENTITLEMENTS);
export const ADDON_PRICE_ID_LIST = Object.keys(ADDONS);
export const ADDON_PRICE_IDS = {
  merlinAnnualAgreementMonthly: ADDONS.merlin_annual_agreement_monthly.priceId,
  merlinMonthToMonth: ADDONS.merlin_month_to_month.priceId,
  /** Inert compatibility keys retained while legacy webhook rows drain. */
  academySeat: "",
  academyProperty: "",
} as const;

/** Files are held for 14 days after paid access ends, then permanently deleted. */
export const FILE_RETENTION_DAYS = 14;
/** FREE review capacity. No card or subscription trial is attached. */
export const FREE_REVIEW_ENTITLEMENT = {
  unitLimit: 0,
  propertyLimit: 0,
  aiDocAllowance: 3,
} as const;

export function entitlementForPrice(priceId: string | null | undefined): PlanEntitlement | null {
  return priceId ? (PLAN_ENTITLEMENTS[priceId] ?? null) : null;
}

export function isPlanPrice(priceId: string | null | undefined): boolean {
  return !!priceId && PLAN_PRICE_ID_LIST.includes(priceId);
}

export function addonForPrice(
  priceId: string | null | undefined,
): AddonPrice | null {
  return priceId && isAddonPrice(priceId)
    ? ADDONS[priceId as AddonBillingOption]
    : null;
}

export function isAddonPrice(priceId: string | null | undefined): boolean {
  return !!priceId && ADDON_PRICE_ID_LIST.includes(priceId);
}

export function formatLimit(value: number | null): string {
  return value === null ? "Unlimited" : value.toLocaleString();
}


