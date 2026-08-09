/**
 * Server-owned billing configuration.
 *
 * The browser may display the active payment environment, but it must never be
 * allowed to choose which Stripe account a server mutation uses.
 */

export type BillingEnvironment = "sandbox" | "live";

function clientToken(): string | undefined {
  return process.env["VITE_PAYMENTS_CLIENT_TOKEN"]?.trim();
}

export function resolveBillingEnvironment(): BillingEnvironment {
  const configured = process.env["PAYMENTS_ENV"]?.trim();
  if (configured && configured !== "sandbox" && configured !== "live") {
    throw new Error("PAYMENTS_ENV must be either sandbox or live.");
  }

  const token = clientToken();
  const tokenEnvironment = token?.startsWith("pk_live_")
    ? "live"
    : token?.startsWith("pk_test_")
      ? "sandbox"
      : undefined;

  if (configured && tokenEnvironment && configured !== tokenEnvironment) {
    throw new Error("The server payment environment does not match the Stripe client token.");
  }
  if (configured) return configured;
  if (tokenEnvironment) return tokenEnvironment;

  if (process.env["NODE_ENV"] === "production") {
    throw new Error("Production billing is not configured.");
  }
  return "sandbox";
}

/**
 * Production billing fails closed when the live connector, public token or
 * webhook verification secret is absent.
 */
export function assertLiveBillingConfiguration() {
  if (!process.env["STRIPE_LIVE_API_KEY"]) {
    throw new Error("Production billing requires a live Stripe connection.");
  }

  const token = clientToken();
  if (!token?.startsWith("pk_live_")) {
    throw new Error("Production billing requires a live Stripe client token.");
  }

  if (!process.env["PAYMENTS_LIVE_WEBHOOK_SECRET"]) {
    throw new Error("Production billing requires a live Stripe webhook secret.");
  }
}

/** True only when a live-mode end-to-end test has been recorded. */
export function isLiveBillingVerified(): boolean {
  return process.env["PAYMENTS_LIVE_VERIFIED"] === "true";
}
