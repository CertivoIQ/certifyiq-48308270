import { useMemo, useState } from "react";
import { ExternalLink, FileText, Workflow } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui-kit";
import {
  automateEnterpriseLicenseInvoice,
  createEnterpriseLicenseInvoice,
} from "@/lib/enterprise-invoice.functions";
import {
  updateLicensePricingClass,
  type LicensePricingClass,
} from "@/lib/license-pricing.functions";
import { getStripeEnvironment } from "@/lib/stripe";

type InvoiceContact = {
  id: string;
  name: string;
  email: string | null;
};

function moneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString()}`;
}

export function EnterpriseInvoicePanel({
  accountId,
  accountName,
  contacts,
  initialPricingClass,
}: {
  accountId: string;
  accountName: string;
  contacts: InvoiceContact[];
  initialPricingClass: LicensePricingClass;
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
  const [pricingClass, setPricingClass] = useState<LicensePricingClass>(initialPricingClass);
  const [hostedInvoiceUrl, setHostedInvoiceUrl] = useState<string | null>(null);
  const environment = getStripeEnvironment();
  const displayedPrice = pricingClass === "pha" ? "$150,000" : "$65,000";

  const changePricingClass = async (next: LicensePricingClass) => {
    if (next === pricingClass) return;
    setBusy(true);
    try {
      const result = await updateLicensePricingClass({
        data: { accountId, pricingClass: next },
      });
      if ("error" in result) throw new Error(result.error);
      setPricingClass(next);
      setHostedInvoiceUrl(null);
      toast.success(
        next === "pha"
          ? "PHA pricing applied: $150,000/year."
          : "Standard organization pricing applied: $65,000/year.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pricing class update failed");
    } finally {
      setBusy(false);
    }
  };

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

      setPricingClass(result.pricingClass);
      setHostedInvoiceUrl(result.hostedInvoiceUrl);
      toast.success(
        `${result.invoiceNumber ?? "Enterprise invoice"} issued for ${moneyFromCents(result.annualPriceCents)}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invoice issuance failed");
    } finally {
      setBusy(false);
    }
  };

  const runAutomation = async (sandboxTest = false) => {
    if (sandboxTest && environment !== "sandbox") {
      toast.error("Switch billing to sandbox before creating a test invoice.");
      return;
    }
    setBusy(true);
    try {
      const result = await automateEnterpriseLicenseInvoice({
        data: {
          accountId,
          purchaseOrderNumber: purchaseOrderNumber || undefined,
          netDays,
          allowCard,
          environment,
          sandboxTest,
        },
      });
      if ("error" in result) throw new Error(result.error);
      setPricingClass(result.pricingClass);
      setHostedInvoiceUrl(result.hostedInvoiceUrl);
      const amount = moneyFromCents(result.annualPriceCents);
      toast.success(
        sandboxTest
          ? `${result.invoiceNumber ?? "Sandbox invoice"} created for ${amount} through the automated workflow.`
          : `${result.invoiceNumber ?? "Enterprise invoice"} for ${amount} created and sent automatically to ${result.billingEmail}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Automated invoice workflow failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Enterprise license invoice"
      description="Pricing is controlled by the CRM organization class: standard organizations are $65,000/year and PHAs are $150,000/year. Automation resolves the billing contact and defaults to Net 30 + ACH."
    >
      <div className="mb-5 grid gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="font-semibold text-emerald-950 dark:text-emerald-50">License pricing class</p>
          <p className="mt-1 text-emerald-800 dark:text-emerald-200">
            The invoice server reads this CRM classification before creating any invoice. Staff never enters the annual amount manually.
          </p>
          <select
            value={pricingClass}
            onChange={(event) => void changePricingClass(event.target.value as LicensePricingClass)}
            disabled={busy}
            className="mt-3 h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="standard">Standard organization — $65,000/year</option>
            <option value="pha">Public Housing Authority (PHA) — $150,000/year</option>
          </select>
        </div>
        <div className="rounded-md border border-emerald-300 bg-white px-4 py-3 text-right dark:border-emerald-800 dark:bg-emerald-950">
          <p className="text-xs text-muted-foreground">Annual license</p>
          <p className="text-xl font-semibold">{displayedPrice}</p>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="font-semibold text-emerald-950 dark:text-emerald-50">Automated workflow</p>
        <p className="mt-1 text-emerald-800 dark:text-emerald-200">
          CRM organization → pricing class → preferred verified finance/billing contact → PO/terms → ACH/card rules → {displayedPrice} invoice → CRM log → paid-invoice license activation.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void runAutomation(false)} disabled={busy || !verifiedEmails.length}>
            <Workflow className="size-4" />
            {busy ? "Running…" : "Run automated invoice workflow"}
          </Button>
          {environment === "sandbox" && (
            <Button variant="outline" onClick={() => void runAutomation(true)} disabled={busy || !verifiedEmails.length}>
              Create sandbox test invoice
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Billing contact override
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
        <Button variant="outline" onClick={issueInvoice} disabled={busy || !billingEmail}>
          <FileText className="size-4" />
          {busy ? "Issuing invoice…" : `Issue ${displayedPrice} manually`}
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
