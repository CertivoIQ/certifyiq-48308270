import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  resolveBillingEnvironment,
  type BillingEnvironment,
} from "@/lib/billing-config.server";
import {
  ADDON_PRICE_IDS,
  PLAN_PRICE_ID_LIST,
  isAddonPrice,
  isPlanPrice,
} from "@/lib/plan-catalog";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

function isSelfServeCheckoutPrice(priceId: string): boolean {
  return (
    isPlanPrice(priceId) ||
    priceId === ADDON_PRICE_IDS.academySeat ||
    priceId === ADDON_PRICE_IDS.academyProperty
  );
}

function hasCurrentAccess(status: string, periodEnd: string | null): boolean {
  if (ACTIVE_STATUSES.has(status))
    return !periodEnd || new Date(periodEnd).getTime() > Date.now();
  return (
    status === "canceled" &&
    !!periodEnd &&
    new Date(periodEnd).getTime() > Date.now()
  );
}

function applicationOrigin(environment: BillingEnvironment): string {
  if (environment === "live") {
    const configured =
      process.env["PAYMENTS_APP_URL"]?.trim() || "https://certivoiq.com";
    const url = new URL(configured);
    if (url.protocol !== "https:")
      throw new Error("Live payment return URL must use HTTPS.");
    return url.origin;
  }

  const request = getRequest();
  if (!request) return "http://localhost:3000";
  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid payment return URL.");
  }
  return url.origin;
}

function checkoutReturnUrl(environment: BillingEnvironment): string {
  return new URL(
    "/checkout/return?session_id={CHECKOUT_SESSION_ID}",
    applicationOrigin(environment),
  ).toString();
}

function billingReturnUrl(environment: BillingEnvironment): string {
  return new URL("/billing", applicationOrigin(environment)).toString();
}

