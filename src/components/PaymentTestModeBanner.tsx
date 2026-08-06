const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

/** Renders nothing in live mode; safe to mount unconditionally. */
export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-flag/40 bg-flag/10 px-4 py-2 text-center text-[12.5px] text-flag">
        Production checkout is not configured yet. Complete payments go-live to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-caution/40 bg-caution/10 px-4 py-2 text-center text-[12.5px] text-caution-foreground">
        All payments made in the preview are in test mode.{" "}
        <a
          href="https://docs.lovable.dev/features/payments#test-and-live-environments"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline"
        >
          Read more
        </a>
      </div>
    );
  }
  return null;
}
