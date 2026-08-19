import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, CreditCard, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PublicShell } from "@/components/public-shell";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useSession } from "@/hooks/use-session";
import { useSubscription } from "@/hooks/use-subscription";
import { getStripeEnvironment } from "@/lib/stripe";
import { PLATFORM_PRICE_ID } from "@/lib/plan-catalog";
import { createPortalSession } from "@/utils/payments.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — CertivoIQ Compliance Platform" },
      {
        name: "description",
        content:
          "CertivoIQ is $65,000 per year for the complete affordable-housing compliance intelligence platform. One annual subscription includes every platform capability.",
      },
      { property: "og:title", content: "CertivoIQ Pricing — $65,000/year" },
      {
        property: "og:description",
        content: "One platform. One annual price. Every CertivoIQ capability included.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://certivoiq.com/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/pricing" }],
  }),
  component: PricingPage,
});

const INCLUDED_FEATURES = [
  "AI-assisted certification and document review",
  "LIHTC, HUD, Section 8/HCVP, HOTMA and supported state compliance rules",
  "Deterministic compliance rule engine and traceable evidence lineage",
  "Compliance findings, remediation workflows and human approval controls",
  "Owner and portfolio compliance intelligence dashboards",
  "Audit-readiness scoring and mock-audit workflows",
  "Recurring-finding and property training-risk intelligence",
  "Mass document and certification processing",
  "Evidence manifests, reporting and audit trails",
  "CertivoIQ Academy and platform training capabilities",
  "API, SSO and supported integration capabilities",
  "All current and future generally available platform features",
] as const;

function PricingPage() {
  const { user } = useSession();
  const { subscription, isActive, cancelAtPeriodEnd, endsAt } = useSubscription();
  const { openCheckout, closeCheckout, isOpen, checkoutElement, label } = useStripeCheckout();
  const [portalBusy, setPortalBusy] = useState(false);
  const navigate = useNavigate();

  const startCheckout = async () => {
    if (!user) {
      toast.info("Create your account first", {
        description: "Sign in so we can attach the CertivoIQ subscription to your workspace.",
      });
      sessionStorage.setItem("certivoiq:after-auth", "/pricing");
      await navigate({ to: "/auth" });
      return;
    }

    try {
      openCheckout({
        priceId: PLATFORM_PRICE_ID,
        label: "CertivoIQ Platform — Annual",
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
      title="Simple annual pricing"
      subtitle="One platform. One price. Every capability."
    >
      <div className="-mt-1 mb-4 overflow-hidden rounded-lg">
        <PaymentTestModeBanner />
      </div>

      <div className="mb-5 rounded-lg border border-primary/25 bg-accent px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-[17px] text-accent-foreground">Start with 3 FREE certification reviews</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Review three real certification files before purchasing the annual platform subscription.
            </p>
          </div>
          <Button size="sm" asChild>
            <Link to="/trial">Review Your 3 FREE Certifications</Link>
          </Button>
        </div>
      </div>

      {isActive && subscription && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-seal/30 bg-seal-soft px-5 py-4">
          <div>
            <p className="font-display text-[16px]">CertivoIQ Platform subscription active</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {cancelAtPeriodEnd
                ? `Cancels on ${endsAt?.toLocaleDateString() ?? "period end"} — full platform access continues until then.`
                : "Every generally available CertivoIQ platform capability is included in your subscription."}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={openBillingPortal} disabled={portalBusy}>
            <CreditCard className="size-4" /> Manage billing
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      )}

      <div className="mx-auto max-w-3xl">
        <Panel className="glow-ring border-primary/40" bodyClassName="p-7 sm:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[25px]">CertivoIQ Platform</h2>
            <Pill tone="seal">
              <Sparkles className="size-3" /> Complete access
            </Pill>
          </div>

          <p className="mt-2 text-[14px] text-muted-foreground">
            Complete affordable-housing compliance intelligence for organizations that need enterprise-grade review, audit readiness and portfolio oversight.
          </p>

          <div className="mt-6 flex items-end gap-2">
            <span className="font-display text-[46px] leading-none brand-text">$65,000</span>
            <span className="pb-1 text-[15px] text-muted-foreground">/ year</span>
          </div>

          <p className="mt-3 text-[13px] font-medium">No feature tiers. No feature upgrades. No add-on gates.</p>

          <ul className="mt-7 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
            {INCLUDED_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2 text-[13px] leading-5">
                <Check className="mt-0.5 size-4 shrink-0 text-seal" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            {isActive ? (
              <Button onClick={openBillingPortal} disabled={portalBusy}>
                <CreditCard className="size-4" /> Manage subscription
              </Button>
            ) : (
              <Button onClick={() => void startCheckout()}>Subscribe — $65,000/year</Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/contact-support">Talk to CertivoIQ</Link>
            </Button>
          </div>

          <p className="mt-5 text-[11.5px] leading-5 text-muted-foreground">
            Annual subscription price is $65,000. All generally available platform features are included. Contracted implementation services or customer-specific development may be separately scoped in a written agreement.
          </p>
        </Panel>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-background p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-[17px]">{label ?? "CertivoIQ Platform"}</p>
                <p className="text-[12px] text-muted-foreground">Secure annual subscription checkout</p>
              </div>
              <Button size="sm" variant="ghost" onClick={closeCheckout}>Close</Button>
            </div>
            {checkoutElement}
          </div>
        </div>
      )}
    </PublicShell>
  );
}
