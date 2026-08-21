import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, LifeBuoy, Loader2, Rocket, UploadCloud } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Meter, Panel, Pill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { LAUNCHPAD_STEPS } from "@/lib/platform-data";

export const Route = createFileRoute("/launchpad")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("certivoiq:after-auth", "/launchpad");
      }
      throw redirect({ to: "/auth", search: { mode: "signin" } });
    }
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "CertivoIQ LaunchPad — Self-Directed Account Setup" },
      {
        name: "description",
        content:
          "Persistent, self-directed CertivoIQ onboarding for organization setup, portfolio configuration, certification review, team access, and support.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LaunchPadPage,
});

function LaunchPadPage() {
  const { user } = Route.useRouteContext();
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      setLoading(true);
      setError(null);

      const { data, error: loadError } = await supabase
        .from("customer_onboarding_progress")
        .select("current_step, completed_steps, completed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (loadError) {
        setError("Your onboarding progress could not be loaded.");
        setLoading(false);
        return;
      }

      if (data) {
        setStep(Math.max(1, Math.min(LAUNCHPAD_STEPS.length, data.current_step)));
        setCompletedSteps(data.completed_steps ?? []);
        setCompletedAt(data.completed_at);
        setLoading(false);
        return;
      }

      const { error: createError } = await supabase
        .from("customer_onboarding_progress")
        .insert({
          user_id: user.id,
          current_step: 1,
          completed_steps: [],
          completed_at: null,
        });

      if (cancelled) return;
      if (createError) {
        setError("Your onboarding checklist could not be started.");
      }
      setLoading(false);
    }

    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  async function saveProgress(
    nextStep: number,
    nextCompletedSteps: number[],
    nextCompletedAt: string | null,
  ) {
    setSaving(true);
    setError(null);

    const { error: saveError } = await supabase
      .from("customer_onboarding_progress")
      .upsert(
        {
          user_id: user.id,
          current_step: nextStep,
          completed_steps: nextCompletedSteps,
          completed_at: nextCompletedAt,
        },
        { onConflict: "user_id" },
      );

    if (saveError) {
      setError("Your progress was not saved. Please try again before leaving this page.");
      setSaving(false);
      return false;
    }

    setStep(nextStep);
    setCompletedSteps(nextCompletedSteps);
    setCompletedAt(nextCompletedAt);
    setSaving(false);
    return true;
  }

  async function continueSetup() {
    const currentId = LAUNCHPAD_STEPS[step - 1]!.id;
    const nextCompletedSteps = Array.from(
      new Set([...completedSteps, currentId]),
    ).sort((a, b) => a - b);
    const finishing = step === LAUNCHPAD_STEPS.length;

    await saveProgress(
      finishing ? step : step + 1,
      nextCompletedSteps,
      finishing ? new Date().toISOString() : completedAt,
    );
  }

  async function goBack() {
    await saveProgress(Math.max(1, step - 1), completedSteps, completedAt);
  }

  async function restartSetup() {
    await saveProgress(1, [], null);
  }

  if (loading) {
    return (
      <AppShell
        title="CertivoIQ LaunchPad"
        subtitle="Self-directed account setup"
      >
        <Panel bodyClassName="flex items-center gap-3 p-6">
          <Loader2 className="size-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your saved onboarding progress…</p>
        </Panel>
      </AppShell>
    );
  }

  const done = completedAt !== null;
  const current = LAUNCHPAD_STEPS[Math.min(step - 1, LAUNCHPAD_STEPS.length - 1)]!;
  const pct = done
    ? 100
    : Math.round((completedSteps.length / LAUNCHPAD_STEPS.length) * 100);

  return (
    <AppShell
      title="CertivoIQ LaunchPad"
      subtitle="Self-directed setup with progress saved automatically"
      actions={<Pill tone="seal">{done ? "Setup complete" : `${pct}% complete`}</Pill>}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Panel bodyClassName="p-6">
            <div className="flex items-center gap-2">
              <Rocket className="size-4 text-primary" />
              <span className="cite text-[10.5px] uppercase tracking-[0.16em]">
                {done ? "Operational setup" : `Step ${step} of ${LAUNCHPAD_STEPS.length}`}
              </span>
            </div>

            <h2 className="mt-3 font-display text-[26px] leading-tight">
              {done ? (
                <span className="brand-text">Your CertivoIQ setup checklist is complete</span>
              ) : (
                current.title
              )}
            </h2>
            <p className="mt-2 text-[14.5px]">
              {done
                ? "You can begin using the workflows authorized for your account."
                : current.lead}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {done
                ? "This confirms account setup only. It is not a training certificate, compliance determination, or certification approval."
                : current.detail}
            </p>

            <div className="mt-6">
              <Meter value={pct} tone="seal" />
              <div className="mt-2 flex flex-wrap gap-1">
                {LAUNCHPAD_STEPS.map((item) => {
                  const complete = completedSteps.includes(item.id);
                  return (
                    <span
                      key={item.id}
                      className={`h-2 w-8 rounded-full ${
                        complete
                          ? "bg-seal"
                          : item.id === step && !done
                            ? "bg-primary"
                            : "bg-muted"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              {!done && step > 1 ? (
                <Button variant="outline" onClick={() => void goBack()} disabled={saving}>
                  Back
                </Button>
              ) : null}

              {done ? (
                <>
                  <Button asChild>
                    <Link to="/compliance-intelligence">
                      <UploadCloud className="size-4" /> Open certification review
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/dashboard">Open dashboard</Link>
                  </Button>
                  <Button variant="outline" onClick={() => void restartSetup()} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    Review setup again
                  </Button>
                </>
              ) : (
                <Button onClick={() => void continueSetup()} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {current.cta}
                </Button>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Setup checklist">
            <ul className="space-y-2.5">
              {LAUNCHPAD_STEPS.map((item) => {
                const complete = completedSteps.includes(item.id);
                return (
                  <li key={item.id} className="flex items-center gap-2.5 text-[13px]">
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full ${
                        complete
                          ? "bg-seal text-primary-foreground"
                          : "border border-border bg-muted"
                      }`}
                    >
                      {complete ? <Check className="size-3" /> : null}
                    </span>
                    <span className={complete ? "" : "text-muted-foreground"}>
                      {item.title}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel
            title="Self-service support"
            description="SupportIQ answers routine product questions and creates a structured case for issues requiring review."
          >
            <Button variant="outline" asChild>
              <Link to="/supportiq">
                <LifeBuoy className="size-4" /> Open SupportIQ
              </Link>
            </Button>
          </Panel>

          <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
            Do not enter passwords, payment-card numbers, or unnecessary resident information in onboarding or support messages.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
