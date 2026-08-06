/**
 * Single source of truth linking payment-provider price IDs to what a plan
 * unlocks inside CertifyIQ. Price IDs are stable across test and live.
 */

export type PlanKey = "professional" | "business" | "enterprise";

export interface PlanEntitlement {
  planId: PlanKey;
  priceId: string;
  name: string;
  /** null = unlimited */
  unitLimit: number | null;
  propertyLimit: number | null;
  aiDocAllowance: number | null;
  statePacks: number | null;
}

export const PLAN_PRICE_IDS: Record<PlanKey, string> = {
  professional: "professional_monthly",
  business: "business_monthly",
  enterprise: "enterprise_monthly",
};

export const PLAN_ENTITLEMENTS: Record<string, PlanEntitlement> = {
  professional_monthly: {
    planId: "professional",
    priceId: "professional_monthly",
    name: "CertifyIQ Professional",
    unitLimit: 750,
    propertyLimit: 5,
    aiDocAllowance: 750,
    statePacks: 1,
  },
  business_monthly: {
    planId: "business",
    priceId: "business_monthly",
    name: "CertifyIQ Business",
    unitLimit: 5000,
    propertyLimit: 50,
    aiDocAllowance: 5000,
    statePacks: null,
  },
  enterprise_monthly: {
    planId: "enterprise",
    priceId: "enterprise_monthly",
    name: "CertifyIQ Enterprise",
    unitLimit: null,
    propertyLimit: null,
    aiDocAllowance: null,
    statePacks: null,
  },
};

/** Add-on price IDs that layer on top of a platform plan. */
export const ADDON_PRICE_IDS = {
  academySeat: "academy_seat_monthly",
  academyProperty: "academy_property_monthly",
  aiDocOverage: "ai_document_overage_each",
} as const;

export const ADDON_PRICE_ID_LIST: string[] = Object.values(ADDON_PRICE_IDS);

/** Files are held for 14 days after access ends, then permanently deleted. */
export const FILE_RETENTION_DAYS = 14;

export function entitlementForPrice(priceId: string | null | undefined): PlanEntitlement | null {
  if (!priceId) return null;
  return PLAN_ENTITLEMENTS[priceId] ?? null;
}

export function planKeyToPriceId(plan: string): string | null {
  return PLAN_PRICE_IDS[plan as PlanKey] ?? null;
}

export function formatLimit(value: number | null): string {
  return value === null ? "Unlimited" : value.toLocaleString();
}
