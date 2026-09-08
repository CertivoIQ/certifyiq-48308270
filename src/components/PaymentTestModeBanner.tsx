import { usePaymentConfiguration } from '@/lib/stripe';

/** Renders nothing in live mode; safe to mount unconditionally. */
export function PaymentTestModeBanner() {
  const configuration = usePaymentConfiguration();
  if (configuration.isLoading) return null;
  if (configuration.isError) {
    return (
      <div className="w-full border-b border-reject/40 bg-reject/10 px-4 py-2 text-center text-[12.5px] text-reject">
        Production checkout is not configured yet. Complete payments go-live to accept real
        payments.
      </div>
    );
  }
  if (configuration.data?.environment === 'sandbox') {
    return (
      <div className="w-full border-b border-flag/40 bg-flag-soft px-4 py-2 text-center text-[12.5px] text-foreground">
        All payments made in the preview are in test mode.{" "}
        <a
          href="https://docs.stripe.com/test-mode"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline"
        >
          Stripe test-mode guide
        </a>
      </div>
    );
  }
  return null;
}

