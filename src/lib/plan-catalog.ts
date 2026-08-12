/**
 * Single source of truth linking payment-provider price IDs to what a plan
 * unlocks inside CertivoIQ. Price IDs are stable across test and live.
 */

export type PlanKey = "professional" | "business" | "enterprise" | "enterprise_plus";

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
  enterprise_plus: "enterprise_plus_monthly",
};

export const PLAN_ENTITLEMENTS: Record<string, PlanEntitlement> = {
  professional_monthly: {
    planId: "professional",
    priceId: "professional_monthly",
    name: "CertivoIQ Professional",
    unitLimit: 500,
    propertyLimit: null,
    aiDocAllowance: 500,
    statePacks: 1,
  },
  business_monthly: {
    planId: "business",
    priceId: "business_monthly",
    name: "CertivoIQ Business",
    unitLimit: 10000,
    propertyLimit: 50,
    aiDocAllowance: 10000,
    statePacks: null,
  },
  enterprise_monthly: {
    planId: "enterprise",
    priceId: "enterprise_monthly",
    name: "CertivoIQ Enterprise",
    unitLimit: null,
    propertyLimit: null,
    aiDocAllowance: null,
    statePacks: null,
  },
  enterprise_plus_monthly: {
    planId: "enterprise_plus",
    priceId: "enterprise_plus_monthly",
    name: "CertivoIQ Enterprise Plus",
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

/** Files are held for 14 days after paid access ends, then permanently deleted. */
export const FILE_RETENTION_DAYS = 14;

/** FREE review capacity. No card or subscription trial is attached. */
export const FREE_REVIEW_ENTITLEMENT = {
  unitLimit: 0,
  propertyLimit: 0,
  aiDocAllowance: 3,
} as const;

/** Every recurring plan price, used to tell plans apart from add-ons. */
export const PLAN_PRICE_ID_LIST: string[] = Object.values(PLAN_PRICE_IDS);

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

export function isPlanPrice(priceId: string | null | undefined): boolean {
  return !!priceId && PLAN_PRICE_ID_LIST.includes(priceId);
}

export function isAddonPrice(priceId: string | null | undefined): boolean {
  return !!priceId && ADDON_PRICE_ID_LIST.includes(priceId);
}

/** Price charged per certification processed beyond the plan allowance. */
export const AI_DOC_OVERAGE_PRICE_ID = ADDON_PRICE_IDS.aiDocOverage;
export const AI_DOC_OVERAGE_AMOUNT_USD = 3;
