/**
 * Single source of truth linking payment-provider price IDs to what the
 * CertivoIQ annual platform subscription unlocks.
 */

export type PlanKey = "platform";

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

/** Stripe lookup key for the single $65,000/year platform subscription. */
export const PLATFORM_PRICE_ID = "certivoiq_platform_annual";

export const PLAN_PRICE_IDS: Record<PlanKey, string> = {
  platform: PLATFORM_PRICE_ID,
};

export const PLATFORM_ENTITLEMENT: PlanEntitlement = {
  planId: "platform",
  priceId: PLATFORM_PRICE_ID,
  name: "CertivoIQ Platform",
  unitLimit: null,
  propertyLimit: null,
  aiDocAllowance: null,
  statePacks: null,
};

/**
 * Legacy Stripe lookup keys remain recognized only so existing subscriptions
 * retain full access during migration. They are not offered or displayed.
 */
const LEGACY_PRICE_IDS = [
  "professional_monthly",
  "business_monthly",
  "enterprise_monthly",
  "enterprise_plus_monthly",
] as const;

export const PLAN_ENTITLEMENTS: Record<string, PlanEntitlement> = {
  [PLATFORM_PRICE_ID]: PLATFORM_ENTITLEMENT,
  ...Object.fromEntries(
    LEGACY_PRICE_IDS.map((priceId) => [
      priceId,
      { ...PLATFORM_ENTITLEMENT, priceId },
    ]),
  ),
};

/** All platform capabilities are included in the annual subscription. */
export const ADDON_PRICE_IDS = {} as const;
export const ADDON_PRICE_ID_LIST: string[] = [];

/** Files are held for 14 days after paid access ends, then permanently deleted. */
export const FILE_RETENTION_DAYS = 14;

/** FREE review capacity. No card or subscription trial is attached. */
export const FREE_REVIEW_ENTITLEMENT = {
  unitLimit: 0,
  propertyLimit: 0,
  aiDocAllowance: 3,
} as const;

/** The only purchasable recurring platform price. */
export const PLAN_PRICE_ID_LIST: string[] = [PLATFORM_PRICE_ID];

export function entitlementForPrice(priceId: string | null | undefined): PlanEntitlement | null {
  if (!priceId) return null;
  return PLAN_ENTITLEMENTS[priceId] ?? null;
}

export function planKeyToPriceId(plan: string): string | null {
  return plan === "platform" ? PLATFORM_PRICE_ID : null;
}

export function formatLimit(value: number | null): string {
  return value === null ? "Unlimited" : value.toLocaleString();
}

export function isPlanPrice(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  return priceId === PLATFORM_PRICE_ID || LEGACY_PRICE_IDS.includes(priceId as (typeof LEGACY_PRICE_IDS)[number]);
}

export function isAddonPrice(_priceId: string | null | undefined): boolean {
  return false;
}

/** No per-document overage fee under the flat annual platform subscription. */
export const AI_DOC_OVERAGE_PRICE_ID = null;
export const AI_DOC_OVERAGE_AMOUNT_USD = 0;
