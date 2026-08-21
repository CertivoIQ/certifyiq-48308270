import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, ExternalLink, KeyRound, Plug, RefreshCw, ShieldCheck } from "lucide-react";
import { Pill } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/pms-hub")({ component: PmsHubPage });

const READINESS = [
  { label: "Partner application", state: "action", detail: "Apply for ResMan API access and a development instance." },
  { label: "Development instance", state: "blocked", detail: "Waiting for ResMan approval." },
  { label: "Credentials configured", state: "blocked", detail: "Stored as server secrets, never in application tables or the browser." },
  { label: "Health check", state: "blocked", detail: "Verify issued API base URL, Integration Partner ID, and API key." },
  { label: "Reconciliation", state: "blocked", detail: "Property and resident counts and external IDs must match." },
  { label: "Production", state: "blocked", detail: "Enabled only after health and reconciliation gates pass." },
] as const;

const DOCUMENTED_SCOPE = [
  "Account/GetAccountID",
  "Account/GetProperties",
  "Leasing/GetApplicantsAndCurrentResidents",
  "Leasing/GetCurrentResidents",
] as const;

function PmsHubPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <header className="rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary"><Plug className="size-4" /> PMS Integration Hub</div>
          <Pill tone="neutral">NOT CONNECTED</Pill>
        </div>
        <h1 className="mt-3 text-3xl font-semibold">ResMan connector foundation</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          ResMan is the first planned API connector. CertivoIQ will not describe it as a live integration until provider credentials, a production health check, and record reconciliation have passed.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><RefreshCw className="size-5" /></div>
            <div>
              <h2 className="font-semibold">Connection readiness</h2>
              <p className="mt-1 text-sm text-muted-foreground">Complete each gate in order. No customer data is pulled during setup.</p>
            </div>
          </div>
          <ol className="mt-6 space-y-3">
            {READINESS.map((step, index) => (
              <li key={step.label} className="flex gap-3 rounded-xl border p-4">
                {step.state === "action"
                  ? <AlertCircle className="mt-0.5 size-5 shrink-0 text-gold" />
                  : <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px] text-muted-foreground">{index + 1}</span>}
                <div><p className="text-sm font-semibold">{step.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p></div>
              </li>
            ))}
          </ol>
          <a
            href="https://www.myresman.com/partner-with-resman/"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Apply to the ResMan Partner Program <ExternalLink className="size-4" />
          </a>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /><h2 className="font-semibold">Required from ResMan</h2></div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {["Development instance", "Issued API base URL", "Integration Partner ID", "API key", "Approved account and resident-data scope"].map((item) => (
                <li key={item} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{item}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h2 className="font-semibold">Security boundary</h2></div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              ResMan credentials are read only from server environment secrets. CertivoIQ stores a secret reference and sync status—not the API key—in the application database.
            </p>
          </section>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Initial documented API scope</h2>
        <p className="mt-1 text-sm text-muted-foreground">These endpoints are mapped for development; they have not been authenticated against a ResMan instance yet.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {DOCUMENTED_SCOPE.map((endpoint) => <code key={endpoint} className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">{endpoint}</code>)}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Certification-document retrieval and writing review results back to ResMan remain out of scope until ResMan confirms the permitted affordable-housing API methods.
        </p>
      </section>
    </main>
  );
}
