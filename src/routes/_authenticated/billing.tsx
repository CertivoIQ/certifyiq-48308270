import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useAccount } from "@/hooks/use-account";
import { useSubscription } from "@/hooks/use-subscription";
import { getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession, setCancellation } from "@/utils/payments.functions";
import { toast } from "sonner";
import { AlertTriangle, CreditCard, ExternalLink, FileText, Undo2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Account & Billing — CertivoIQ" },
      {
        name: "description",
        content:
          "Manage invoices, ACH or approved card payment, renewal, and licensing for the CertivoIQ annual platform license.",
      },
      { property: "og:title", content: "Account & Billing — CertivoIQ" },
      { property: "og:description", content: "Invoice-first annual enterprise licensing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { account, loading, refetch } = useAccount();
  const { subscription, isActive, isPastDue, cancelAtPeriodEnd, endsAt } = useSubscription();
  const [busy, setBusy] = useState<string | null>(null);
  const env = getStripeEnvironment();

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const openPortal = () =>
    run("portal", async () => {
      const result = await createPortalSession({
        data: { returnUrl: `${window.location.origin}/billing`, environment: env },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank");
    });

  const toggleCancel = (cancel: boolean) =>
    run("cancel", async () => {
      const result = await setCancellation({ data: { cancel, environment: env } });
      if ("error" in result) throw new Error(result.error);
      toast.success(
        cancel
          ? `Cancellation scheduled${result.endsAt ? ` for ${new Date(result.endsAt).toLocaleDateString()}` : ""}`
          : "Annual platform license resumed.",
      );
      await refetch();
    });

  return (
    <AppShell title="Account & billing" subtitle="Invoice-first annual enterprise licensing">
      <div className="-mt-1 mb-4 overflow-hidden rounded-lg">
        <PaymentTestModeBanner />
      </div>

      {loading && (
        <Panel bodyClassName="p-6 text-[13px] text-muted-foreground">Loading your account…</Panel>
      )}

      {!loading && account && (
        <>
          <Panel bodyClassName="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-[21px]">
                    {isActive ? "CertivoIQ annual platform license" : "No active annual license"}
                  </h2>
                  {isPastDue && (
                    <Pill tone="flag">
                      <AlertTriangle className="size-3" /> Payment action required
                    </Pill>
                  )}
                  {cancelAtPeriodEnd && <Pill tone="flag">Cancels at period end</Pill>}
                </div>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                  {isActive && !cancelAtPeriodEnd &&
                    "Active. All currently available platform features are included under the organization license."}
                  {isActive && cancelAtPeriodEnd &&
                    `Access remains active until ${endsAt?.toLocaleDateString() ?? "the end of the current period"}.`}
                  {!isActive &&
                    "CertivoIQ is offered through one $65,000 annual organization license. Enterprise purchases begin with an invoice; ACH is preferred and card payment remains available when the customer requests it."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {isActive ? (
                  <>
                    <Button size="sm" variant="outline" onClick={openPortal} disabled={busy === "portal"}>
                      <CreditCard className="size-4" /> Payment details & invoices
                      <ExternalLink className="size-3.5" />
                    </Button>
                    {cancelAtPeriodEnd ? (
                      <Button size="sm" onClick={() => toggleCancel(false)} disabled={busy === "cancel"}>
                        <Undo2 className="size-4" /> Resume license
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleCancel(true)}
                        disabled={busy === "cancel"}
                      >
                        Cancel at period end
                      </Button>
                    )}
                  </>
                ) : (
                  <Button size="sm" asChild>
                    <Link to="/contact-support">
                      <FileText className="size-4" /> Request enterprise license
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          <Panel className="mt-4" title="License & procurement terms" bodyClassName="p-5">
            <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="font-semibold">Annual price</dt>
                <dd className="mt-1 text-muted-foreground">$65,000 per organization, per year</dd>
              </div>
              <div>
                <dt className="font-semibold">Included access</dt>
                <dd className="mt-1 text-muted-foreground">All currently available platform features</dd>
              </div>
              <div>
                <dt className="font-semibold">Default payment path</dt>
                <dd className="mt-1 text-muted-foreground">Invoice + ACH / bank transfer</dd>
              </div>
              <div>
                <dt className="font-semibold">Optional payment path</dt>
                <dd className="mt-1 text-muted-foreground">Credit card when requested or permitted by procurement</dd>
              </div>
              <div>
                <dt className="font-semibold">Activation</dt>
                <dd className="mt-1 text-muted-foreground">Automatic after a qualifying paid invoice; exceptions route to review</dd>
              </div>
              <div>
                <dt className="font-semibold">Purchase orders</dt>
                <dd className="mt-1 text-muted-foreground">Supported for organizations that require PO-based procurement</dd>
              </div>
            </dl>
          </Panel>

          {subscription && (
            <p className="cite mt-4">
              Subscription {subscription.stripe_subscription_id} · status {subscription.status}
              {subscription.current_period_end
                ? ` · renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                : ""}
            </p>
          )}
        </>
      )}
    </AppShell>
  );
}
