import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useAccount } from "@/hooks/use-account";
import { useSubscription } from "@/hooks/use-subscription";
import { createPortalSession, setCancellation } from "@/utils/payments.functions";
import { PLANS } from "@/lib/platform-data";
import { formatLimit, planKeyToPriceId, AI_DOC_OVERAGE_AMOUNT_USD } from "@/lib/plan-catalog";
import { toast } from "sonner";
import { CreditCard, ExternalLink, Clock, AlertTriangle, Undo2, Gauge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Account & Billing — CertivoIQ" },
      {
        name: "description",
        content:
          "Manage your CertivoIQ plan: see unit, property and AI document usage against your allowance, change plans, update payment details and cancel or resume your subscription.",
      },
      { property: "og:title", content: "Account & Billing — CertivoIQ" },
      {
        property: "og:description",
        content: "Plan capacity, AI document usage and subscription controls in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingPage,
});

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const tone =
    limit === null ? "bg-seal" : pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-flag" : "bg-seal";
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${tone}`}
        style={{ width: `${limit === null ? 100 : pct}%` }}
      />
    </div>
  );
}

function BillingPage() {
  const { account, loading, trialDaysLeft, trialExpired, refetch } = useAccount();
  const { subscription, isActive, isPastDue, cancelAtPeriodEnd, endsAt } = useSubscription();
  const [busy, setBusy] = useState<string | null>(null);

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
        data: {},
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank");
    });

  const toggleCancel = (cancel: boolean) =>
    run("cancel", async () => {
      const result = await setCancellation({ data: { cancel } });
      if ("error" in result) throw new Error(result.error);
      toast.success(
        cancel
          ? `Cancellation scheduled${result.endsAt ? ` for ${new Date(result.endsAt).toLocaleDateString()}` : ""}`
          : "Subscription resumed — nothing will be cancelled.",
        {
          description: cancel
            ? "Full access until the period ends, then your files are held 14 days before deletion."
            : undefined,
        },
      );
      await refetch();
    });

  const limits = account?.limits;
  const usage = account?.usage;
  const overage =
    limits?.aiDocs != null && usage ? Math.max(0, usage.aiDocsUsed - limits.aiDocs) : 0;

  return (
    <AppShell title="Account & billing" subtitle="Your plan, capacity and payment details">
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
                    {account.planName ?? (account.isTrial ? "Free trial" : "No active plan")}
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
                      <AlertTriangle className="size-3" /> Trial ended
                    </Pill>
                  )}
                  {cancelAtPeriodEnd && <Pill tone="flag">Cancels at period end</Pill>}
                </div>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                  {isActive &&
                    !cancelAtPeriodEnd &&
                    "Active. Plan changes take effect at your next renewal, so you keep the capacity you already paid for."}
                  {isActive &&
                    cancelAtPeriodEnd &&
                    `Full access until ${endsAt?.toLocaleDateString() ?? "period end"}. After that your certifications are held for 14 days, then permanently deleted.`}
                  {!isActive &&
                    account.isTrial &&
                    !trialExpired &&
                    "Your 7-day trial includes a capped portfolio and AI document allowance. Subscribe any time — everything you uploaded is kept."}
                  {!isActive &&
                    trialExpired &&
                    `Your trial has ended. Files are held until ${account.filesPurgeAt ? new Date(account.filesPurgeAt).toLocaleDateString() : "14 days after trial end"}, then permanently deleted.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isActive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openPortal}
                    disabled={busy === "portal"}
                  >
                    <CreditCard className="size-4" /> Payment details & invoices
                    <ExternalLink className="size-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" asChild>
                    <Link to="/pricing">Choose a plan</Link>
                  </Button>
                )}
                {isActive &&
                  (cancelAtPeriodEnd ? (
                    <Button
                      size="sm"
                      onClick={() => toggleCancel(false)}
                      disabled={busy === "cancel"}
                    >
                      <Undo2 className="size-4" /> Resume subscription
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleCancel(true)}
                      disabled={busy === "cancel"}
                    >
                      Cancel subscription
                    </Button>
                  ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat
                label="Units"
                value={`${usage?.unitsUsed.toLocaleString() ?? 0} / ${formatLimit(limits?.units ?? 0)}`}
              />
              <Stat
                label="Properties"
                value={`${usage?.propertiesUsed.toLocaleString() ?? 0} / ${formatLimit(limits?.properties ?? 0)}`}
              />
              <Stat
                label="Academy seats"
                value={account.academySeats === -1 ? "Property-wide" : String(account.academySeats)}
              />
            </div>
          </Panel>

          <Panel
            className="mt-4"
            title="AI document processing this period"
            description={`Included in your plan allowance; extra certifications are billed at $${AI_DOC_OVERAGE_AMOUNT_USD} each`}
            bodyClassName="p-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-[24px]">
                {usage?.aiDocsUsed.toLocaleString() ?? 0}
                <span className="text-[14px] font-normal text-muted-foreground">
                  {" "}
                  / {formatLimit(limits?.aiDocs ?? 0)} certifications
                </span>
              </p>
              <Pill tone={overage > 0 ? "flag" : "seal"}>
                <Gauge className="size-3" />
                {overage > 0
                  ? `${overage} over — $${overage * AI_DOC_OVERAGE_AMOUNT_USD} on next invoice`
                  : "Within allowance"}
              </Pill>
            </div>
            <UsageBar used={usage?.aiDocsUsed ?? 0} limit={limits?.aiDocs ?? 0} />
            <p className="cite mt-3">
              Allowance resets at the start of each billing period
              {usage?.periodStart
                ? ` (current period began ${new Date(usage.periodStart).toLocaleDateString()})`
                : ""}
              .
              {usage && usage.aiDocsBilled > 0
                ? ` ${usage.aiDocsBilled} overage certification(s) already billed this period.`
                : ""}
            </p>
          </Panel>

          <Panel
            className="mt-4"
            title="Change your plan"
            description="Plan changes are completed securely in Stripe’s hosted customer portal"
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border">
              {PLANS.map((p) => {
                const priceId = planKeyToPriceId(p.id);
                const current = account.priceId === priceId;
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div>
                      <p className="font-display text-[15px]">
                        CertivoIQ {p.name}{" "}
                        <span className="font-mono text-[12.5px] text-muted-foreground">
                          {p.price}
                          {p.cadence}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{p.tagline}</p>
                    </div>
                    {current ? (
                      <Pill tone="seal">Current plan</Pill>
                    ) : isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={openPortal}
                        disabled={busy === "portal"}
                      >
                        Manage plan <ExternalLink className="size-3.5" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/pricing">Subscribe</Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
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
