import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { normalizeLicenseSelection } from "@/lib/license-selection";

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
      const stripe = createStripeClient(data.environment);

      const selection = normalizeLicenseSelection(data);
      const prices = await stripe.prices.list({
        lookup_keys: [selection.priceLookupKey],
        active: true,
        limit: 1,
      });
      const stripePrice = prices.data[0];
      if (
        !stripePrice ||
        stripePrice.type !== "recurring" ||
        stripePrice.recurring?.interval !== "year"
      )
        throw new Error("Configured license price must be an active annual recurring Stripe price");
      if (stripePrice.unit_amount !== (selection.annualAmountUsd * 100) / selection.quantity)
        throw new Error("Configured Stripe price does not match the authoritative license catalog");
      const customerId = await resolveOrCreateCustomer(stripe, { userId: context.userId });
      const stateCodes = selection.stateCodes.join(",");

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: selection.quantity }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        integration_identifier: `certivoiq_license_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
        metadata: {
          userId: context.userId,
          license_kind: selection.licenseKind,
          licensed_state_codes: stateCodes,
        },
        subscription_data: {
          metadata: {
            userId: context.userId,
            license_kind: selection.licenseKind,
            licensed_state_codes: stateCodes,
          },
        },
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);

      return { clientSecret: session.client_secret ?? "" };
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

