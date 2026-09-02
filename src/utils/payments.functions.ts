import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireControlledPortalConfiguration } from "@/lib/billing-portal.server";
import { normalizeLicenseSelection } from "@/lib/license-selection";
import { assertNewPaidOnboardingAllowed } from "@/lib/paid-onboarding.server";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

const STRIPE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const LIVE_RETURN_HOSTS = new Set(["certivoiq.com", "www.certivoiq.com"]);

function validateReturnUrl(value: string | undefined, environment: StripeEnv): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new Error("Billing return URL must use HTTPS");
  }
  if (environment === "live" && !LIVE_RETURN_HOSTS.has(url.hostname)) {
    throw new Error("Live billing may return only to certivoiq.com");
  }
  return url.toString();
}

/**
 * Base platform licenses are sales-led, invoice-only contracts. The endpoint is
 * retained so obsolete clients fail closed instead of silently opening Checkout.
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
      if (!Array.isArray(data.stateCodes) || data.stateCodes.length > 51) {
        throw new Error("Invalid state rule-pack selection");
      }
      validateReturnUrl(data.returnUrl, data.environment);
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      assertNewPaidOnboardingAllowed(data.environment, { actorUserId: context.userId });
      normalizeLicenseSelection(data);
      return {
        error: "CertivoIQ base licenses are invoice-only and cannot be purchased through Checkout.",
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Controlled hosted billing portal. Enterprise users can view invoices and
 * update eligible payment methods; contract changes remain a support workflow.
 */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => ({
    ...data,
    returnUrl: validateReturnUrl(data.returnUrl, data.environment),
  }))
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
    if (subError) return { error: "Could not resolve billing access" };

    let stripeCustomerId = sub?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      const { data: membership, error: membershipError } = await supabase
        .from("enterprise_license_members")
        .select("license_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (membershipError) return { error: "Could not resolve enterprise billing access" };
      if (membership?.license_id) {
        const { data: license, error: licenseError } = await supabase
          .from("enterprise_licenses")
          .select("stripe_customer_id")
          .eq("id", membership.license_id)
          .maybeSingle();
        if (licenseError) return { error: "Could not resolve enterprise billing account" };
        stripeCustomerId = license?.stripe_customer_id ?? null;
      }
    }
    if (!stripeCustomerId) return { error: "No Stripe billing account found" };

    try {
      const stripe = createStripeClient(data.environment);
      const configuration = await requireControlledPortalConfiguration(
        stripe,
        data.environment,
      );
      const portal = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        configuration,
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
 * Legacy Checkout-session verification retained for already-created sessions.
 * New base-license purchases do not use Checkout.
 */
export const getCheckoutSessionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!STRIPE_ID_PATTERN.test(data.sessionId)) throw new Error("Invalid sessionId");
    return data;
  })
  .handler(async ({ data, context }): Promise<SessionStatusResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["line_items.data.price"],
      });

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
        provisioned: Boolean(access?.plan_id),
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

type CancelResult = { ok: true; endsAt: string | null; resumed?: boolean } | { error: string };

/** Cancel at period end (or undo a scheduled cancellation) for legacy self-serve subscriptions. */
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
    if (!sub?.stripe_subscription_id) {
      const { data: membership } = await supabase
        .from("enterprise_license_members")
        .select("license_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (membership?.license_id) {
        return {
          error:
            "Enterprise invoice licenses use a controlled cancellation workflow. Contact billing support to cancel, credit, or refund the agreement.",
        };
      }
      return { error: "No active subscription found" };
    }

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
