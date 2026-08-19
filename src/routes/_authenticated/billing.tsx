import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, ExternalLink, Clock, AlertTriangle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useAccount } from "@/hooks/use-account";
import { useSubscription } from "@/hooks/use-subscription";
import { getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession, setCancellation } from "@/utils/payments.functions";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Account & Billing — CertivoIQ" },
      {
        name: "description",
        content:
          "Manage the CertivoIQ $65,000 annual platform subscription, payment details, invoices and renewal settings.",
      },
      { property: "og:title", content: "Account & Billing — CertivoIQ" },
      {
        property: "og:description",
        content: "One annual subscription with complete CertivoIQ platform access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { account, loading, trialDaysLeft, trialExpired, refetch } = useAccount();
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
          : "Subscription resumed — nothing will be cancelled.",
      );
      await refetch();
    });

  return (
    <AppShell title="Account & billing" subtitle="Your CertivoIQ annual subscription and payment details">
      <div className="-mt-1 mb-4 overflow-hidden rounded-lg">
        <PaymentTestModeBanner />
      </div>

      {loading && <Panel bodyClassName="p-6 text-[13px] text-muted-foreground">Loading your account…</Panel>}

      {!loading && account && (
        <>
          <Panel bodyClassName="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-[21px]">
                    {isActive ? "CertivoIQ Platform" : account.isTrial ? "Free evaluation" : "No active subscription"}
                  </h2>
                  {isPastDue && (
                    <Pill tone="flag">
                      <AlertTriangle className="size-3" /> Payment failed — retrying
                    </Pill>
                  )}
                  {account.isTrial && !trialExpired && (
                    <Pill tone="seal">
                      <Clock className="size-3" /> {trialDaysLeft} days left
                    </Pill>
                  )}
                  {trialExpired && !isActive && (
                    <Pill tone="reject">
                      <AlertTriangle className="size-3" /> Evaluation ended
                    </Pill>
                  )}
                  {cancelAtPeriodEnd && <Pill tone="flag">Cancels at period end</Pill>}
                </div>

                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                  {isActive && !cancelAtPeriodEnd &&
                    "Active at $65,000 per year. Every generally available CertivoIQ platform capability is included."}
                  {isActive && cancelAtPeriodEnd &&
                    `Full platform access continues until ${endsAt?.toLocaleDateString() ?? "period end"}.`}
                  {!isActive && account.isTrial && !trialExpired &&
                    "Your free evaluation includes 3 certification reviews. Subscribe for complete platform access."}
                  {!isActive && trialExpired &&
                    `Your evaluation has ended. Files are held until ${account.filesPurgeAt ? new Date(account.filesPurgeAt).toLocaleDateString() : "14 days after evaluation end"}, then permanently deleted.`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {isActive ? (
                  <Button size="sm" variant="outline" onClick={openPortal} disabled={busy === "portal"}>
                    <CreditCard className="size-4" /> Payment details & invoices
                    <ExternalLink className="size-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" asChild>
                    <Link to="/pricing">Subscribe — $65,000/year</Link>
                  </Button>
                )}
                {isActive &&
                  (cancelAtPeriodEnd ? (
                    <Button size="sm" onClick={() => toggleCancel(false)} disabled={busy === "cancel"}>
                      <Undo2 className="size-4" /> Resume subscription
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => toggleCancel(true)} disabled={busy === "cancel"}>
                      Cancel subscription
                    </Button>
                  ))}
              </div>
            </div>

            {isActive && (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Stat label="Annual subscription" value="$65,000" />
                <Stat label="Platform features" value="All included" />
                <Stat label="Access" value="Complete" />
              </div>
            )}
          </Panel>

          {!isActive && (
            <Panel className="mt-4" title="CertivoIQ Platform" bodyClassName="p-5">
              <p className="text-[13px] leading-6 text-muted-foreground">
                CertivoIQ has one annual subscription: $65,000/year for complete access to all generally available platform capabilities.
              </p>
              <Button className="mt-4" asChild>
                <Link to="/pricing">View annual subscription</Link>
              </Button>
            </Panel>
          )}

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
