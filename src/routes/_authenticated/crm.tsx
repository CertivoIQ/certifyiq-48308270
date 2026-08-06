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
  Sparkles,
  UserPlus,
  Zap,
  ShieldAlert,
  Loader2,
  ArrowLeft,
  FileText,
  Pencil,
  Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsStaff } from "@/hooks/use-session";
import { Panel, Pill, Stat, Meter } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { IQText } from "@/components/iq-text";
import { NewsTicker } from "@/components/crm/news-ticker";
import { AccountDialog, ContactDialog } from "@/components/crm/account-dialog";
import { CampaignDialog } from "@/components/crm/campaign-dialog";
import {
  STAGES,
  STAGE_TONE,
  money,
  linkTo,
  type Account,
  type Campaign,
  type Contact,
  type NewsItem,
  type Stage,
  type Template,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "CertifyIQ CRM Dashboard — Staff Only" },
      {
        name: "description",
        content:
          "Internal CertifyIQ CRM Dashboard: enterprise and company lead profiles, pipeline by stage, compliance-event marketing campaigns and a live federal news ticker.",
      },
      { property: "og:title", content: "CertifyIQ CRM Dashboard" },
      {
        property: "og:description",
        content: "Staff-only pipeline, account profiles and marketing distribution for CertifyIQ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CrmDashboard,
});

function CrmShell({ children, email }: { children: React.ReactNode; email: string | null }) {
  return (
    <div className="crm-surface min-h-screen pb-16">
      <header className="sticky top-0 z-30 border-b border-gold-line bg-gold-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-7">
          <span className="crm-gradient grid size-9 place-items-center rounded-[9px] font-mono text-[13px] font-bold text-gold-ink">
            IQ
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[20px] leading-tight text-gold-ink sm:text-[24px]">
              <IQText>CertifyIQ CRM Dashboard</IQText>
            </h1>
            <p className="cite">Internal · never visible to customers, leads or clients</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {email && (
              <span className="hidden rounded-full border border-gold-line bg-background/60 px-3 py-1 font-mono text-[11.5px] text-gold-ink sm:inline">
                {email}
              </span>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="size-4" /> Product
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-7 sm:py-8">{children}</div>
    </div>
  );
}

function Denied() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md rounded-xl border border-border bg-card p-7 text-center">
        <ShieldAlert className="mx-auto size-9 text-flag" />
        <h1 className="mt-3 font-display text-[21px]">Staff access only</h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          The CertifyIQ CRM Dashboard is restricted to verified @certifyiq.com accounts. If you are a CertifyIQ
          employee, sign in with your company email.
        </p>
        <Button className="mt-5" asChild>
          <Link to="/">Back to CertifyIQ</Link>
        </Button>
      </div>
    </div>
  );
}

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
  const maxArr = Math.max(...byStage.map((b) => b.arr), 1);
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

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isStaff) return <Denied />;

  return (
    <CrmShell email={email}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Open pipeline ARR" value={money(pipelineArr)} hint={`${rows.length} accounts tracked`} />
        <Stat label="Closed won ARR" value={money(wonArr)} hint={`${byStage.find((b) => b.stage === "won")?.count ?? 0} subscribed`} />
        <Stat label="Trial ended · reminder due" value={String(trialEnded.length)} hint="Sends 24h after expiry" />
        <Stat label="Live campaigns" value={String((campaigns.data ?? []).filter((c) => c.status !== "draft").length)} hint={`${(templates.data ?? []).length} templates ready`} />
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
                  <span className="font-display text-[14.5px]">{c.name}</span>
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
        title="Accounts & decision makers"
        description="Enterprise and company leads with no active CertifyIQ subscription"
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-border">
          {filtered.map((a) => {
            const people = (contacts.data ?? []).filter((c) => c.account_id === a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(openId === a.id ? null : a.id)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-left hover:bg-muted/50"
                >
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium">{a.name}</p>
                    <p className="cite">
                      {Number(a.units).toLocaleString()} units · {a.hq ?? "—"} · {a.source ?? "—"}
                    </p>
                  </div>
                  <Pill tone={STAGE_TONE[a.stage]} className="capitalize">
                    {a.stage}
                  </Pill>
                  <span className="font-mono text-[12.5px] text-muted-foreground">
                    {money(Number(a.arr))}/yr · {a.plan ?? "—"}
                  </span>
                  <span className="cite w-24 text-right">{a.owner ?? "Unassigned"}</span>
                </button>

                {openId === a.id && (
                  <div className="border-t border-border bg-muted/30 px-5 py-4">
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

      <p className="cite mt-4 flex items-center gap-2">
        <Sparkles className="size-3.5 text-gold" /> Federal affordable housing updates and new paid subscribers stream
        in the ticker below, refreshed daily.
      </p>

      <NewsTicker items={news.data ?? []} />

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
