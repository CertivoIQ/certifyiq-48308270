import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ExternalLink,
  Globe2,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { CrmShell } from "@/components/crm/crm-shell";
import { Button } from "@/components/ui/button";
import { Panel, Pill } from "@/components/ui-kit";
import { useIsStaff } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { linkTo, money, STAGE_TONE, type Account, type Activity, type Contact, type NewsItem } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/accounts/$accountId")({
  head: () => ({
    meta: [
      { title: "Lead profile — CertivoIQ CRM" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CrmAccountProfile,
});

function CrmAccountProfile() {
  const { accountId } = Route.useParams();
  const { isStaff, loading, email } = useIsStaff();

  const account = useQuery({
    queryKey: ["crm", "account", accountId],
    enabled: isStaff,
    queryFn: async (): Promise<Account> => {
      const { data, error } = await supabase.from("crm_accounts").select("*").eq("id", accountId).single();
      if (error) throw error;
      return data;
    },
  });

  const contacts = useQuery({
    queryKey: ["crm", "contacts", accountId],
    enabled: isStaff,
    queryFn: async (): Promise<Contact[]> => {
      const { data, error } = await supabase.from("crm_contacts").select("*").eq("account_id", accountId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const activities = useQuery({
    queryKey: ["crm", "activities", accountId],
    enabled: isStaff,
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await supabase.from("crm_activities").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });

  const news = useQuery({
    queryKey: ["crm", "news"],
    enabled: isStaff,
    queryFn: async (): Promise<NewsItem[]> => {
      const { data, error } = await supabase.from("crm_news").select("*").order("published_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const lead = account.data;

  return (
    <CrmShell email={email} isStaff={isStaff} loading={loading} newsItems={news.data ?? []}>
      <Button variant="ghost" size="sm" asChild className="mb-4 text-emerald-800 hover:bg-emerald-100">
        <Link to="/crm"><ArrowLeft className="size-4" /> Back to pipeline</Link>
      </Button>

      {account.isLoading && <div className="h-56 animate-pulse rounded-2xl bg-emerald-100/70" />}
      {account.isError && (
        <Panel title="Profile unavailable" description="This lead could not be loaded.">
          <p className="text-sm text-muted-foreground">Confirm the record still exists and that your staff session is active.</p>
        </Panel>
      )}

      {lead && (
        <>
          <section className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-green-700 p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8">
            <div className="flex flex-wrap items-start gap-5">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20">
                <Building2 className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={STAGE_TONE[lead.stage]} className="capitalize">{lead.stage}</Pill>
                  <span className="rounded-full bg-emerald-300/15 px-2.5 py-1 text-[11px] font-medium text-emerald-100">
                    {lead.source?.startsWith("Verified") ? "Public facts verified" : "Verification needed"}
                  </span>
                </div>
                <h1 className="mt-3 font-sans text-3xl font-semibold tracking-tight sm:text-4xl">{lead.name}</h1>
                <p className="mt-2 flex flex-wrap items-center gap-4 text-sm text-emerald-100/85">
                  <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> {lead.hq ?? "Headquarters not verified"}</span>
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4" /> {lead.account_type}</span>
                </p>
              </div>
              <div className="flex gap-2">
                {linkTo(lead.website) && (
                  <Button className="bg-white text-emerald-950 hover:bg-emerald-50" asChild>
                    <a href={linkTo(lead.website)!} target="_blank" rel="noreferrer noopener"><Globe2 className="size-4" /> Website</a>
                  </Button>
                )}
                {linkTo(lead.linkedin_url) && (
                  <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" asChild>
                    <a href={linkTo(lead.linkedin_url)!} target="_blank" rel="noreferrer noopener"><Linkedin className="size-4" /> LinkedIn</a>
                  </Button>
                )}
              </div>
            </div>
          </section>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Published units", lead.units ? Number(lead.units).toLocaleString() : "Not stated"],
              ["Published properties", lead.properties ? Number(lead.properties).toLocaleString() : "Not stated"],
              ["Opportunity ARR", Number(lead.arr) ? money(Number(lead.arr)) : "Not qualified"],
              ["Lead score", String(lead.lead_score ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm dark:bg-emerald-950/30">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">{label}</p>
                <p className="mt-2 font-sans text-2xl font-semibold tracking-tight text-emerald-950 dark:text-emerald-50">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
            <Panel title="Verified company & property research" description={lead.source ?? "No verification source recorded"}>
              <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">{lead.notes || "No research notes recorded."}</div>
              {linkTo(lead.website) && (
                <a href={linkTo(lead.website)!} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline">
                  Open primary source <ExternalLink className="size-3.5" />
                </a>
              )}
              {!!lead.programs?.length && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {lead.programs.map((program) => <span key={program} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">{program}</span>)}
                </div>
              )}
            </Panel>

            <Panel title="Opportunity snapshot" description="Sales data is separate from public portfolio facts">
              <dl className="space-y-4 text-sm">
                <div><dt className="text-muted-foreground">Owner</dt><dd className="mt-1 font-semibold">{lead.owner ?? "Unassigned"}</dd></div>
                <div><dt className="text-muted-foreground">Plan</dt><dd className="mt-1 font-semibold">{lead.plan ?? "Not qualified"}</dd></div>
                <div><dt className="text-muted-foreground">Next follow-up</dt><dd className="mt-1 inline-flex items-center gap-1.5 font-semibold"><CalendarClock className="size-4 text-emerald-600" /> {lead.next_followup_on ?? "Not scheduled"}</dd></div>
                <div><dt className="text-muted-foreground">Last touch</dt><dd className="mt-1 font-semibold">{lead.last_touch ?? "No activity yet"}</dd></div>
              </dl>
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Decision makers" description="Only use contact information that has been independently verified">
              <div className="space-y-3">
                {(contacts.data ?? []).map((contact) => (
                  <article key={contact.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <p className="font-sans font-semibold">{contact.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{contact.title ?? "Role not recorded"}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-emerald-800">
                      {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="size-3.5" /> {contact.email}</a>}
                      {contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="size-3.5" /> {contact.phone}</a>}
                    </div>
                  </article>
                ))}
                {!(contacts.data ?? []).length && <p className="text-sm text-muted-foreground">No verified decision maker has been added.</p>}
              </div>
            </Panel>

            <Panel title="Activity timeline" description="Recent human and campaign actions">
              <ol className="space-y-4">
                {(activities.data ?? []).map((item) => (
                  <li key={item.id} className="relative border-l-2 border-emerald-200 pl-4">
                    <span className="absolute -left-[5px] top-1 size-2 rounded-full bg-emerald-600" />
                    <p className="font-sans text-sm font-semibold">{item.subject ?? item.kind}</p>
                    {item.body && <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>}
                    <time className="mt-1 block text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</time>
                  </li>
                ))}
                {!(activities.data ?? []).length && <p className="text-sm text-muted-foreground">No activity has been recorded.</p>}
              </ol>
            </Panel>
          </div>
        </>
      )}
    </CrmShell>
  );
}
