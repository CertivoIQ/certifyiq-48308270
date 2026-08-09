import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Linkedin,
  Mail,
  Phone,
  Plus,
  Send,
  UserPlus,
  Zap,
  Loader2,
  FileText,
  Pencil,
  Globe,
  Printer,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useIsStaff } from "@/hooks/use-session";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { IQText } from "@/components/iq-text";
import { CrmShell } from "@/components/crm/crm-shell";
import { AccountDialog, ContactDialog } from "@/components/crm/account-dialog";
import { CampaignDialog } from "@/components/crm/campaign-dialog";
import { LeadsPanel } from "@/components/crm/leads-panel";
import { PipelinePanel } from "@/components/crm/pipeline-panel";
import { MailMergeDialog } from "@/components/crm/mail-merge-dialog";
import {
  STAGES,
  STAGE_TONE,
  money,
  linkTo,
  type Account,
  type Activity,
  type Campaign,
  type Contact,
  type NewsItem,
  type Stage,
  type Template,
} from "@/lib/crm";


export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "CertivoIQ CRM Dashboard — Staff Only" },
      {
        name: "description",
        content:
          "Internal CertivoIQ CRM Dashboard: enterprise and company lead profiles, pipeline by stage, compliance-event marketing campaigns and a live federal news ticker.",
      },
      { property: "og:title", content: "CertivoIQ CRM Dashboard" },
      {
        property: "og:description",
        content: "Staff-only pipeline, account profiles and marketing distribution for CertivoIQ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CrmDashboard,
});

