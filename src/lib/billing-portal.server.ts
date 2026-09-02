import type { StripeEnv } from "@/lib/stripe.server";
import { createStripeClient } from "@/lib/stripe.server";

const PORTAL_CONFIGURATION_PATTERN = /^bpc_[a-zA-Z0-9]+$/;

type ControlledPortalConfiguration = {
  id?: string;
  active?: boolean;
  features?: {
    invoice_history?: { enabled?: boolean };
    payment_method_update?: { enabled?: boolean };
    subscription_cancel?: { enabled?: boolean };
    subscription_update?: { enabled?: boolean };
  };
};

function portalConfigurationEnvironmentKey(environment: StripeEnv) {
  return environment === "live"
    ? "STRIPE_BILLING_PORTAL_CONFIGURATION_ID_LIVE"
    : "STRIPE_BILLING_PORTAL_CONFIGURATION_ID_SANDBOX";
}

function validateControlledPortalConfiguration(
  configuration: ControlledPortalConfiguration,
): string {
  const id = configuration.id?.trim() ?? "";
  if (!PORTAL_CONFIGURATION_PATTERN.test(id)) {
    throw new Error("Stripe returned an invalid customer portal configuration ID");
  }
  if (!configuration.active) {
    throw new Error("The Stripe customer portal configuration is inactive");
  }
  const features = configuration.features;
  if (!features?.invoice_history?.enabled) {
    throw new Error("The Stripe customer portal must expose invoice history");
  }
  if (!features.payment_method_update?.enabled) {
    throw new Error("The Stripe customer portal must allow eligible payment-method updates");
  }
  if (features.subscription_cancel?.enabled || features.subscription_update?.enabled) {
    throw new Error(
      "Enterprise portal configuration must disable self-service subscription changes and cancellation",
    );
  }
  return id;
}

function isControlledPortalConfiguration(
  configuration: ControlledPortalConfiguration,
): boolean {
  try {
    validateControlledPortalConfiguration(configuration);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the controlled enterprise portal configuration.
 *
 * An explicit environment ID remains supported as a deterministic pin. When it
 * is omitted, Stripe is queried for active configurations and exactly one must
 * satisfy CertivoIQ's invoice-history/payment-method-only policy. Zero or
 * multiple matches fail closed.
 */
export async function requireControlledPortalConfiguration(
  stripe: ReturnType<typeof createStripeClient>,
  environment: StripeEnv,
): Promise<string> {
  const key = portalConfigurationEnvironmentKey(environment);
  const configuredId = process.env[key]?.trim() ?? "";

  if (configuredId) {
    if (!PORTAL_CONFIGURATION_PATTERN.test(configuredId)) {
      throw new Error(`${key} is invalid`);
    }
    const configuration = (await stripe.billingPortal.configurations.retrieve(
      configuredId,
    )) as unknown as ControlledPortalConfiguration;
    return validateControlledPortalConfiguration(configuration);
  }

  const configurations = (await stripe.billingPortal.configurations.list({
    active: true,
    limit: 100,
  })) as unknown as { data?: ControlledPortalConfiguration[] };
  const matches = (configurations.data ?? []).filter(isControlledPortalConfiguration);

  if (matches.length === 0) {
    throw new Error(
      "No active Stripe customer portal configuration matches the controlled enterprise billing policy",
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Multiple controlled Stripe customer portal configurations are active; set ${key} to pin one explicitly`,
    );
  }

  return validateControlledPortalConfiguration(matches[0]);
}
