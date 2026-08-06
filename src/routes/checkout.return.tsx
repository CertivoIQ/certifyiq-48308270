import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Rocket, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/checkout/return")({
  head: () => ({
    meta: [
      { title: "Subscription Confirmed — CertifyIQ" },
      {
        name: "description",
        content:
          "Your CertifyIQ subscription is active. Your uploaded certifications are retained and LaunchPad onboarding is ready to begin.",
      },
      { property: "og:title", content: "Subscription Confirmed — CertifyIQ" },
      {
        property: "og:description",
        content: "Plan capacity unlocked, trial files kept, and guided onboarding started.",
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

  return (
    <AppShell title="Checkout" subtitle="Payment confirmation">
      <Panel bodyClassName="p-8">
        {sessionId ? (
          <>
            <Pill tone="seal">
              <CheckCircle2 className="size-3" /> Payment received
            </Pill>
            <h1 className="mt-4 font-display text-[26px]">You're audit-ready — subscription active</h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              Your plan capacity is unlocked, every certification you uploaded during the trial has been kept (the
              14-day deletion hold is cleared), and your guided onboarding has started.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/launchpad">
                  <Rocket className="size-4" /> Start LaunchPad onboarding
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/academy">
                  <GraduationCap className="size-4" /> Open CertifyIQ Academy
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/">Go to dashboard</Link>
              </Button>
            </div>
            <p className="cite mt-6">Reference: {sessionId}</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-[24px]">No checkout session found</h1>
            <p className="mt-2 text-[13.5px] text-muted-foreground">
              This page confirms a completed checkout. Head back to plans to pick one.
            </p>
            <Button className="mt-5" asChild>
              <Link to="/pricing">Back to plans &amp; pricing</Link>
            </Button>
          </>
        )}
      </Panel>
    </AppShell>
  );
}
