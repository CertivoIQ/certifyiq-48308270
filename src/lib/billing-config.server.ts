/**
 * Production billing must fail closed. Live deployments may not create or
 * service financial objects with test credentials, missing webhook validation,
 * unbound catalog IDs, or an uncontrolled customer portal.
 */

import { LICENSES } from "@/lib/plan-catalog";

const LIVE_SECRET_KEY_PATTERN = /^(?:rk|sk)_live_[A-Za-z0-9]+$/;
const LIVE_PUBLISHABLE_KEY_PATTERN = /^pk_live_[A-Za-z0-9]+$/;
const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9]+$/;
const PRICE_ID_PATTERN = /^price_[A-Za-z0-9]+$/;
const PORTAL_CONFIGURATION_PATTERN = /^bpc_[A-Za-z0-9]+$/;

export function assertLiveBillingConfiguration() {
  if (process.env["NODE_ENV"] !== "production") return;

  const liveConnection = process.env["STRIPE_LIVE_API_KEY"]?.trim() ?? "";
  if (!LIVE_SECRET_KEY_PATTERN.test(liveConnection)) {
    throw new Error("Production billing requires a live Stripe secret or restricted key.");
  }

  const clientToken = process.env["VITE_PAYMENTS_CLIENT_TOKEN"]?.trim() ?? "";
  if (!LIVE_PUBLISHABLE_KEY_PATTERN.test(clientToken)) {
    throw new Error("Production billing requires a live Stripe publishable key.");
  }

  const webhookSecret = process.env["PAYMENTS_LIVE_WEBHOOK_SECRET"]?.trim() ?? "";
  if (!WEBHOOK_SECRET_PATTERN.test(webhookSecret)) {
    throw new Error("Production billing requires a live webhook signing secret.");
  }

  const multifamilyPriceId =
    process.env["STRIPE_MULTIFAMILY_ENTERPRISE_PRICE_ID_LIVE"]?.trim() ?? "";
  const phaPriceId = process.env["STRIPE_PHA_PRICE_ID_LIVE"]?.trim() ?? "";
  if (!PRICE_ID_PATTERN.test(multifamilyPriceId) || !PRICE_ID_PATTERN.test(phaPriceId)) {
    throw new Error(
      `Production billing requires configured ${LICENSES.multifamily_enterprise.name} and ${LICENSES.pha.name} prices.`,
    );
  }

  const portalConfigurationId =
    process.env["STRIPE_BILLING_PORTAL_CONFIGURATION_ID_LIVE"]?.trim() ?? "";
  if (!PORTAL_CONFIGURATION_PATTERN.test(portalConfigurationId)) {
    throw new Error("Production billing requires a controlled Stripe customer portal configuration.");
  }
}

/** True only when a live-mode end-to-end test has been recorded. */
export function isLiveBillingVerified(): boolean {
  return process.env["PAYMENTS_LIVE_VERIFIED"] === "true";
}
