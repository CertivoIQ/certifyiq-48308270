import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { FreeReviewLeadGate } from "@/components/FreeReviewLeadGate";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { MerlinSays } from "@/components/merlin";
import { TRIAL } from "@/lib/platform-data";
import { TRIAL_TASKS, TRIAL_INVITES, INVITE_ROLES } from "@/lib/trial-data";
import { Check, Clock, UploadCloud, Link2, Send, FileSpreadsheet } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
import { getStripeEnvironment } from "@/lib/stripe";
import { claimCapacity, recordAiDocuments } from "@/utils/entitlements.functions";
import { formatLimit } from "@/lib/plan-catalog";
import { toast } from "sonner";

export const Route = createFileRoute("/trial")({
  head: () => ({
    meta: [
      { title: "Your 3 FREE Certification Reviews — CertivoIQ" },
      {
        name: "description",
        content:
          "Use three free CertivoIQ certification reviews to see extracted evidence, rule evaluation, cited findings and correction steps on your own files.",
      },
      { property: "og:title", content: "Your 3 Free CertivoIQ Certification Reviews" },
      {
        property: "og:description",
        content: "Run three real certification files through CertivoIQ before choosing a paid plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://certivoiq.com/trial" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/trial" }],
  }),
  component: TrialPage,
});

function TrialPage() {
  const [done, setDone] = useState<string[]>(["learn"]);
  const [enterprise, setEnterprise] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { account, refetch } = useAccount();
  const tasks = TRIAL_TASKS.filter((t) => enterprise || !t.enterpriseOnly);
  const complete = tasks.filter((t) => done.includes(t.id)).length;
  const reviewsUsed = account?.usage.aiDocsUsed ?? 0;
  const reviewsAllowed = account ? formatLimit(account.limits.aiDocs) : TRIAL.uploadsAllowed;

  const toggle = (id: string, title: string) =>
    setDone((d) => {
      if (d.includes(id)) return d.filter((x) => x !== id);
      toast.success("Merlin approves", { description: `${title} — checked off your free review plan.` });
      return [...d, id];
    });

  const uploadPortfolio = async () => {
    setUploading(true);
    try {
      const rows = 1248;
      const capacity = await claimCapacity({ data: { kind: "property", amount: 1, environment: getStripeEnvironment() } });
      if ("error" in capacity) throw new Error(capacity.error);
      if (!capacity.allowed) {
        toast.error("Portfolio limit reached", { description: capacity.reason ?? "Choose a plan with more capacity to import these properties." });
        return;
      }
      const metered = await recordAiDocuments({ data: { count: 1, environment: getStripeEnvironment() } });
      if ("error" in metered) {
        toast.error("Upload blocked", { description: metered.error });
        return;
      }
      toast.success(`Merlin mapped ${rows.toLocaleString()} rows`, {
        description: metered.billedNow > 0 ? `Columns matched. ${metered.billedNow} certification(s) beyond your allowance were added to your next invoice.` : "Columns matched to CertivoIQ fields — confirm the preview to import.",
      });
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppShell
      title="Your 3 FREE certification reviews"
      subtitle={`${TRIAL.uploadsAllowed} real files · cited findings · human approval · Merlin is your guide`}
      actions={<Button size="sm" asChild><Link to="/pricing">Choose a plan</Link></Button>}
    >
      <FreeReviewLeadGate>
        <MerlinSays pose="greeting" size="lg" className="mb-5">
          <p>
            Welcome! You have <strong>{TRIAL.uploadsAllowed} FREE certification reviews</strong> to test the real CertivoIQ workflow on your own files. I’ll help you see what the AI extracts, which rules apply, what it finds, and what your reviewer should do next.
          </p>
          <p className="mt-2 text-muted-foreground">No countdown. Use the reviews when you're ready, then choose a plan if CertivoIQ earns a place in your workflow.</p>
        </MerlinSays>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Free reviews available" value={`${Math.max(0, Number(reviewsAllowed) - reviewsUsed)}`} />
          <Stat label="Review steps complete" value={`${complete} of ${tasks.length}`} />
          <Stat label="Free AI reviews used" value={`${reviewsUsed} of ${reviewsAllowed}`} />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" variant={enterprise ? "default" : "outline"} onClick={() => setEnterprise(true)}>Enterprise workspace</Button>
          <Button size="sm" variant={enterprise ? "outline" : "default"} onClick={() => setEnterprise(false)}>Standard workspace</Button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel title="Merlin's free-review plan" description="Work top to bottom — nothing here takes longer than a coffee" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {tasks.map((t) => {
                const isDone = done.includes(t.id);
                return (
                  <li key={t.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                    <button type="button" onClick={() => toggle(t.id, t.title)} aria-label={`Mark ${t.title} complete`} className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${isDone ? "border-seal bg-seal-soft text-seal" : "border-border text-transparent hover:border-primary"}`}><Check className="size-3.5" /></button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className={`font-display text-[16px] ${isDone ? "text-muted-foreground line-through" : ""}`}>{t.title}</h3><Pill tone="neutral"><Clock className="size-3" /> {t.minutes} min</Pill>{t.enterpriseOnly && <Pill tone="seal">Enterprise</Pill>}</div>
                      <p className="mt-1 text-[13px] text-muted-foreground">{t.lead}</p>
                      <p className="mt-1.5 text-[12.5px] italic text-gold">“{t.merlin}”</p>
                    </div>
                    <Button size="sm" variant="outline" asChild><Link to={t.to}>{t.cta}</Link></Button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <div className="space-y-4">
            <Panel title="Portfolio import" description="Optional setup for teams that want to see the broader workflow" bodyClassName="p-5">
              <div className="rounded-lg border border-dashed border-primary/40 bg-accent/60 px-4 py-6 text-center">
                <UploadCloud className="mx-auto size-7 text-primary" strokeWidth={1.6} />
                <p className="mt-2 font-display text-[15px]">Drop your rent roll or property export</p>
                <p className="cite mt-1">XLSX · CSV · Yardi / RealPage / MRI exports</p>
                <Button size="sm" className="mt-3" disabled={uploading} onClick={() => void uploadPortfolio()}><FileSpreadsheet className="size-4" /> Upload portfolio file</Button>
              </div>
              <p className="mt-3 text-[12.5px] text-muted-foreground">Property records are subject to your account capacity. AI certification review is limited to {reviewsAllowed} free reviews until you choose a paid plan.</p>
            </Panel>

            <Panel title="Delegate onboarding" description="Enterprise workspaces can send secure upload links instead of doing it all themselves" bodyClassName="p-5">
              <ul className="space-y-2">{INVITE_ROLES.map((r) => <li key={r.id} className="flex items-baseline justify-between gap-3 text-[13px]"><span>{r.label}</span><span className="cite">{r.scope}</span></li>)}</ul>
              <Button size="sm" className="mt-4 w-full" onClick={() => toast.success("4 onboarding links sent", { description: "Each recipient uploads only their own properties." })}><Send className="size-4" /> Send onboarding links</Button>
            </Panel>
          </div>
        </div>

        <Panel className="mt-4" title="Team onboarding progress" description="Who you invited and how far they've gotten" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {TRIAL_INVITES.map((i) => (
              <li key={i.email} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
                <div className="min-w-0 flex-1"><p className="text-[13.5px] font-medium">{i.name} <span className="text-muted-foreground">· {i.role}</span></p><p className="cite">{i.email} · {i.scope}</p></div>
                <Pill tone={i.status === "uploaded" ? "seal" : i.status === "in progress" ? "flag" : "neutral"}>{i.status}</Pill>
                <Button size="sm" variant="ghost" onClick={() => toast.success("Link copied", { description: `Onboarding link for ${i.name}.` })}><Link2 className="size-4" /> Copy link</Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="mt-4" title="What happens next" description="No trial countdown or expiration message — the offer is based on review usage" bodyClassName="p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border px-4 py-3"><p className="cite">01 · REVIEW</p><p className="mt-1 font-display text-[14.5px]">Run up to 3 real certifications</p><p className="mt-1 text-[12.5px] text-muted-foreground">See evidence, rules, findings and corrections.</p></div>
            <div className="rounded-lg border border-border px-4 py-3"><p className="cite">02 · DECIDE</p><p className="mt-1 font-display text-[14.5px]">Judge the value on your own work</p><p className="mt-1 text-[12.5px] text-muted-foreground">No sales call required and no artificial urgency.</p></div>
            <div className="rounded-lg border border-border px-4 py-3"><p className="cite">03 · SCALE</p><p className="mt-1 font-display text-[14.5px]">Choose a plan when you're ready</p><p className="mt-1 text-[12.5px] text-muted-foreground">Move from proof-of-value to portfolio-wide compliance intelligence.</p></div>
          </div>
          <Button className="mt-4" asChild><Link to="/pricing">View plans</Link></Button>
        </Panel>
      </FreeReviewLeadGate>
    </AppShell>
  );
}
