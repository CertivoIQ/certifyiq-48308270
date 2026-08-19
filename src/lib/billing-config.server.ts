/**
 * Production billing must fail closed. Live deployments may not run against a
 * test-mode connection or a missing unified annual platform price.
 */

import { PLATFORM_PRICE_ID } from "@/lib/plan-catalog";

export function assertLiveBillingConfiguration() {
  if (process.env["NODE_ENV"] !== "production") return;

  const liveConnection = process.env["STRIPE_LIVE_API_KEY"];
  if (!liveConnection) {
    throw new Error("Production billing requires a live payments connection.");
  }
  const clientToken = process.env["VITE_PAYMENTS_CLIENT_TOKEN"];
  if (clientToken?.startsWith("pk_test_")) {
    throw new Error("Production billing detected a test-mode client token.");
  }

  const configuredPrice = process.env["STRIPE_PLATFORM_PRICE_ID_LIVE"] ?? PLATFORM_PRICE_ID;
  if (configuredPrice !== PLATFORM_PRICE_ID) {
    throw new Error("Missing live CertivoIQ annual platform price ID.");
  }
}

/** True only when a live-mode end-to-end test has been recorded. */
export function isLiveBillingVerified(): boolean {
  return process.env["PAYMENTS_LIVE_VERIFIED"] === "true";
}
