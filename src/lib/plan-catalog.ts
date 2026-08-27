/** Authoritative billing catalog. Browser input never selects a Stripe price. */
export type LicenseKind = "multifamily_enterprise" | "pha";

export interface PlanEntitlement {
  planId: LicenseKind;
  priceId: string;
  name: string;
  unitLimit: null;
  propertyLimit: null;
  aiDocAllowance: null;
  statePacks: number | null;
}

export const LICENSES: Record<LicenseKind, PlanEntitlement & { annualAmountUsd: number }> = {
  multifamily_enterprise: {
    planId: "multifamily_enterprise",
    priceId: "multifamily_enterprise_annual",
    name: "CertivoIQ Multifamily Enterprise",
    annualAmountUsd: 65_000,
    unitLimit: null,
    propertyLimit: null,
    aiDocAllowance: null,
    statePacks: null,
  },
  pha: {
    planId: "pha",
    priceId: "pha_annual",
    name: "CertivoIQ PHA",
    annualAmountUsd: 150_000,
    unitLimit: null,
    propertyLimit: null,
    aiDocAllowance: null,
    statePacks: 1,
  },
};

export const PLAN_ENTITLEMENTS: Record<string, PlanEntitlement> = Object.fromEntries(
  Object.values(LICENSES).map((license) => [license.priceId, license]),
);
export const PLAN_PRICE_ID_LIST = Object.keys(PLAN_ENTITLEMENTS);
export const ADDON_PRICE_ID_LIST: string[] = [];
/** Inert compatibility keys retained while legacy webhook rows drain. */
export const ADDON_PRICE_IDS = { academySeat: "", academyProperty: "" } as const;

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

export function isAddonPrice(_priceId: string | null | undefined): boolean {
  return false;
}

export function formatLimit(value: number | null): string {
  return value === null ? "Unlimited" : value.toLocaleString();
}

