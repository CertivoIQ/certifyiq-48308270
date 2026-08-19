import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Rocket, Loader2, AlertTriangle, CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getStripeEnvironment } from "@/lib/stripe";
import { getCheckoutSessionStatus } from "@/utils/payments.functions";

export const Route = createFileRoute("/checkout/return")({
  head: () => ({
    meta: [
      { title: "Subscription Confirmed — CertivoIQ" },
      {
        name: "description",
        content:
          "Your CertivoIQ annual platform subscription is active. Your certification reviews are retained and LaunchPad onboarding is ready to begin.",
      },
      { property: "og:title", content: "Subscription Confirmed — CertivoIQ" },
      {
        property: "og:description",
        content: "Complete CertivoIQ platform access is active and guided onboarding is ready.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string | undefined } => ({
    session_id: typeof search["session_id"] === "string" ? search["session_id"] : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();

  const { data, isLoading } = useQuery({
    queryKey: ["checkout-session", sessionId],
    enabled: !!sessionId,
    refetchInterval: (q) => {
      const r = q.state.data;
      if (!r || "error" in r) return false;
      return r.paymentStatus === "unpaid" || !r.provisioned ? 2000 : false;
    },
    queryFn: async () => {
      const result = await getCheckoutSessionStatus({
        data: { sessionId: sessionId!, environment: getStripeEnvironment() },
      });
      return result;
    },
  });

  const failed = !!data && "error" in data;
  const paid = !!data && !("error" in data) && data.paymentStatus !== "unpaid";
  const pending = !!data && !("error" in data) && data.paymentStatus === "unpaid";

  return (
    <AppShell title="Checkout" subtitle="Payment confirmation">
      <Panel bodyClassName="p-8">
        {!sessionId && (
          <>
            <Pill tone="neutral">No checkout session</Pill>
            <h1 className="mt-4 font-display text-[26px]">Nothing to confirm here</h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              We couldn't find a checkout to confirm. If you just paid, open your billing page to check your subscription status.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild><Link to="/billing"><CreditCard className="size-4" /> Go to billing</Link></Button>
              <Button variant="outline" asChild><Link to="/pricing">Back to pricing</Link></Button>
            </div>
          </>
        )}

        {sessionId && isLoading && (
          <p className="flex items-center gap-2 text-[13.5px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Confirming your payment with the payment provider…
          </p>
        )}

        {sessionId && failed && (
          <>
            <Pill tone="reject"><AlertTriangle className="size-3" /> Could not confirm</Pill>
            <h1 className="mt-4 font-display text-[26px]">We couldn't confirm this payment</h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              {(data as { error: string }).error} Check your billing page before retrying.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild><Link to="/billing"><CreditCard className="size-4" /> Open billing</Link></Button>
              <Button variant="outline" asChild><Link to="/pricing">Back to pricing</Link></Button>
            </div>
          </>
        )}

        {sessionId && pending && (
          <>
            <Pill tone="flag"><Loader2 className="size-3 animate-spin" /> Payment processing</Pill>
            <h1 className="mt-4 font-display text-[26px]">Your payment is settling</h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              Some payment methods take longer to clear. Complete platform access will unlock automatically when payment settles.
            </p>
          </>
        )}

        {sessionId && paid && (
          <>
            <Pill tone="seal"><CheckCircle2 className="size-3" /> Payment received</Pill>
            <h1 className="mt-4 font-display text-[26px]">CertivoIQ platform access is active</h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              Your $65,000 annual subscription includes complete access to all generally available CertivoIQ platform capabilities. Your free-review files have been retained and guided onboarding is ready.
              {!("error" in data!) && !data!.provisioned
                ? " Final provisioning is finishing up — refresh billing if access still appears limited."
                : ""}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild><Link to="/launchpad"><Rocket className="size-4" /> Start LaunchPad onboarding</Link></Button>
              <Button variant="ghost" asChild><Link to="/billing"><CreditCard className="size-4" /> Account & billing</Link></Button>
            </div>
          </>
        )}
      </Panel>
    </AppShell>
  );
}