/**
 * Creates an embedded Checkout Session for an authenticated CertivoIQ user.
 * Identity, email, Stripe environment and redirect destination are all derived
 * on the server; the browser may only choose an allowlisted catalog item.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; quantity?: number }) => {
    if (
      !ID_PATTERN.test(data.priceId) ||
      !isSelfServeCheckoutPrice(data.priceId)
    ) {
      throw new Error("This price is not available for self-serve checkout.");
    }

    const quantity = data.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      throw new Error("Invalid quantity.");
    }
    if (data.priceId !== ADDON_PRICE_IDS.academySeat && quantity !== 1) {
      throw new Error(
        "Quantity can only be changed for Academy seat subscriptions.",
      );
    }
    return { ...data, quantity };
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const environment = resolveBillingEnvironment();
      const { supabase, userId, claims } = context;

      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from("subscriptions")
        .select(
          "stripe_customer_id, price_id, status, current_period_end, created_at",
        )
        .eq("user_id", userId)
        .eq("environment", environment)
        .order("created_at", { ascending: false });
      if (subscriptionsError) throw subscriptionsError;

      const currentPlan = subscriptions?.find(
        (subscription) =>
          isPlanPrice(subscription.price_id) &&
          hasCurrentAccess(
            subscription.status,
            subscription.current_period_end,
          ),
      );
      if (isPlanPrice(data.priceId) && currentPlan) {
        return {
          error:
            "You already have a current plan. Open Manage billing to change it securely.",
        };
      }

      const duplicateAddon = subscriptions?.find(
        (subscription) =>
          subscription.price_id === data.priceId &&
          hasCurrentAccess(
            subscription.status,
            subscription.current_period_end,
          ),
      );
      if (isAddonPrice(data.priceId) && duplicateAddon) {
        return { error: "This add-on is already active on your account." };
      }

      if (isAddonPrice(data.priceId)) {
        const { data: access, error: accessError } = await supabase
          .from("account_access")
          .select("plan_id, status, environment")
          .eq("user_id", userId)
          .eq("environment", environment)
          .maybeSingle();
        if (accessError) throw accessError;
        if (!access?.plan_id || !ACTIVE_STATUSES.has(access.status)) {
          return {
            error: "Academy is an add-on. Subscribe to a platform plan first.",
          };
        }
      }

      const stripe = createStripeClient(environment);
      const prices = await stripe.prices.list({
        lookup_keys: [data.priceId],
        active: true,
        limit: 1,
      });
      const stripePrice = prices.data[0];
      if (!stripePrice || stripePrice.type !== "recurring") {
        return { error: "The selected subscription price is not available." };
      }

      const customerId = subscriptions?.find(
        (subscription) => !!subscription.stripe_customer_id,
      )?.stripe_customer_id;
      const email =
        typeof claims?.email === "string" ? claims.email : undefined;

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: data.quantity }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: checkoutReturnUrl(environment),
        client_reference_id: userId,
        allow_promotion_codes: true,
        automatic_tax: { enabled: true },
        ...(customerId
          ? {
              customer: customerId,
              customer_update: { address: "auto", name: "auto" },
            }
          : email
            ? { customer_email: email }
            : {}),
        metadata: {
          userId,
          purchaseKey: data.priceId,
        },
        subscription_data: {
          metadata: {
            userId,
            purchaseKey: data.priceId,
            ...(email ? { email } : {}),
          },
        },
      });

      if (!session.client_secret) {
        throw new Error("Checkout did not return a client secret.");
      }
      return { clientSecret: session.client_secret };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Hosted billing portal: plan changes, cancellation, cards and invoices. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Record<string, never>) => data)
  .handler(async ({ context }): Promise<PortalSessionResult> => {
    const environment = resolveBillingEnvironment();
    const { supabase, userId } = context;

    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", environment)
      .in("price_id", PLAN_PRICE_ID_LIST)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError || !sub?.stripe_customer_id)
      return { error: "No subscription found." };

    try {
      const stripe = createStripeClient(environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: billingReturnUrl(environment),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

type SessionStatusResult =
  | {
      status: string;
      paymentStatus: string;
      priceId: string | null;
      provisioned: boolean;
    }
  | { error: string };

/** Verify that a Checkout Session belongs to the signed-in buyer. */
export const getCheckoutSessionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) => {
    if (!ID_PATTERN.test(data.sessionId)) throw new Error("Invalid sessionId.");
    return data;
  })
  .handler(async ({ data, context }): Promise<SessionStatusResult> => {
    try {
      const environment = resolveBillingEnvironment();
      const stripe = createStripeClient(environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["line_items.data.price"],
      });

      if (
        session.metadata?.["userId"] !== context.userId ||
        session.client_reference_id !== context.userId
      ) {
        return {
          error: "This checkout session does not belong to your account.",
        };
      }

      const price = session.line_items?.data?.[0]?.price;
      const priceId = price?.lookup_key ?? price?.id ?? null;

      const { data: access, error: accessError } = await context.supabase
        .from("account_access")
        .select("plan_id, status")
        .eq("user_id", context.userId)
        .eq("environment", environment)
        .maybeSingle();
      if (accessError) throw accessError;

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

type CancelResult =
  | { ok: true; endsAt: string | null; resumed?: boolean }
  | { error: string };

/** Cancel the platform plan at period end, or undo a scheduled cancellation. */
export const setCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { cancel: boolean }) => {
    if (typeof data.cancel !== "boolean")
      throw new Error("Invalid cancellation request.");
    return data;
  })
  .handler(async ({ data, context }): Promise<CancelResult> => {
    const environment = resolveBillingEnvironment();
    const { supabase, userId } = context;
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, current_period_end")
      .eq("user_id", userId)
      .eq("environment", environment)
      .in("price_id", PLAN_PRICE_ID_LIST)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError) return { error: subError.message };
    if (!sub?.stripe_subscription_id)
      return { error: "No active subscription found." };

    try {
      const stripe = createStripeClient(environment);
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
