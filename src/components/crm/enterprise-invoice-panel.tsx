import { useMemo, useState, type ComponentProps } from "react";
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
import { US_STATE_CODE_LIST } from "@/lib/license-selection";
import { usePaymentConfiguration, type StripeEnv } from "@/lib/stripe";

type InvoiceContact = {
  id: string;
  name: string;
  email: string | null;
};

function moneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString()}`;
}

export function EnterpriseInvoicePanel(props: Omit<ComponentProps<typeof ConfiguredEnterpriseInvoicePanel>, 'environment'>) {
  const configuration = usePaymentConfiguration();
  if (!configuration.data) return <Panel title="Enterprise billing"><p role={configuration.isError ? 'alert' : 'status'}>{configuration.isError ? 'Billing is temporarily unavailable. Please retry.' : 'Loading billing…'}</p>{configuration.isError && <Button onClick={() => void configuration.refetch()}>Retry</Button>}</Panel>;
  return <ConfiguredEnterpriseInvoicePanel {...props} environment={configuration.data.environment} />;
}

function ConfiguredEnterpriseInvoicePanel({
  accountId,
  accountName,
  contacts,
  initialPricingClass,
  environment,
}: {
  accountId: string;
  accountName: string;
  contacts: InvoiceContact[];
  initialPricingClass: LicensePricingClass;
  environment: StripeEnv;
}) {
  const verifiedEmails = useMemo(
    () => contacts.filter((contact) => Boolean(contact.email)),
    [contacts],
  );
  const [billingEmail, setBillingEmail] = useState(verifiedEmails[0]?.email ?? "");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [netDays, setNetDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [pricingClass, setPricingClass] = useState<LicensePricingClass>("standard");
  const [stateCodes, setStateCodes] = useState<string[]>([]);
  const [hostedInvoiceUrl, setHostedInvoiceUrl] = useState<string | null>(null);
  const stateSelectionIsValid =
    pricingClass === "pha" ? stateCodes.length === 1 : stateCodes.length > 0;
  const displayedPrice =
    pricingClass === "pha"
      ? "$150,000"
      : stateCodes.length
        ? moneyFromCents(6_500_000 * stateCodes.length)
        : "$65,000/state";

  const toggleState = (stateCode: string) => {
    setHostedInvoiceUrl(null);
    setStateCodes((current) => {
      if (pricingClass === "pha") return [stateCode];
      return current.includes(stateCode)
        ? current.filter((code) => code !== stateCode)
        : [...current, stateCode].sort();
    });
  };

  const changePricingClass = async (next: LicensePricingClass) => {
    if (next === pricingClass) return;
    setBusy(true);
    try {
      const result = await updateLicensePricingClass({
        data: { accountId, pricingClass: next },
      });
      if ("error" in result) throw new Error(result.error);
      setPricingClass(next);
      setStateCodes((current) => (next === "pha" ? current.slice(0, 1) : current));
      setHostedInvoiceUrl(null);
      toast.success(
        next === "pha"
          ? "PHA pricing applied: $150,000/year."
          : "Multifamily Enterprise pricing applied: $65,000/state/year.",
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
    if (!stateSelectionIsValid) {
      toast.error(
        pricingClass === "pha"
          ? "Select one PHA operating state."
          : "Select at least one licensed state rule pack.",
      );
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
          promotionCode: promotionCode || undefined,
          netDays,
          allowCard: false,
          environment,
          stateCodes,
        },
      });
      if ("error" in result) throw new Error(result.error);

      setPricingClass(result.pricingClass);
      setHostedInvoiceUrl(result.hostedInvoiceUrl);
      toast.success(
        `${result.invoiceNumber ?? "Enterprise invoice"} issued. First invoice: ${moneyFromCents(
          result.firstInvoiceAmountCents,
        )}${result.promotionCode ? ` with ${result.promotionCode}` : ""}.`,
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
    if (!stateSelectionIsValid) {
      toast.error(
        pricingClass === "pha"
          ? "Select one PHA operating state."
          : "Select at least one licensed state rule pack.",
      );
      return;
    }
    setBusy(true);
    try {
      const result = await automateEnterpriseLicenseInvoice({
        data: {
          accountId,
          purchaseOrderNumber: purchaseOrderNumber || undefined,
          promotionCode: promotionCode || undefined,
          netDays,
          allowCard: false,
          environment,
          sandboxTest,
          stateCodes,
        },
      });
      if ("error" in result) throw new Error(result.error);
      setPricingClass(result.pricingClass);
      setHostedInvoiceUrl(result.hostedInvoiceUrl);
      const firstInvoice = moneyFromCents(result.firstInvoiceAmountCents);
      const offer = result.promotionCode ? ` with ${result.promotionCode}` : "";
      toast.success(
        sandboxTest
          ? `${result.invoiceNumber ?? "Sandbox invoice"} created. First invoice: ${firstInvoice}${offer}.`
          : `${result.invoiceNumber ?? "Enterprise invoice"} created and sent to ${result.billingEmail}. First invoice: ${firstInvoice}${offer}.`,
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
      description="Multifamily Enterprise is $65,000 per selected state each year. The server validates the selected states and derives every invoice amount."
    >
      <div className="mb-5 grid gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="font-semibold text-emerald-950 dark:text-emerald-50">
            License pricing class
          </p>
          <p className="mt-1 text-emerald-800 dark:text-emerald-200">
            The invoice server reads this CRM classification before creating any invoice. Staff
            never enters the annual amount manually.
          </p>
          <select
            value={pricingClass}
            onChange={(event) => void changePricingClass(event.target.value as LicensePricingClass)}
            disabled={busy}
            className="mt-3 h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="standard">Multifamily Enterprise — $65,000/state/year</option>
          </select>
        </div>
        <div className="rounded-md border border-emerald-300 bg-white px-4 py-3 text-right dark:border-emerald-800 dark:bg-emerald-950">
          <p className="text-xs text-muted-foreground">Annual license</p>
          <p className="text-xl font-semibold">{displayedPrice}</p>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-input p-4">
        <p className="text-sm font-semibold">Licensed state rule packs</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {pricingClass === "pha"
            ? "Select the PHA operating state. The annual price remains $150,000."
            : "Select every state in which the organization operates. Each selected state is $65,000 annually."}
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7 md:grid-cols-9">
          {US_STATE_CODE_LIST.map((stateCode) => (
            <label
              key={stateCode}
              className="flex items-center gap-1.5 rounded border border-input px-2 py-1.5 text-xs"
            >
              <input
                type={pricingClass === "pha" ? "radio" : "checkbox"}
                name={pricingClass === "pha" ? "pha-state" : undefined}
                checked={stateCodes.includes(stateCode)}
                onChange={() => toggleState(stateCode)}
                disabled={busy}
              />
              {stateCode}
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs font-medium">
          {stateCodes.length
            ? `${stateCodes.length} selected: ${stateCodes.join(", ")}`
            : "No state rule pack selected."}
        </p>
      </div>

      <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="font-semibold text-emerald-950 dark:text-emerald-50">Automated workflow</p>
        <p className="mt-1 text-emerald-800 dark:text-emerald-200">
          CRM organization → pricing class → preferred verified finance/billing contact → PO/terms →
          ACH/bank-transfer rules → monthly invoice under a 12-month commitment → CRM log →
          paid-invoice license activation.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => void runAutomation(false)}
            disabled={busy || !verifiedEmails.length || !stateSelectionIsValid}
          >
            <Workflow className="size-4" />
            {busy ? "Running…" : "Run automated invoice workflow"}
          </Button>
          {environment === "sandbox" && (
            <Button
              variant="outline"
              onClick={() => void runAutomation(true)}
              disabled={busy || !verifiedEmails.length || !stateSelectionIsValid}
            >
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
          Founding Customer offer code
          <input
            value={promotionCode}
            onChange={(event) => {
              setPromotionCode(event.target.value.toUpperCase());
              setHostedInvoiceUrl(null);
            }}
            placeholder="Optional — FOUNDERS50"
            autoComplete="off"
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm uppercase"
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            FOUNDERS50 applies 50% off the first 12 monthly base-license invoices when redeemed by
            November 30, 2026. Merlin is excluded.
          </span>
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

        <div className="rounded-md border border-input px-3 py-2 text-sm">
          <p className="font-medium">Payment methods</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Invoice only: ACH Direct Debit or bank transfer. Card payment is disabled for base
            licenses.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={issueInvoice}
          disabled={busy || !billingEmail || !stateSelectionIsValid}
        >
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
