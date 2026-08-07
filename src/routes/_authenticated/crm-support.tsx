import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useServerFn } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Inbox,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCircle,
  Mail,
  Building2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsStaff } from "@/hooks/use-session";
import { useSession } from "@/hooks/use-session";
import { CrmShell } from "@/components/crm/crm-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SupportCaseDialog } from "@/components/crm/support-case-dialog";
import { listStaff } from "@/lib/crm-staff.functions";
import {
  CASE_STATUS_TONE,
  CASE_PRIORITY_TONE,
  type SupportCase,
  type Account,
  type Contact,
  type NewsItem,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm-support")({
  head: () => ({
    meta: [
      { title: "CertifyIQ CRM Support — Staff Only" },
      {
        name: "description",
        content: "Internal CertifyIQ support case queue for staff only.",
      },
      { property: "og:title", content: "CertifyIQ CRM Support" },
      { property: "og:description", content: "Staff-only support case management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CrmSupport,
});

function CrmSupport() {
  const { isStaff, loading, email } = useIsStaff();
  const { user } = useSession();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; supportCase: SupportCase | null }>({
    open: false,
    supportCase: null,
  });

  const cases = useQuery({
    queryKey: ["support-cases"],
    enabled: isStaff,
    queryFn: async (): Promise<SupportCase[]> => {
      const { data, error } = await supabase
        .from("support_cases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const accounts = useQuery({
    queryKey: ["crm", "accounts"],
    enabled: isStaff,
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase.from("crm_accounts").select("*").order("name");
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

  const staff = useServerFn(listStaff);
  const staffQuery = useQuery({
    queryKey: ["crm", "staff"],
    enabled: isStaff,
    queryFn: () => staff(),
  });

  const staffMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staffQuery.data ?? []) {
      map.set(s.id, s.name || s.email);
    }
    return map;
  }, [staffQuery.data]);

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts.data ?? []) map.set(a.id, a.name);
    return map;
  }, [accounts.data]);

  const contactMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts.data ?? []) map.set(c.id, c.name);
    return map;
  }, [contacts.data]);

  const filtered = useMemo(() => {
    return (cases.data ?? []).filter((c) => {
      const statusMatch = statusFilter === "all" || c.status === statusFilter;
      const priorityMatch = priorityFilter === "all" || c.priority === priorityFilter;
      const term = search.toLowerCase();
      const searchMatch =
        !term ||
        c.case_number.toLowerCase().includes(term) ||
        c.subject.toLowerCase().includes(term) ||
        (c.source_email ?? "").toLowerCase().includes(term) ||
        (accountMap.get(c.account_id ?? "") ?? "").toLowerCase().includes(term) ||
        (contactMap.get(c.contact_id ?? "") ?? "").toLowerCase().includes(term);
      return statusMatch && priorityMatch && searchMatch;
    });
  }, [cases.data, statusFilter, priorityFilter, search, accountMap, contactMap]);

  const openCases = (cases.data ?? []).filter((c) => c.status === "open" || c.status === "pending");
  const critical = (cases.data ?? []).filter((c) => c.priority === "critical");
  const unassigned = (cases.data ?? []).filter((c) => !c.assigned_to);
  const resolvedToday = (cases.data ?? []).filter(
    (c) => c.status === "resolved" && c.updated_at && new Date(c.updated_at).toDateString() === new Date().toDateString()
  );

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <CrmShell email={email} isStaff={isStaff} loading={loading} newsItems={news.data ?? []}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Open & pending" value={String(openCases.length)} hint="Cases awaiting action" />
        <Stat label="Critical" value={String(critical.length)} hint="Highest priority" />
        <Stat label="Unassigned" value={String(unassigned.length)} hint="Needs an owner" />
        <Stat label="Resolved today" value={String(resolvedToday.length)} hint="Closed or resolved today" />
      </div>

      <Panel
        className="mt-4"
        title="Support cases"
        description="Client and internal technical tickets"
        bodyClassName="p-0"
        actions={
          <Button size="sm" onClick={() => setDialog({ open: true, supportCase: null })}>
            <Plus className="size-4" /> New case
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search by case number, subject, email, account..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <ul className="divide-y divide-border">
          {filtered.map((c) => {
            const accountName = accountMap.get(c.account_id ?? "") ?? null;
            const contactName = contactMap.get(c.contact_id ?? "") ?? null;
            const assigned = c.assigned_to ? staffMap.get(c.assigned_to) ?? "Staff" : "Unassigned";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setDialog({ open: true, supportCase: c })}
                  className="flex w-full flex-wrap items-start gap-3 px-5 py-3.5 text-left hover:bg-muted/50"
                >
                  <Inbox className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12.5px] text-muted-foreground">{c.case_number}</span>
                      <span className="font-display text-[14.5px]">{c.subject}</span>
                      <Pill tone={CASE_STATUS_TONE[c.status as keyof typeof CASE_STATUS_TONE] ?? "neutral"}>
                        {c.status}
                      </Pill>
                      <Pill tone={CASE_PRIORITY_TONE[c.priority as keyof typeof CASE_PRIORITY_TONE] ?? "neutral"}>
                        {c.priority}
                      </Pill>
                    </div>
                    <p className="cite mt-1">
                      {accountName && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="size-3" /> {accountName}
                        </span>
                      )}
                      {contactName && <span className="ml-2">{contactName}</span>}
                      {c.source_email && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <Mail className="size-3" /> {c.source_email}
                        </span>
                      )}
                    </p>
                    {c.description && (
                      <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">{c.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <UserCircle className="size-3" /> {assigned}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {new Date(c.created_at).toLocaleDateString()}
                      </span>
                      {c.last_response_at && (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-seal" /> Last reply{" "}
                          {new Date(c.last_response_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {c.priority === "critical" && <AlertTriangle className="mt-0.5 size-4 text-reject" />}
                </button>
              </li>
            );
          })}
          {!filtered.length && (
            <li className="px-5 py-6 text-[13.5px] text-muted-foreground">
              No cases match the current filters. Create a new case or adjust the filters.
            </li>
          )}
        </ul>
      </Panel>

      <SupportCaseDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, supportCase: open ? dialog.supportCase : null })}
        supportCase={dialog.supportCase}
        accounts={accounts.data ?? []}
        contacts={contacts.data ?? []}
        staff={staffQuery.data ?? []}
        staffEmail={user?.email ?? ""}
      />
    </CrmShell>
  );
}
