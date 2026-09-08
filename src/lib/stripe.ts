import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useQuery } from '@tanstack/react-query';
import { getPublicPaymentConfiguration } from './payment-public-config.functions';

/**
 * Declared locally so this browser module has no cross-tree import into
 * server-only code. Structurally identical to the server `StripeEnv`.
 */
export type StripeEnv = "sandbox" | "live";

export function usePaymentConfiguration() {
  return useQuery({ queryKey: ['public-payment-configuration'], queryFn: () => getPublicPaymentConfiguration(), staleTime: 60_000 });
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = getPublicPaymentConfiguration()
      .then(({ publishableKey }) => loadStripe(publishableKey))
      .catch(error => { stripePromise = null; throw error; });
  }
  return stripePromise;
}

export async function getStripeEnvironment(): Promise<StripeEnv> {
  return (await getPublicPaymentConfiguration()).environment;
}