function CrmDashboard() {
  const { isStaff, loading, email } = useIsStaff();
  const qc = useQueryClient();

  const accounts = useQuery({
    queryKey: ["crm", "accounts"],
    enabled: isStaff,
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase.from("crm_accounts").select("*").order("arr", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const contacts = useQuery({
    queryKey: ["crm", "contacts"],
    enabled: isStaff,
    queryFn: async (): Promise<Contact[]> => {
      const { data, error } = await supabase.from("crm_contacts").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const campaigns = useQuery({
    queryKey: ["crm", "campaigns"],
    enabled: isStaff,
    queryFn: async (): Promise<Campaign[]> => {
      const { data, error } = await supabase.from("crm_campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const templates = useQuery({
    queryKey: ["crm", "templates"],
    enabled: isStaff,
    queryFn: async (): Promise<Template[]> => {
      const { data, error } = await supabase.from("crm_templates").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const news = useQuery({
    queryKey: ["crm", "news"],
    enabled: isStaff,
    refetchInterval: 60_000,
    queryFn: async (): Promise<NewsItem[]> => {
      const { data, error } = await supabase
        .from("crm_news")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const activities = useQuery({
    queryKey: ["crm", "activities"],
    enabled: isStaff,
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await supabase
        .from("crm_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [mailMergeOpen, setMailMergeOpen] = useState(false);
  const [stage, setStage] = useState<Stage | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [accountDialog, setAccountDialog] = useState<{ open: boolean; account: Account | null }>({
    open: false,
    account: null,
  });
  const [contactDialog, setContactDialog] = useState<Account | null>(null);
  const [campaignDialog, setCampaignDialog] = useState<{
    open: boolean;
    campaign: Campaign | null;
    templateId: string | null;
  }>({ open: false, campaign: null, templateId: null });

  const rows = accounts.data ?? [];
  const filtered = useMemo(() => (stage === "all" ? rows : rows.filter((r) => r.stage === stage)), [rows, stage]);

  const byStage = STAGES.map((s) => {
    const group = rows.filter((r) => r.stage === s);
    return { stage: s, count: group.length, arr: group.reduce((a, r) => a + Number(r.arr ?? 0), 0) };
  });
  const pipelineArr = rows.filter((r) => r.stage !== "lost" && r.stage !== "won").reduce((a, r) => a + Number(r.arr), 0);
  const wonArr = rows.filter((r) => r.stage === "won").reduce((a, r) => a + Number(r.arr), 0);
  const trialEnded = rows.filter((r) => r.stage === "trial ended");

  const remind = useMutation({
    mutationFn: async (account: Account) => {
      const { error } = await supabase
        .from("crm_accounts")
        .update({
          reminders_sent: (account.reminders_sent ?? 0) + 1,
          last_touch: "Trial reminder email sent",
        })
        .eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: (_d, account) => {
      qc.invalidateQueries({ queryKey: ["crm", "accounts"] });
      toast.success("Reminder email queued", {
        description: `${account.name} — sends with a one-click trial restore link.`,
      });
    },
    onError: () => toast.error("Could not queue reminder"),
  });

  return (
    <CrmShell email={email} isStaff={isStaff} loading={loading} newsItems={news.data ?? []}>
      <section className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-green-700 p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-200">Revenue command center</p>
            <h2 className="mt-2 max-w-2xl font-sans text-3xl font-semibold tracking-tight leading-tight sm:text-4xl">Turn verified affordable-housing research into trusted relationships.</h2>
            <p className="mt-3 max-w-2xl text-sm text-emerald-100/80">Public facts are source-linked. Contacts remain unverified until reviewed by staff, and sales forecasts stay separate from portfolio facts.</p>
          </div>
          <Button className="bg-white text-emerald-950 hover:bg-emerald-50" onClick={() => setAccountDialog({ open: true, account: null })}>
            <Plus className="size-4" /> Add verified account
          </Button>
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Qualified pipeline ARR" value={money(pipelineArr)} hint={`${rows.filter((r) => Number(r.arr) > 0).length} valued opportunities`} />
        <Stat label="Closed won ARR" value={money(wonArr)} hint={`${byStage.find((b) => b.stage === "won")?.count ?? 0} subscribed`} />
        <Stat label="Trial follow-ups" value={String(trialEnded.length)} hint="Reminder due after expiry" />
        <Stat label="Active campaigns" value={String((campaigns.data ?? []).filter((c) => c.status !== "draft").length)} hint={`${(templates.data ?? []).length} templates ready`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <Panel title="Pipeline by stage" description="Annualized contract value in each stage" bodyClassName="p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {byStage.map((b) => {
              const stageColor: Record<Stage, string> = {
                new: "border-sky-200 bg-sky-50 text-sky-800",
                trialing: "border-cyan-200 bg-cyan-50 text-cyan-800",
                "trial ended": "border-amber-200 bg-amber-50 text-amber-900",
                negotiation: "border-violet-200 bg-violet-50 text-violet-800",
                won: "border-emerald-200 bg-emerald-50 text-emerald-800",
                lost: "border-rose-200 bg-rose-50 text-rose-800",
              };
              return (
                <button key={b.stage} type="button" onClick={() => setStage(b.stage)}
                  className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${stageColor[b.stage]}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide">{b.stage}</span>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 font-mono text-xs">{b.count}</span>
                  </div>
                  <p className="mt-3 font-sans text-xl font-semibold">{money(b.arr)}</p>
                  <p className="mt-1 text-[11px] opacity-70">Annualized opportunity value</p>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Marketing campaigns"
          description="Built from compliance-event templates and distributed to non-subscribers"
          bodyClassName="p-0"
          actions={
            <Button size="sm" onClick={() => setCampaignDialog({ open: true, campaign: null, templateId: null })}>
              <Plus className="size-4" /> New campaign
            </Button>
          }
        >
          <ul className="divide-y divide-border">
            {(campaigns.data ?? []).map((c) => (
              <li key={c.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-sans text-[14.5px] font-semibold">{c.name}</span>
                  <Pill tone={c.status === "draft" ? "neutral" : "seal"}>{c.status}</Pill>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => setCampaignDialog({ open: true, campaign: c, templateId: null })}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                </div>
                <p className="cite mt-1">
                  {c.compliance_event ?? "General outreach"} · {c.audience ?? "All non-subscribers"}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-muted-foreground">
                  <span>{c.sent} sent</span>
                  <span>{c.sent ? Math.round((c.opened / c.sent) * 100) : 0}% opened</span>
                  <span className="text-primary">{c.clicked} clicked</span>
                  <span className="text-seal">{c.converted} subscribed</span>
                </div>
              </li>
            ))}
            {!(campaigns.data ?? []).length && (
              <li className="px-5 py-6 text-[13px] text-muted-foreground">
                No campaigns yet — start from a template below.
              </li>
            )}
          </ul>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Marketing material templates"
        description="Prebuilt and tied to federal compliance events and rule changes"
        bodyClassName="p-0"
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to="/marketing-kit">
              <Printer className="size-4" /> Printable intro one-pager
            </Link>
          </Button>
        }
      >

        <ul className="divide-y divide-border">
          {(templates.data ?? []).map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <FileText className="size-4 shrink-0 text-gold" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium">{t.name}</p>
                <p className="cite">
                  {t.category ?? "email"} · {t.compliance_event ?? "evergreen"}
                </p>
                {t.subject && <p className="mt-1 text-[12.5px] text-muted-foreground">Subject: {t.subject}</p>}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCampaignDialog({ open: true, campaign: null, templateId: t.id })}
              >
                <Send className="size-4" /> Use & distribute
              </Button>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mt-4">
        <LeadsPanel
          accounts={rows}
          selected={selectedLeads}
          onSelectedChange={setSelectedLeads}
          onMailMerge={() => setMailMergeOpen(true)}
        />
      </div>

      <PipelinePanel accounts={rows} activities={activities.data ?? []} />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(["all", ...STAGES] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={stage === s ? "default" : "outline"}
            className="capitalize"
            onClick={() => setStage(s as Stage | "all")}
          >
            {s}
          </Button>
        ))}
        <Button size="sm" className="ml-auto" onClick={() => setAccountDialog({ open: true, account: null })}>
          <Plus className="size-4" /> New account profile
        </Button>
      </div>

      <Panel
        className="mt-3"
        title="Verified accounts & decision makers"
        description="Company names open a dedicated lead profile; public facts include their source and verification date"
        bodyClassName="p-0"
      >
        <ul className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => {
            const people = (contacts.data ?? []).filter((c) => c.account_id === a.id);
            return (
              <li key={a.id} className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-emerald-950/20">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(openId === a.id ? null : a.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setOpenId(openId === a.id ? null : a.id);
                  }}
                  className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 px-5 py-5 text-left transition hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30"
                >
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/crm/accounts/$accountId"
                      params={{ accountId: a.id }}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-emerald-950 underline-offset-4 hover:text-emerald-700 hover:underline dark:text-emerald-100"
                    >
                      {a.name}
                      <Globe className="size-3.5 opacity-60" />
                    </Link>
                    <p className="cite">
                      {Number(a.units).toLocaleString()} units · {a.hq ?? "—"} · {a.source ?? "—"}
                    </p>
                  </div>
                  <Pill tone={STAGE_TONE[a.stage]} className="capitalize">
                    {a.stage}
                  </Pill>
                  <span className="w-full rounded-lg bg-emerald-50 px-3 py-2 font-mono text-[12px] text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                    {Number(a.arr) > 0 ? `${money(Number(a.arr))}/yr · ${a.plan ?? "Plan pending"}` : "Research lead · value after qualification"}
                  </span>
                  <span className="cite w-24 text-right">{a.owner ?? "Unassigned"}</span>
                </div>

                {openId === a.id && (
                  <div className="border-t border-emerald-100 bg-emerald-50/40 px-5 py-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
                      {linkTo(a.linkedin_url) && (
                        <a
                          href={linkTo(a.linkedin_url)!}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-center gap-1.5 text-primary hover:underline"
                        >
                          <Linkedin className="size-3.5" /> Company page
                        </a>
                      )}
                      {linkTo(a.website) && (
                        <a
                          href={linkTo(a.website)!}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-center gap-1.5 text-primary hover:underline"
                        >
                          <Globe className="size-3.5" /> {a.website}
                        </a>
                      )}
                      <span>Last touch: {a.last_touch ?? "—"}</span>
                      {a.trial_ended_on && <span>Trial ended: {a.trial_ended_on}</span>}
                      <span>{a.reminders_sent ?? 0} reminder emails sent</span>
                    </div>

                    {a.notes && (
                      <p className="mt-3 rounded-lg border border-border bg-card px-4 py-3 text-[13px] whitespace-pre-wrap">
                        {a.notes}
                      </p>
                    )}

                    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                      {people.map((c) => (
                        <li key={c.id} className="rounded-lg border border-border bg-card px-4 py-3">
                          <p className="font-display text-[14.5px]">{c.name}</p>
                          <p className="cite">{c.title ?? "—"}</p>
                          <div className="mt-2 space-y-1 text-[12.5px]">
                            {c.email && (
                              <p className="flex items-center gap-1.5">
                                <Mail className="size-3.5 text-muted-foreground" /> {c.email}
                              </p>
                            )}
                            {c.phone && (
                              <p className="flex items-center gap-1.5">
                                <Phone className="size-3.5 text-muted-foreground" /> {c.phone}
                              </p>
                            )}
                            {linkTo(c.linkedin_url) && (
                              <a
                                href={linkTo(c.linkedin_url)!}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="flex items-center gap-1.5 text-primary hover:underline"
                              >
                                <Linkedin className="size-3.5" /> LinkedIn profile
                              </a>
                            )}
                            {c.notes && <p className="text-muted-foreground">{c.notes}</p>}
                          </div>
                        </li>
                      ))}
                      {!people.length && (
                        <li className="text-[13px] text-muted-foreground">No contacts yet on this account.</li>
                      )}
                    </ul>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => remind.mutate(a)} disabled={remind.isPending}>
                        <Send className="size-4" /> Send trial reminder
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setContactDialog(a)}>
                        <UserPlus className="size-4" /> Add contact
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAccountDialog({ open: true, account: a })}
                      >
                        <Pencil className="size-4" /> Edit profile
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCampaignDialog({ open: true, campaign: null, templateId: templates.data?.[0]?.id ?? null })
                        }
                      >
                        <Zap className="size-4" /> Add to campaign
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {!filtered.length && (
            <li className="px-5 py-6 text-[13px] text-muted-foreground">No accounts in this stage.</li>
          )}
        </ul>
      </Panel>

      <MailMergeDialog
        open={mailMergeOpen}
        onOpenChange={setMailMergeOpen}
        accounts={rows.filter((r) => selectedLeads.includes(r.id))}
        templates={templates.data ?? []}
        campaigns={campaigns.data ?? []}
      />

      <AccountDialog
        open={accountDialog.open}
        account={accountDialog.account}
        onOpenChange={(open) => setAccountDialog({ open, account: open ? accountDialog.account : null })}
      />
      {contactDialog && (
        <ContactDialog
          open={!!contactDialog}
          onOpenChange={(open) => !open && setContactDialog(null)}
          accountId={contactDialog.id}
          accountName={contactDialog.name}
        />
      )}
      <CampaignDialog
        open={campaignDialog.open}
        campaign={campaignDialog.campaign}
        presetTemplateId={campaignDialog.templateId}
        templates={templates.data ?? []}
        onOpenChange={(open) => setCampaignDialog({ open, campaign: null, templateId: null })}
      />
    </CrmShell>
  );
}
