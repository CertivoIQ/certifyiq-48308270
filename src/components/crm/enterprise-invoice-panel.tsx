import { useMemo, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui-kit";
import { createEnterpriseLicenseInvoice } from "@/lib/enterprise-invoice.functions";
import { getStripeEnvironment } from "@/lib/stripe";

type InvoiceContact = {
  id: string;
  name: string;
  email: string | null;
};

export function EnterpriseInvoicePanel({
  accountId,
  accountName,
  contacts,
}: {
  accountId: string;
  accountName: string;
  contacts: InvoiceContact[];
}) {
  const verifiedEmails = useMemo(
    () => contacts.filter((contact) => Boolean(contact.email)),
    [contacts],
  );
  const [billingEmail, setBillingEmail] = useState(verifiedEmails[0]?.email ?? "");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");
  const [netDays, setNetDays] = useState(30);
  const [allowCard, setAllowCard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hostedInvoiceUrl, setHostedInvoiceUrl] = useState<string | null>(null);
  const environment = getStripeEnvironment();

  const issueInvoice = async () => {
    if (!billingEmail) {
      toast.error("A verified billing email is required before issuing an invoice.");
      return;
    }

    setBusy(true);
    try {
      const result = await createEnterpriseLicenseInvoice({
        data: {
          organizationId: accountId,
          crmAccountId: accountId,
          organizationName: accountName,
          billingEmail,
          purchaseOrderNumber: purchaseOrderNumber || undefined,
          netDays,
          allowCard,
          environment,
        },
      });
      if ("error" in result) throw new Error(result.error);

      setHostedInvoiceUrl(result.hostedInvoiceUrl);
      toast.success(
        `${result.invoiceNumber ?? "Enterprise invoice"} issued for $65,000.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invoice issuance failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Enterprise license invoice"
      description="Issue the $65,000 annual organization license by invoice. ACH is the default; card payment is optional."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Billing contact
          <select
            value={billingEmail}
            onChange={(event) => setBillingEmail(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select verified contact</option>
            {verifiedEmails.map((contact) => (
              <option key={contact.id} value={contact.email ?? ""}>
                {contact.name} — {contact.email}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium">
          Purchase order number
          <input
            value={purchaseOrderNumber}
            onChange={(event) => setPurchaseOrderNumber(event.target.value)}
            placeholder="Optional"
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>

        <label className="text-sm font-medium">
          Payment terms
          <select
            value={netDays}
            onChange={(event) => setNetDays(Number(event.target.value))}
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={0}>Due on receipt</option>
            <option value={15}>Net 15</option>
            <option value={30}>Net 30</option>
            <option value={45}>Net 45</option>
            <option value={60}>Net 60</option>
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-md border border-input px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={allowCard}
            onChange={(event) => setAllowCard(event.target.checked)}
            className="size-4"
          />
          Allow credit card in addition to ACH
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={issueInvoice} disabled={busy || !billingEmail}>
          <FileText className="size-4" />
          {busy ? "Issuing invoice…" : "Issue $65,000 invoice"}
        </Button>
        {hostedInvoiceUrl && (
          <Button variant="outline" asChild>
            <a href={hostedInvoiceUrl} target="_blank" rel="noreferrer noopener">
              Open invoice <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
      </div>

      {!verifiedEmails.length && (
        <p className="mt-4 text-xs text-amber-700">
          Add a verified decision-maker email before issuing an enterprise invoice.
        </p>
      )}
    </Panel>
  );
}
