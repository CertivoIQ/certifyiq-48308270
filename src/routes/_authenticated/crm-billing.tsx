import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { CrmShell } from "@/components/crm/crm-shell";
import { EnterpriseInvoicePanel } from "@/components/crm/enterprise-invoice-panel";
import { Panel } from "@/components/ui-kit";
import { useIsStaff } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import type { Account, Contact, NewsItem } from "@/lib/crm";
import type { LicensePricingClass } from "@/lib/license-pricing.functions";

export const Route = createFileRoute("/_authenticated/crm-billing")({
  head: () => ({
    meta: [
      { title: "Enterprise billing â€” CertivoIQ CRM" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CrmBillingPage,
});

function CrmBillingPage() {
  const { isStaff, loading, email } = useIsStaff();
  const [accountId, setAccountId] = useState("");

  const accounts = useQuery({
    queryKey: ["crm", "billing", "accounts"],
    enabled: isStaff,
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase.from("crm_accounts").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!accountId && accounts.data?.[0]?.id) {
      setAccountId(accounts.data[0].id);
    }
  }, [accountId, accounts.data]);

  const contacts = useQuery({
    queryKey: ["crm", "billing", "contacts", accountId],
    enabled: isStaff && Boolean(accountId),
    queryFn: async (): Promise<Contact[]> => {
      const { data, error } = await supabase
        .from("crm_contacts")
        .select("*")
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const news = useQuery({
    queryKey: ["crm", "news"],
    enabled: isStaff,
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

  const selectedAccount = useMemo(
    () => accounts.data?.find((account) => account.id === accountId) ?? null,
    [accountId, accounts.data],
  );

  const initialPricingClass: LicensePricingClass =
    selectedAccount &&
    (selectedAccount as Account & { license_pricing_class?: string }).license_pricing_class ===
      "pha"
      ? "pha"
      : "standard";

  return (
    <CrmShell email={email} isStaff={isStaff} loading={loading} newsItems={news.data ?? []}>
      <div className="space-y-4">
        <Panel
          title="Enterprise billing console"
          description="Create annual invoices after procurement details and licensed states are confirmed. Multifamily Enterprise is $65,000 per selected state; PHA is $150,000 flat. Only fully verified paid invoices activate licenses."
        >
          <label className="block max-w-2xl text-sm font-medium">
            CRM organization
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select organization</option>
              {(accounts.data ?? []).map((account) => {
                const pricingClass =
                  (account as Account & { license_pricing_class?: string })
                    .license_pricing_class === "pha"
                    ? "PHA Â· $150,000"
                    : "Multifamily Enterprise Â· $65,000/state";
                return (
                  <option key={account.id} value={account.id}>
                    {account.name} Â· {pricingClass} Â· {account.stage}
                  </option>
                );
              })}
            </select>
          </label>
          <p className="mt-3 text-xs text-muted-foreground">
            The CRM account ID and pricing class are authoritative for invoicing, renewal, license
            activation, and entitlement history. Invoice amounts are never entered manually.
          </p>
        </Panel>

        {selectedAccount && (
          <EnterpriseInvoicePanel
            key={`${selectedAccount.id}-${initialPricingClass}`}
            accountId={selectedAccount.id}
            accountName={selectedAccount.name}
            initialPricingClass={initialPricingClass}
            contacts={(contacts.data ?? []).map((contact) => ({
              id: contact.id,
              name: contact.name,
              email: contact.email,
            }))}
          />
        )}

        {!accounts.isLoading && !(accounts.data ?? []).length && (
          <Panel title="No CRM organizations">
            <p className="text-sm text-muted-foreground">
              Add or qualify a CRM organization before issuing an enterprise license invoice.
            </p>
          </Panel>
        )}
      </div>
    </CrmShell>
  );
}

