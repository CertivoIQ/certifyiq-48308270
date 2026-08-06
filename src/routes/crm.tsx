import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat, Meter } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  LEADS,
  PIPELINE_STAGES,
  STAGE_TONE,
  SALES_KPIS,
  EMAIL_CAMPAIGNS,
  LANDING_CLICKS,
  type LeadStage,
} from "@/lib/trial-data";
import { Linkedin, Mail, Phone, MousePointerClick, Zap, Send, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [
      { title: "Sales Back Office CRM — CertifyIQ" },
      {
        name: "description",
        content:
          "CertifyIQ's internal sales CRM: auto-populated leads from non-subscribing housing companies, VP and decision-maker contacts, pipeline by stage, automated trial reminder emails and marketing link click tracking.",
      },
      { property: "og:title", content: "CertifyIQ Sales Back Office" },
      {
        property: "og:description",
        content: "Pipeline, automated 24-hour trial reminders and landing-page click attribution for CertifyIQ sales agents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CrmPage,
});

const money = (n: number) => `$${n.toLocaleString()}`;

function CrmPage() {
  const [stage, setStage] = useState<LeadStage | "all">("all");
  const leads = useMemo(() => (stage === "all" ? LEADS : LEADS.filter((l) => l.stage === stage)), [stage]);
  const [openId, setOpenId] = useState<string | null>(LEADS[0]?.id ?? null);

  const byStage = PIPELINE_STAGES.map((s) => {
    const rows = LEADS.filter((l) => l.stage === s);
    return { stage: s, count: rows.length, arr: rows.reduce((a, l) => a + l.arr, 0) };
  });
  const maxArr = Math.max(...byStage.map((b) => b.arr), 1);
  const dueReminders = LEADS.filter((l) => l.stage === "trial ended");

  return (
    <AppShell
      title="Sales back office"
      subtitle="Pipeline, auto-populated leads, automated trial reminders and marketing attribution"
      actions={
        <Button
          size="sm"
          onClick={() =>
            toast.success("Automation running", {
              description: `${dueReminders.length} trial-ended accounts queued for the 24-hour reminder email.`,
            })
          }
        >
          <Zap className="size-4" /> Run reminder automation
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        {SALES_KPIS.map((k) => (
          <Stat key={k.label} label={k.label} value={k.value} hint={k.note} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <Panel title="Pipeline by stage" description="Annualized contract value in each stage" bodyClassName="p-5">
          <ul className="space-y-3.5">
            {byStage.map((b) => (
              <li key={b.stage}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] capitalize">{b.stage}</span>
                  <span className="font-mono text-[12.5px] text-muted-foreground">
                    {b.count} · {money(b.arr)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Meter value={Math.round((b.arr / maxArr) * 100)} tone={STAGE_TONE[b.stage]} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Automated email campaigns"
          description="Trial reminders fire 24 hours after expiry, then again during the retention hold"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {EMAIL_CAMPAIGNS.map((c) => (
              <li key={c.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-[14.5px]">{c.name}</span>
                  <Pill tone={c.automated ? "seal" : "neutral"}>{c.automated ? "Automated" : "Manual"}</Pill>
                </div>
                <p className="cite mt-1">
                  {c.trigger} · {c.audience}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-muted-foreground">
                  <span>{c.sent} sent</span>
                  <span>{Math.round((c.opened / c.sent) * 100)}% opened</span>
                  <span className="text-primary">{c.clicked} clicked</span>
                  <span className="text-seal">{c.converted} subscribed</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Landing page clicks from marketing email"
        description="Who opened the link, which page they landed on, and how often they came back"
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-border">
          {LANDING_CLICKS.map((c) => (
            <li key={`${c.company}-${c.when}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
              <MousePointerClick className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium">
                  {c.person} <span className="text-muted-foreground">· {c.title}</span>
                </p>
                <p className="cite">
                  {c.company} · {c.campaign} → {c.page}
                </p>
              </div>
              <Pill tone={c.visits >= 3 ? "seal" : "neutral"}>{c.visits} visits</Pill>
              <span className="cite w-20 text-right">{c.when}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["all", ...PIPELINE_STAGES] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={stage === s ? "default" : "outline"}
            className="capitalize"
            onClick={() => setStage(s as LeadStage | "all")}
          >
            {s}
          </Button>
        ))}
      </div>

      <Panel
        className="mt-3"
        title="Accounts & decision makers"
        description="Leads auto-populate from housing companies with no active CertifyIQ subscription"
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-border">
          {leads.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setOpenId(openId === l.id ? null : l.id)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-left hover:bg-muted/50"
              >
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium">{l.company}</p>
                  <p className="cite">
                    {l.units.toLocaleString()} units · {l.hq} · {l.source}
                  </p>
                </div>
                <Pill tone={STAGE_TONE[l.stage]} className="capitalize">
                  {l.stage}
                </Pill>
                <span className="font-mono text-[12.5px] text-muted-foreground">
                  {money(l.arr)}/yr · {l.plan}
                </span>
                <span className="cite w-24 text-right">{l.owner}</span>
              </button>

              {openId === l.id && (
                <div className="border-t border-border bg-muted/30 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
                    <a
                      href={`https://${l.linkedin}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Linkedin className="size-3.5" /> {l.linkedin}
                    </a>
                    <span>Last touch: {l.lastTouch}</span>
                    {l.trialEnded && <span>Trial ended: {l.trialEnded}</span>}
                    <span>{l.remindersSent} reminder emails sent</span>
                  </div>

                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {l.contacts.map((c) => (
                      <li key={c.email} className="rounded-lg border border-border bg-card px-4 py-3">
                        <p className="font-display text-[14.5px]">{c.name}</p>
                        <p className="cite">{c.title}</p>
                        <div className="mt-2 space-y-1 text-[12.5px]">
                          <p className="flex items-center gap-1.5">
                            <Mail className="size-3.5 text-muted-foreground" /> {c.email}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Phone className="size-3.5 text-muted-foreground" /> {c.phone}
                          </p>
                          <a
                            href={`https://${c.linkedin}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="flex items-center gap-1.5 text-primary hover:underline"
                          >
                            <Linkedin className="size-3.5" /> LinkedIn profile
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        toast.success("Reminder email queued", {
                          description: `${l.company} — sends 24 hours after trial expiry with a one-click restore link.`,
                        })
                      }
                    >
                      <Send className="size-4" /> Send trial reminder
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.success("Added to VP outbound sequence", { description: l.company })}
                    >
                      <Zap className="size-4" /> Add to sequence
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </AppShell>
  );
}
