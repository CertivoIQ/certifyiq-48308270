import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Meter } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { LAUNCHPAD_STEPS, AUDIT_JOURNEY, COACH_TIPS } from "@/lib/platform-data";
import { Check, GraduationCap, Rocket } from "lucide-react";

export const Route = createFileRoute("/launchpad")({
  head: () => ({
    meta: [
      { title: "CertivoIQ LaunchPad — Guided Setup to Audit-Ready" },
      {
        name: "description",
        content:
          "A guided 10-step wizard that takes a new operator from signup to audit-ready: organization setup, portfolio import, resident and document uploads, AI review and team invites.",
      },
      { property: "og:title", content: "CertivoIQ LaunchPad — Your guided path from signup to audit-ready" },
      {
        property: "og:description",
        content: "Ten steps, 20–30 minutes, ending in CertivoIQ Launch Certified.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://certivoiq.com/launchpad" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/launchpad" }],
  }),
  component: LaunchPadPage,
});

function LaunchPadPage() {
  const [step, setStep] = useState(1);
  const current = LAUNCHPAD_STEPS[step - 1]!;
  const pct = Math.round(((step - 1) / LAUNCHPAD_STEPS.length) * 100);
  const done = step > LAUNCHPAD_STEPS.length;

  return (
    <AppShell
      title="CertivoIQ LaunchPad"
      subtitle="Your guided path from signup to audit-ready"
      actions={<Pill tone="seal">{done ? "100% complete" : `${pct}% complete`}</Pill>}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <Panel bodyClassName="p-6">
            <div className="flex items-center gap-2">
              <Rocket className="size-4 text-primary" />
              <span className="cite text-[10.5px] uppercase tracking-[0.16em]">
                {done ? "Graduation" : `Step ${step} of ${LAUNCHPAD_STEPS.length}`}
              </span>
            </div>
            <h2 className="mt-3 font-display text-[26px] leading-tight">
              {done ? <span className="brand-text">You are officially live on CertivoIQ</span> : current.title}
            </h2>
            <p className="mt-2 text-[14.5px]">{done ? "Awarded: CertivoIQ Launch Certified." : current.lead}</p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {done
                ? "Your Smart Success Coach now checks in for the next 90 days."
                : current.detail}
            </p>

            <div className="mt-6">
              <Meter value={done ? 100 : pct} tone="seal" />
              <div className="mt-2 flex flex-wrap gap-1">
                {LAUNCHPAD_STEPS.map((s) => (
                  <span
                    key={s.id}
                    className={`h-2 w-6 rounded-full ${done || s.id < step ? "bg-seal" : s.id === step ? "bg-primary" : "bg-muted"}`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {step > 1 && !done && (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              {done ? (
                <>
                  <Button asChild>
                    <Link to="/dashboard">Open my dashboard</Link>
                  </Button>
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Restart wizard
                  </Button>
                </>
              ) : (
                <Button onClick={() => setStep((s) => s + 1)}>{current.cta}</Button>
              )}
            </div>
          </Panel>

          {done && (
            <Panel bodyClassName="p-7">
              <div className="rounded-lg border-2 border-primary/40 p-6 text-center">
                <GraduationCap className="mx-auto size-7 text-primary" />
                <p className="cite mt-3 text-[10.5px] uppercase tracking-[0.24em]">CertivoIQ LaunchPad</p>
                <h3 className="mt-3 font-display text-[24px]">Launch Certified</h3>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Meridian Housing Partners · onboarding completed Aug 6, 2026
                </p>
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Audit Readiness Journey">
            <ul className="space-y-2.5">
              {AUDIT_JOURNEY.map((j) => (
                <li key={j.label} className="flex items-center gap-2.5 text-[13px]">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full ${j.done ? "bg-seal text-primary-foreground" : "border border-border bg-muted"}`}
                  >
                    {j.done && <Check className="size-3" />}
                  </span>
                  <span className={j.done ? "" : "text-muted-foreground"}>{j.label}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Smart Success Coach" description="First 90 days of proactive check-ins">
            <ul className="space-y-3">
              {COACH_TIPS.map((t) => (
                <li key={t.day} className="border-b border-border pb-2.5 last:border-0 last:pb-0">
                  <p className="cite">{t.day}</p>
                  <p className="mt-0.5 text-[12.5px]">{t.text}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
