import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PLANS, ADDONS, ACADEMY_ADDONS, SALES_ASSISTED_ADDONS, SALES_EMAIL } from "@/lib/platform-data";
import { Check, Sparkles, CreditCard, ExternalLink, Mail } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useSession } from "@/hooks/use-session";
import { useSubscription } from "@/hooks/use-subscription";
import { getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession, changePlan, addAddonToSubscription } from "@/utils/payments.functions";
import { ADDON_PRICE_IDS, PLAN_PRICE_ID_LIST, planKeyToPriceId } from "@/lib/plan-catalog";
import type { StripeEnv } from "@/lib/stripe.server";

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
        content: "Simple per-portfolio pricing with AI document processing allowances instead of confusing credits. Start with 3 free certification reviews.",
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
  const { subscription, isActive, entitlement, cancelAtPeriodEnd, endsAt } = useSubscription();
  const { openCheckout, closeCheckout, isOpen, checkoutElement, label } = useStripeCheckout();
  const [portalBusy, setPortalBusy] = useState(false);
  const [planBusy, setPlanBusy] = useState<string | null>(null);
  const [addonBusy, setAddonBusy] = useState<string | null>(null);
  const [academySeats, setAcademySeats] = useState(1);
  const [academyProperties, setAcademyProperties] = useState(1);
  const navigate = useNavigate();

  const startCheckout = async (priceId: string | null, name: string, quantity?: number) => {
    if (!priceId) {
      toast.error("This plan is not available for self-serve checkout yet.");
      return;
    }
    if (!user) {
      toast.info("Create your account first", {
        description: "Sign in so we can attach this subscription to your CertivoIQ workspace.",
      });
      sessionStorage.setItem("certivoiq:after-auth", "/pricing");
      await navigate({ to: "/auth" });
      return;
    }
    if (isActive && PLAN_PRICE_ID_LIST.includes(priceId) && subscription) {
      setPlanBusy(priceId);
      try {
        const result = await changePlan({
          data: { priceId, environment: getStripeEnvironment() },
        });
        if ("error" in result) throw new Error(result.error);
        toast.success(`Switching to ${name}`, {
          description: result.effectiveAt
            ? `Effective ${new Date(result.effectiveAt).toLocaleDateString()} — your current capacity stays until then.`
            : "Effective at your next renewal.",
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not change plan");
      } finally {
        setPlanBusy(null);
      }
      return;
    }
    if (isActive && subscription && !PLAN_PRICE_ID_LIST.includes(priceId)) {
      setAddonBusy(priceId);
      try {
        const addonPayload: { priceId: string; environment: StripeEnv; quantity?: number } = {
          priceId,
          environment: getStripeEnvironment(),
        };
        if (quantity) addonPayload.quantity = quantity;
        const result = await addAddonToSubscription({ data: addonPayload });
        if ("error" in result) throw new Error(result.error);
        toast.success(`${name} added to your plan`, {
          description: result.effectiveAt
            ? `Billing begins on your next renewal (${new Date(result.effectiveAt).toLocaleDateString()}).`
            : "Billing begins on your next renewal.",
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add add-on");
      } finally {
        setAddonBusy(null);
      }
      return;
    }
    if (!isActive && !PLAN_PRICE_ID_LIST.includes(priceId)) {
      toast.info("Choose a plan first", {
        description: "Add-ons attach to an active CertivoIQ subscription. Select a plan above, then add Academy seats or properties.",
      });
      return;
    }
    try {
      openCheckout({
        priceId,
        label: name,
        ...(quantity ? { quantity } : {}),
        ...(user.email ? { customerEmail: user.email } : {}),
        userId: user.id,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout unavailable");
    }
  };

  const openBillingPortal = async () => {
    setPortalBusy(true);
    try {
      const result = await createPortalSession({
        data: { returnUrl: `${window.location.origin}/pricing`, environment: getStripeEnvironment() },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open billing");
    } finally {
      setPortalBusy(false);
    }
  };

  return (
    <PublicShell
      title="Plans & pricing"
      subtitle="Peace of mind before an audit — priced per portfolio, never per credit"
    >
      <div className="-mt-1 mb-4 overflow-hidden rounded-lg">
        <PaymentTestModeBanner />
      </div>

      <div className="mb-5 rounded-lg border border-primary/25 bg-accent px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-[17px] text-accent-foreground">Start with 3 free certification reviews</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Run three real certification files through CertivoIQ, inspect the evidence trail, and decide whether the platform belongs in your compliance workflow. No countdown or 7-day trial.
            </p>
          </div>
          <Button size="sm" asChild>
            <Link to="/trial">Run 3 free reviews</Link>
          </Button>
        </div>
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
          <Button size="sm" variant="outline" onClick={openBillingPortal} disabled={portalBusy}>
            <CreditCard className="size-4" /> Manage billing
            <ExternalLink className="size-3.5" />
          </Button>
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
            <p className="mt-1 text-[12.5px] text-muted-foreground">{p.tagline}</p>
            <p className="mt-4 font-display text-[34px] leading-none">
              <span className={p.featured ? "brand-text" : ""}>{p.price}</span>
              <span className="text-[14px] font-normal text-muted-foreground">{p.cadence}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone="seal">
                <Sparkles className="size-3" /> 3 free certification reviews
              </Pill>
              <span className="cite">Proof of value before you choose a paid plan.</span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Start with three real certification reviews, see the evidence and findings on your own files, then choose the plan that fits your portfolio.
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
                planBusy === planKeyToPriceId(p.id) || entitlement?.priceId === planKeyToPriceId(p.id)
              }
              onClick={() => void startCheckout(planKeyToPriceId(p.id), p.name)}
            >
              {entitlement?.priceId === planKeyToPriceId(p.id)
                ? "Your current plan"
                : isActive
                  ? `Switch to ${p.name}`
                  : p.cta}
            </Button>
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Self-serve add-ons"
          description="Purchased instantly with your plan — billed on your next renewal"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {ADDONS.map((a) => (
              <li key={a.name} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5">
                <span className="text-[13.5px]">{a.name}</span>
                <span className="font-mono text-[12.5px] text-muted-foreground">{a.price}</span>
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
            {ACADEMY_ADDONS.map((a) => {
              const isSeat = a.id === "academy-seat";
              const priceId = isSeat ? ADDON_PRICE_IDS.academySeat : ADDON_PRICE_IDS.academyProperty;
              const quantity = isSeat ? academySeats : academyProperties;
              const setQuantity = isSeat ? setAcademySeats : setAcademyProperties;
              const label = isSeat ? "Seats" : "Properties";

              return (
                <li key={a.name} className="px-5 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-[15px]">{a.name}</span>
                    <span className="font-mono text-[13px]">
                      {a.price}
                      <span className="text-muted-foreground">{a.cadence}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">{a.note}</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <label htmlFor={`qty-${a.id}`} className="text-[12.5px] text-muted-foreground">
                      {label}
                    </label>
                    <input
                      id={`qty-${a.id}`}
                      type="number"
                      min={1}
                      max={100}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                      className="h-8 w-20 rounded-md border border-input bg-background px-2 text-[12.5px]"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2.5"
                    disabled={addonBusy === priceId}
                    onClick={() => void startCheckout(priceId, a.name, quantity)}
                  >
                    {addonBusy === priceId ? "Adding..." : "Add to my plan"}
                  </Button>
                </li>
              );
            })}
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
        title="Contact-sales add-ons — custom quote"
        description="Not available through self-serve checkout; our team scopes and provisions these for you"
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-border">
          {SALES_ASSISTED_ADDONS.map((a) => (
            <li key={a.id} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="font-display text-[15px]">{a.name}</span>
                <span className="font-mono text-[13px]">
                  {a.price}
                  <span className="text-muted-foreground">{a.cadence}</span>
                </span>
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{a.note}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Pill tone="seal">Sales-assisted</Pill>
                <Button size="sm" variant="outline" asChild>
                  <a href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(a.subject)}`}>
                    <Mail className="size-4" /> Contact Sales
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-5 py-4">
          <p className="text-[12.5px] text-muted-foreground">
            These add-ons are quoted individually and billed through your existing CertivoIQ agreement — they are not
            purchased with a card at checkout. Email{" "}
            <a className="underline" href={`mailto:${SALES_EMAIL}`}>
              {SALES_EMAIL}
            </a>{" "}
            and we will confirm scope and pricing.
          </p>
        </div>
      </Panel>

      <Panel
        className="mt-4"
        title="Start with proof, then scale"
        description="Three free certification reviews — no countdown or 7-day trial"
        bodyClassName="p-5"
      >
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Run three real certification files through CertivoIQ, inspect the evidence trail, and decide whether the platform earns a place in your compliance workflow. When you are ready, choose the plan that fits your portfolio.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link to="/trial">Run 3 free certification reviews</Link>
          </Button>
        </div>
      </Panel>

      <Panel className="mt-4" title="Billing FAQ" description="How charges and plan changes work" bodyClassName="p-5">
        <dl className="grid gap-4 text-[13px]">
          <div>
            <dt className="font-semibold">Add-ons and billing timing</dt>
            <dd className="mt-0.5 text-muted-foreground">
              Add-ons attach to your existing subscription and are billed on your next regular renewal — no separate charge today. Think of it as buy-now, pay-later on the next cycle.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Plan upgrades and downgrades</dt>
            <dd className="mt-0.5 text-muted-foreground">
              Plan changes take effect at your next renewal with no mid-cycle proration, so your current capacity stays active until then.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Cancellation</dt>
            <dd className="mt-0.5 text-muted-foreground">
              You keep access until the end of your paid period. After the period ends, uploaded files are retained for 14 days, then permanently removed.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">AI document overages</dt>
            <dd className="mt-0.5 text-muted-foreground">
              Every plan includes a monthly AI document allowance. Files uploaded beyond that allowance are billed at $3 per certification regardless of plan.
            </dd>
          </div>
        </dl>
      </Panel>

      <p className="mt-5 text-[12.5px] text-muted-foreground">
        AI document processing is included as a monthly document allowance — no credits to track. Beyond the allowance,
        extra certifications are billed at $3 per uploaded file on every plan.
      </p>

      <Dialog open={isOpen} onOpenChange={(open) => !open && closeCheckout()}>
        <DialogContent className="max-w-3xl overflow-y-auto sm:max-h-[88vh]">
          <DialogHeader>
            <DialogTitle className="font-display">{label ? `Subscribe — ${label}` : "Checkout"}</DialogTitle>
          </DialogHeader>
          {checkoutElement}
        </DialogContent>
      </Dialog>
    </PublicShell>
  );
}
