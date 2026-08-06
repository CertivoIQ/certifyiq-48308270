import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PLANS, ADDONS, ACADEMY_ADDONS, TRIAL } from "@/lib/platform-data";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans & Pricing — CertifyIQ Compliance Platform" },
      {
        name: "description",
        content:
          "CertifyIQ pricing: Business at $1,499/month for up to 5,000 units, Enterprise from $4,999/month, plus state rule packs, Academy training seats and API add-ons.",
      },
      { property: "og:title", content: "Plans & Pricing — CertifyIQ" },
      {
        property: "og:description",
        content: "Simple per-portfolio pricing with AI document processing allowances instead of confusing credits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <AppShell
      title="Plans & pricing"
      subtitle="Peace of mind before an audit — priced per portfolio, never per credit"
      actions={
        <Button size="sm" variant="outline" asChild>
          <Link to="/welcome">Why CertifyIQ</Link>
        </Button>
      }
    >
      {TRIAL.active && (
        <div className="mb-5 rounded-lg border border-primary/25 bg-accent px-5 py-4">
          <p className="font-display text-[16px] text-accent-foreground">
            You have {TRIAL.daysLeft} days left in your free trial
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Trials include up to {TRIAL.uploadsAllowed} tenant certification uploads with a full AI compliance review,
            findings and corrective measures. Choose a plan to keep unlimited reviews.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
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
              onClick={() => toast.success(`${p.name} selected`, { description: "A specialist will confirm your setup." })}
            >
              {p.cta}
            </Button>
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Premium add-ons" description="Recurring revenue layered on any plan" bodyClassName="p-0">
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
          title="CertifyIQ Academy subscriptions"
          description="Compliance training as its own recurring revenue stream"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {ACADEMY_PLANS.map((a) => (
              <li key={a.name} className="px-5 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-[15px]">{a.name}</span>
                  <span className="font-mono text-[13px]">
                    {a.price}
                    <span className="text-muted-foreground">{a.cadence}</span>
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">{a.note}</p>
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

      <p className="mt-5 text-[12.5px] text-muted-foreground">
        AI document processing is included as a monthly document allowance — no credits to track.
      </p>
    </AppShell>
  );
}
