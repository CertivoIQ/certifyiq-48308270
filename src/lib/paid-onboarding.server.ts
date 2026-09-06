import { assertLiveBillingConfiguration } from "@/lib/billing-config.server";
import type { StripeEnv } from "@/lib/stripe.server";

type PaidOnboardingEnvironment = Partial<Pick<
  NodeJS.ProcessEnv,
  | "PAID_ONBOARDING_ENABLED"
  | "PAYMENTS_LIVE_VERIFIED"
  | "LIVE_BILLING_VERIFICATION_ENABLED"
  | "LIVE_BILLING_VERIFIER_USER_ID"
>>;

type PaidOnboardingRequest = { actorUserId?: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function paidOnboardingBlockReason(
  environment: StripeEnv,
  request: PaidOnboardingRequest = {},
  config: PaidOnboardingEnvironment = process.env,
): string | null {
  if (environment !== "live") return null;

  const paidOnboardingGo =
    config.PAID_ONBOARDING_ENABLED === "true" &&
    config.PAYMENTS_LIVE_VERIFIED === "true";
  if (paidOnboardingGo) return null;

  if (config.LIVE_BILLING_VERIFICATION_ENABLED === "true") {
    const verifierUserId = config.LIVE_BILLING_VERIFIER_USER_ID?.trim() ?? "";
    if (UUID_PATTERN.test(verifierUserId) && request.actorUserId === verifierUserId) {
      return null;
    }
    return "Live billing verification is restricted to the designated verifier.";
  }

  if (config.PAID_ONBOARDING_ENABLED !== "true") {
    return "Paid onboarding is temporarily disabled during Early Access.";
  }
  return "Paid onboarding is unavailable until live billing verification is complete.";
}

/**
 * Fail closed for new live financial objects. A temporary verification window
 * is limited to one server-identified authenticated user. Do not use this guard
 * for webhooks, portal access, cancellation, or existing-customer service.
 */
export function assertNewPaidOnboardingAllowed(
  environment: StripeEnv,
  request: PaidOnboardingRequest = {},
): void {
  const reason = paidOnboardingBlockReason(environment, request);
  if (reason) throw new Error(reason);
  if (environment === "live") assertLiveBillingConfiguration();
}
