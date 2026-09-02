import type Stripe from "stripe";

import {
  FOUNDERS_PROMOTION,
  FOUNDERS_PROMOTION_EXPIRES_AT,
  foundersPromotionAvailable,
} from "@/lib/founders-promotion";
import { LICENSES } from "@/lib/plan-catalog";

export type FoundersInvoicePromotion = {
  code: typeof FOUNDERS_PROMOTION.code;
  couponId: string;
  promotionCodeId: string;
};

type CouponRecord = {
  deleted?: boolean;
  valid?: boolean;
  percent_off?: number | null;
  duration?: string;
  duration_in_months?: number | null;
  redeem_by?: number | null;
  applies_to?: { products?: string[] } | null;
};

type PromotionCodeRecord = {
  id: string;
  active?: boolean;
  expires_at?: number | null;
  promotion?: { coupon?: string | { id?: string } };
  coupon?: string | { id?: string };
  restrictions?: { first_time_transaction?: boolean } | null;
};

function isMissingStripeResource(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; raw?: { code?: string } };
  return (candidate.raw?.code ?? candidate.code) === "resource_missing";
}

function couponIdForPromotion(record: PromotionCodeRecord): string | undefined {
  const candidate = record.promotion?.coupon ?? record.coupon;
  return typeof candidate === "string" ? candidate : candidate?.id;
}

async function baseLicenseProductIds(stripe: Stripe): Promise<string[]> {
  const prices = await stripe.prices.list({
    lookup_keys: Object.values(LICENSES).map((license) => license.priceId),
    active: true,
    limit: 10,
  });
  const productIds = [
    ...new Set(
      prices.data.map((price) =>
        typeof price.product === "string" ? price.product : price.product.id,
      ),
    ),
  ].sort();
  if (productIds.length !== Object.keys(LICENSES).length) {
    throw new Error("Founding Customer Offer requires both active base-license products");
  }
  return productIds;
}

/**
 * Creates the approved live/test catalog objects only when they are absent and
 * otherwise validates every immutable term. A mismatched active object fails
 * closed instead of silently issuing a differently priced agreement.
 */
export async function ensureFoundersPromotionCatalog(
  stripe: Stripe,
): Promise<FoundersInvoicePromotion> {
  const productIds = await baseLicenseProductIds(stripe);

  let coupon: Awaited<ReturnType<typeof stripe.coupons.retrieve>> | null = null;
  try {
    coupon = await stripe.coupons.retrieve(FOUNDERS_PROMOTION.couponId);
  } catch (error) {
    if (!isMissingStripeResource(error)) throw error;
  }

  if (!coupon) {
    coupon = await stripe.coupons.create({
      id: FOUNDERS_PROMOTION.couponId,
      name: FOUNDERS_PROMOTION.name,
      percent_off: FOUNDERS_PROMOTION.percentOff,
      duration: FOUNDERS_PROMOTION.duration,
      duration_in_months: FOUNDERS_PROMOTION.durationInMonths,
      redeem_by: FOUNDERS_PROMOTION_EXPIRES_AT,
      applies_to: { products: productIds },
      metadata: {
        certivoiq_offer: "founding_customer_offer",
        redemption_deadline: "2026-11-30",
        discount_term: "first_12_monthly_invoices",
      },
    } as Parameters<typeof stripe.coupons.create>[0]);
  }

  const couponRecord = coupon as unknown as CouponRecord;
  const appliedProductIds = [...(couponRecord.applies_to?.products ?? [])].sort();
  if (
    couponRecord.deleted ||
    couponRecord.valid === false ||
    couponRecord.percent_off !== FOUNDERS_PROMOTION.percentOff ||
    couponRecord.duration !== FOUNDERS_PROMOTION.duration ||
    couponRecord.duration_in_months !== FOUNDERS_PROMOTION.durationInMonths ||
    couponRecord.redeem_by !== FOUNDERS_PROMOTION_EXPIRES_AT ||
    appliedProductIds.length !== productIds.length ||
    appliedProductIds.some((productId, index) => productId !== productIds[index])
  ) {
    throw new Error("Existing Founding Customer Offer coupon does not match approved terms");
  }

  const activeCodes = await stripe.promotionCodes.list({
    code: FOUNDERS_PROMOTION.code,
    active: true,
    limit: 10,
  });
  let promotion = activeCodes.data[0] as unknown as PromotionCodeRecord | undefined;
  if (!promotion) {
    promotion = (await stripe.promotionCodes.create({
      code: FOUNDERS_PROMOTION.code,
      promotion: {
        type: "coupon",
        coupon: FOUNDERS_PROMOTION.couponId,
      },
      expires_at: FOUNDERS_PROMOTION_EXPIRES_AT,
      restrictions: {
        first_time_transaction: FOUNDERS_PROMOTION.firstTimeTransactionOnly,
      },
      metadata: {
        certivoiq_offer: "founding_customer_offer",
        redemption_deadline: "2026-11-30",
        discount_term: "first_12_monthly_invoices",
      },
    } as Parameters<typeof stripe.promotionCodes.create>[0])) as unknown as PromotionCodeRecord;
  }

  if (
    promotion.active === false ||
    couponIdForPromotion(promotion) !== FOUNDERS_PROMOTION.couponId ||
    promotion.expires_at !== FOUNDERS_PROMOTION_EXPIRES_AT ||
    promotion.restrictions?.first_time_transaction !==
      FOUNDERS_PROMOTION.firstTimeTransactionOnly
  ) {
    throw new Error("Existing FOUNDERS50 code does not match approved terms");
  }

  return {
    code: FOUNDERS_PROMOTION.code,
    couponId: FOUNDERS_PROMOTION.couponId,
    promotionCodeId: promotion.id,
  };
}

/** Validate an optional staff-entered code and return the Stripe object IDs. */
export async function resolveFoundersInvoicePromotion(
  stripe: Stripe,
  submittedCode?: string,
): Promise<FoundersInvoicePromotion | null> {
  const normalized = submittedCode?.trim().toUpperCase() ?? "";
  if (!normalized) return null;
  if (normalized !== FOUNDERS_PROMOTION.code) {
    throw new Error("The promotion code is invalid");
  }
  if (!foundersPromotionAvailable()) {
    throw new Error("FOUNDERS50 expired after November 30, 2026");
  }
  return ensureFoundersPromotionCatalog(stripe);
}
