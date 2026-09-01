import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { normalizeLicenseSelection } from "@/lib/license-selection";
import { assertNewPaidOnboardingAllowed } from "@/lib/paid-onboarding.server";
import { LICENSES } from "@/lib/plan-catalog";
import {
  FOUNDERS_PROMOTION,
  FOUNDERS_PROMOTION_EXPIRES_AT,
  foundersPromotionAvailable,
} from "@/lib/founders-promotion";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Seller-country set where Stripe can take on end-to-end compliance
 * (tax filing/remittance, fraud, disputes, transaction support). Buyers
 * outside it fall back to tax calculation and collection only.
 */
const MANAGED_PAYMENTS_COUNTRIES = new Set([
  "US",
  "CA",
  "BR",
  "CL",
  "CO",
  "AR",
  "PE",
  "UY",
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "GB",
  "NO",
  "CH",
  "IS",
  "LI",
  "AU",
  "NZ",
  "KR",
  "MY",
  "TH",
  "ID",
  "PH",
  "VN",
  "IN",
  "HK",
  "TW",
  "AE",
  "SA",
  "ZA",
  "IL",
  "TR",
  "EG",
  "NG",
  "KE",
  "GI",
  "BH",
  "GE",
  "KZ",
  "BD",
  "PK",
  "LK",
  "MM",
  "KH",
  "LA",
  "RS",
  "BA",
  "ME",
  "MK",
  "AL",
  "MD",
  "AM",
]);

function shouldUseComplianceHandling(customerCountry?: string): boolean {
  if (!customerCountry) return false;
  return MANAGED_PAYMENTS_COUNTRIES.has(customerCountry.toUpperCase());
}

function isMissingStripeResource(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; raw?: { code?: string } };
  return (candidate.raw?.code ?? candidate.code) === "resource_missing";
}

async function ensureFoundersPromotion(
  stripe: ReturnType<typeof createStripeClient>,
): Promise<void> {
  if (!foundersPromotionAvailable()) return;

  const licensePrices = await stripe.prices.list({
    lookup_keys: Object.values(LICENSES).map((license) => license.priceId),
    active: true,
    limit: 10,
  });
  const productIds = [
    ...new Set(
      licensePrices.data.map((price) =>
        typeof price.product === "string" ? price.product : price.product.id,
      ),
    ),
  ];
  if (productIds.length !== Object.keys(LICENSES).length) {
    throw new Error("Founder's Special requires both live annual license products");
  }

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
      redeem_by: FOUNDERS_PROMOTION_EXPIRES_AT,
      applies_to: { products: productIds },
      metadata: {
        certivoiq_offer: "founders_special",
        redemption_deadline: "2026-11-30",
        discount_term: "first_12_months",
      },
    });
  }

  const couponRecord = coupon as unknown as {
    deleted?: boolean;
    valid?: boolean;
    percent_off?: number | null;
    duration?: string;
    redeem_by?: number | null;
    applies_to?: { products?: string[] } | null;
  };
  const appliedProductIds = [...(couponRecord.applies_to?.products ?? [])].sort();
  const expectedProductIds = [...productIds].sort();
  if (
    couponRecord.deleted ||
    couponRecord.valid === false ||
    couponRecord.percent_off !== FOUNDERS_PROMOTION.percentOff ||
    couponRecord.duration !== FOUNDERS_PROMOTION.duration ||
    couponRecord.redeem_by !== FOUNDERS_PROMOTION_EXPIRES_AT ||
    appliedProductIds.length !== expectedProductIds.length ||
    appliedProductIds.some((productId, index) => productId !== expectedProductIds[index])
  ) {
    throw new Error("Existing Founder's Special coupon does not match approved billing terms");
  }

  const activeCodes = await stripe.promotionCodes.list({
    code: FOUNDERS_PROMOTION.code,
    active: true,
    limit: 10,
  });
  const existingCode = activeCodes.data[0];
  if (existingCode) {
    const record = existingCode as unknown as {
      expires_at?: number | null;
      promotion?: { coupon?: string | { id?: string } };
      coupon?: { id?: string };
    };
    const promotionCoupon = record.promotion?.coupon;
    const couponId =
      typeof promotionCoupon === "string"
        ? promotionCoupon
        : promotionCoupon?.id ?? record.coupon?.id;
    if (
      couponId !== FOUNDERS_PROMOTION.couponId ||
      record.expires_at !== FOUNDERS_PROMOTION_EXPIRES_AT
    ) {
      throw new Error("Existing FOUNDERS50 code does not match approved billing terms");
    }
    return;
  }

  await stripe.promotionCodes.create({
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
      certivoiq_offer: "founders_special",
      redemption_deadline: "2026-11-30",
      discount_term: "first_12_months",
    },
  } as Parameters<typeof stripe.promotionCodes.create>[0]);
}

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !ID_PATTERN.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length && found.data[0]) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customer = existing.data[0];
    if (customer) {
      if (options.userId && customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

/**
 * Creates an embedded checkout session for a plan or add-on price.
 * The 3 FREE certification reviews runs inside CertivoIQ (no card required), so checkout is
 * only opened when someone converts or upgrades — no `trial_period_days`.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      licenseKind: string;
      stateCodes: string[];
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      if (!Array.isArray(data.stateCodes) || data.stateCodes.length > 51)
        throw new Error("Invalid state rule-pack selection");
      const url = new URL(data.returnUrl);
      if (url.protocol !== "https:" && url.hostname !== "localhost")
        throw new Error("Checkout return URL must be secure");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      assertNewPaidOnboardingAllowed(data.environment, { actorUserId: context.userId });
      normalizeLicenseSelection(data);
      return {
        error:
          "CertivoIQ base licenses are invoice-only and cannot be purchased through Checkout.",
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Hosted billing portal: cancel, update card, download invoices. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { supabase, userId } = context;

    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError || !sub?.stripe_customer_id) return { error: "No subscription found" };

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

type SessionStatusResult =
  | { status: string; paymentStatus: string; priceId: string | null; provisioned: boolean }
  | { error: string };

/**
 * Verifies a completed checkout session so the confirmation page reflects
 * reality (and can wait for the webhook to provision the account) instead of
 * trusting the presence of a session id in the URL.
 */
export const getCheckoutSessionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.sessionId)) throw new Error("Invalid sessionId");
    return data;
  })
  .handler(async ({ data, context }): Promise<SessionStatusResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["line_items.data.price"],
      });

      // Only the buyer may inspect their own session.
      if (session.metadata?.["userId"] && session.metadata["userId"] !== context.userId) {
        return { error: "This checkout session belongs to another account." };
      }

      const price = session.line_items?.data?.[0]?.price;
      const priceId = price?.lookup_key ?? price?.id ?? null;

      const { data: access } = await context.supabase
        .from("account_access")
        .select("plan_id, status")
        .eq("user_id", context.userId)
        .maybeSingle();

      return {
        status: session.status ?? "unknown",
        paymentStatus: session.payment_status ?? "unknown",
        priceId,
        provisioned: !!access?.plan_id,
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

type CancelResult = { ok: true; endsAt: string | null; resumed?: boolean } | { error: string };

/** Cancel at period end (or undo a scheduled cancellation). */
export const setCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { cancel: boolean; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<CancelResult> => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, current_period_end, price_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) return { error: "No active subscription found" };

    try {
      const stripe = createStripeClient(data.environment);
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: data.cancel,
      });
      return {
        ok: true,
        endsAt: sub.current_period_end ?? null,
        ...(data.cancel ? {} : { resumed: true }),
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });


