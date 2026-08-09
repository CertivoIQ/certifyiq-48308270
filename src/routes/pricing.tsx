import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PLANS, ADDONS, ACADEMY_ADDONS, TRIAL } from "@/lib/platform-data";
import { TRIAL_OFFER, RETENTION_POLICY } from "@/lib/trial-data";
import { Check, Sparkles, Clock, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useSession } from "@/hooks/use-session";
import { useSubscription } from "@/hooks/use-subscription";
import { createPortalSession } from "@/utils/payments.functions";
import {
  ADDON_PRICE_IDS,
  PLAN_PRICE_ID_LIST,
  planKeyToPriceId,
} from "@/lib/plan-catalog";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans & Pricing — CertivoIQ Compliance Platform" },
      {
        name: "description",
        content:
          "CertivoIQ pricing: Professional at $999/month for up to 500 units, Business at $4,999/month for up to 10,000 units, Enterprise at $9,999/month, Enterprise Plus at $14,999/month, plus state rule packs, Academy training seats and API add-ons.",
      },
      { property: "og:title", content: "Plans & Pricing — CertivoIQ" },
      {
        property: "og:description",
        content:
          "Simple per-portfolio pricing with AI document processing allowances instead of confusing credits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://certivoiq.com/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/pricing" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { user } = useSession();
  const { subscription, isActive, entitlement, cancelAtPeriodEnd, endsAt } =
    useSubscription();
  const { openCheckout, closeCheckout, isOpen, checkoutElement, label } =
    useStripeCheckout();
  const [portalBusy, setPortalBusy] = useState(false);
  const navigate = useNavigate();

  const startCheckout = async (
    priceId: string | null,
    name: string,
    quantity?: number,
  ) => {
    if (!priceId) {
      toast.error("This plan is not available for self-serve checkout yet.");
      return;
    }
    // Checkout must be tied to an account: without a userId the webhook cannot
    // provision the plan, so send visitors to sign in and bring them back here.
    if (!user) {
      toast.info("Create your account first", {
        description:
          "Sign in so we can attach this subscription to your CertivoIQ workspace.",
      });
      // Remember where they were so sign-in can bring them straight back.
      sessionStorage.setItem("certivoiq:after-auth", "/pricing");
      await navigate({ to: "/auth" });
      return;
    }
    // Existing subscribers manage plan changes in Stripe's hosted portal.
    // This avoids an accidental immediate price change or a second plan.
    if (isActive && PLAN_PRICE_ID_LIST.includes(priceId) && subscription) {
      await openBillingPortal();
      return;
    }
    try {
      openCheckout({
        priceId,
        label: name,
        ...(quantity ? { quantity } : {}),
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Checkout unavailable",
      );
    }
  };

  const openBillingPortal = async () => {
    setPortalBusy(true);
    try {
      const result = await createPortalSession({
        data: {},
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not open billing",
      );
    } finally {
      setPortalBusy(false);
    }
  };

  return (
    <AppShell
      title="Plans & pricing"
      subtitle="Peace of mind before an audit — priced per portfolio, never per credit"
      actions={
        <Button size="sm" variant="outline" asChild>
          <Link to="/welcome">Why CertivoIQ</Link>
        </Button>
      }
    >
      <div className="-mt-1 mb-4 overflow-hidden rounded-lg">
        <PaymentTestModeBanner />
      </div>

      {isActive && subscription && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-seal/30 bg-seal-soft px-5 py-4">
          <div>
            <p className="font-display text-[16px]">
              Current plan: {entitlement?.name ?? subscription.price_id}
            </p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {cancelAtPeriodEnd
                ? `Cancels on ${endsAt?.toLocaleDateString() ?? "period end"} — full access until then, then files are held 14 days.`
                : "Active. Upgrades and downgrades take effect at your next renewal, so you keep the capacity you already paid for."}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={openBillingPortal}
            disabled={portalBusy}
          >
            <CreditCard className="size-4" /> Manage billing
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      )}

      {TRIAL.active && (
        <div className="mb-5 rounded-lg border border-primary/25 bg-accent px-5 py-4">
          <p className="font-display text-[16px] text-accent-foreground">
            You have {TRIAL.daysLeft} days left in your free trial
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Trials include up to {TRIAL.uploadsAllowed} tenant certification
            uploads with a full AI compliance review, findings and corrective
            measures. Choose a plan to keep unlimited reviews.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <Panel
            key={p.id}
            className={p.featured ? "glow-ring border-primary/40" : "lift"}
            bodyClassName="p-6"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[19px]">{p.name}</h2>
              {p.featured && (
                <Pill tone="seal">
                  <Sparkles className="size-3" /> Most popular
                </Pill>
              )}
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {p.tagline}
            </p>
            <p className="mt-4 font-display text-[34px] leading-none">
              <span className={p.featured ? "brand-text" : ""}>{p.price}</span>
              <span className="text-[14px] font-normal text-muted-foreground">
                {p.cadence}
              </span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone="seal">
                <Clock className="size-3" /> {TRIAL_OFFER.label}
              </Pill>
              <span className="cite">{TRIAL_OFFER.blurb}</span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Starts free for {TRIAL_OFFER.days} days on this plan — mass upload
              your portfolio during the trial and keep everything when you
              subscribe.
            </p>

            <ul className="mt-5 space-y-2.5 border-t border-border pt-4">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-[13px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-seal" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-6 w-full"
              variant={p.featured ? "default" : "outline"}
              disabled={
                portalBusy || entitlement?.priceId === planKeyToPriceId(p.id)
              }
              onClick={() => void startCheckout(planKeyToPriceId(p.id), p.name)}
            >
              {entitlement?.priceId === planKeyToPriceId(p.id)
                ? "Your current plan"
                : isActive
                  ? "Manage plan"
                  : p.cta}
            </Button>
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Premium add-ons"
          description="Recurring revenue layered on any plan"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {ADDONS.map((a) => (
              <li
                key={a.name}
                className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5"
              >
                <span className="text-[13.5px]">{a.name}</span>
                <span className="font-mono text-[12.5px] text-muted-foreground">
                  {a.price}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="CertivoIQ Academy — add-on only"
          description="Training attaches to any platform plan; there is no standalone Academy subscription"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {ACADEMY_ADDONS.map((a) => (
              <li key={a.name} className="px-5 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-[15px]">{a.name}</span>
                  <span className="font-mono text-[13px]">
                    {a.price}
                    <span className="text-muted-foreground">{a.cadence}</span>
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {a.note}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2.5"
                  onClick={() =>
                    void startCheckout(
                      a.id === "academy-seat"
                        ? ADDON_PRICE_IDS.academySeat
                        : ADDON_PRICE_IDS.academyProperty,
                      a.name,
                    )
                  }
                >
                  Add to my plan
                </Button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-5 py-4">
            <Button size="sm" variant="outline" asChild>
              <Link to="/academy">Browse the catalog</Link>
            </Button>
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title={RETENTION_POLICY.headline}
        description="Every plan starts with a 7-day free trial"
        bodyClassName="p-5"
      >
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          {RETENTION_POLICY.detail}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link to="/trial">Open my trial plan</Link>
          </Button>
        </div>
      </Panel>

      <p className="mt-5 text-[12.5px] text-muted-foreground">
        AI document processing is included as a monthly document allowance — no
        credits to track. Beyond the allowance, extra certifications are billed
        at $3 per uploaded file on every plan.
      </p>

      <Dialog open={isOpen} onOpenChange={(open) => !open && closeCheckout()}>
        <DialogContent className="max-w-3xl overflow-y-auto sm:max-h-[88vh]">
          <DialogHeader>
            <DialogTitle className="font-display">
              {label ? `Subscribe — ${label}` : "Checkout"}
            </DialogTitle>
          </DialogHeader>
          {checkoutElement}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
