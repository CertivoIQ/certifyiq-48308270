import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Download, FileSpreadsheet } from "lucide-react";

import { PORTFOLIO_IMPORT_COLUMNS, parsePortfolioIntakeCsv } from "@/lib/portfolio-intake";
import {
  createPortfolioIntake,
  finalizePortfolioIntake,
  listPortfolioSummary,
} from "@/lib/portfolio-intake.functions";

const ONBOARDING_TEMPLATE = `${PORTFOLIO_IMPORT_COLUMNS.join(",")}\n` +
  "PROP-001,Oak Terrace,TN,100 Main St,Nashville,37201,UNIT-101,101,2,TENANT-001,Sample Household,2026-01-15,ANNUAL,2026-09-01,LIHTC|HOME,\n";

export function PortfolioOnboardingPanel() {
  const queryClient = useQueryClient();
  const createIntake = useServerFn(createPortfolioIntake);
  const finalizeIntake = useServerFn(finalizePortfolioIntake);
  const listSummary = useServerFn(listPortfolioSummary);
  const [manifest, setManifest] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Choose your portfolio CSV to begin.");

  const summary = useQuery({
    queryKey: ["portfolio-intake-summary"],
    queryFn: () => listSummary(),
  });

  const totals = useMemo(() => {
    const rows = summary.data ?? [];
    return {
      properties: rows.length,
      units: rows.reduce((sum, property) => sum + property.unitCount, 0),
      tenants: rows.reduce((sum, property) => sum + property.tenantCount, 0),
    };
  }, [summary.data]);

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([ONBOARDING_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "certivoiq-portfolio-tenant-onboarding-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function chooseManifest(file: File | null) {
    if (!file) {
      setManifest(null);
      setProgressPercent(0);
      setProgressLabel("Choose your portfolio CSV to begin.");
      return;
    }

    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
    if (!isCsv) {
      setManifest(null);
      setMessage("Portfolio onboarding requires the CSV template. Certification PDFs belong in Upload Certification & OCR after setup.");
      return;
    }

    setManifest(file);
    setMessage("");
    setProgressPercent(0);
    setProgressLabel("Ready to validate property, unit, and tenant records.");
  }

  async function importPortfolio() {
    if (!manifest || busy) return;

    setBusy(true);
    setMessage("");
    setProgressPercent(5);
    setProgressLabel("Validating portfolio onboarding records…");
    let jobId: string | null = null;

    try {
      const parsedRows = parsePortfolioIntakeCsv(await manifest.text());
      const onboardingRows = parsedRows.map((row) => ({ ...row, documentFileName: undefined }));

      setProgressPercent(35);
      setProgressLabel("Creating properties, units, and tenant profiles…");
      const intake = await createIntake({
        data: {
          rows: onboardingRows,
          documentCount: 0,
          sourceName: manifest.name,
        },
      });
      jobId = intake.jobId;

      setProgressPercent(85);
      setProgressLabel("Finalizing onboarding intake…");
      await finalizeIntake({ data: { jobId: intake.jobId, itemCount: 0, errorCount: 0 } });

      setManifest(null);
      setProgressPercent(100);
      setProgressLabel("Portfolio onboarding task complete.");
      setMessage(
        `Created or updated ${intake.propertyCount} properties, ${intake.unitCount} units, and ${intake.tenantCount} tenant profiles. Return to LaunchPad to continue setup.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["portfolio-intake-summary"] });
    } catch (error) {
      if (jobId) {
        try {
          await finalizeIntake({ data: { jobId, itemCount: 0, errorCount: 1 } });
        } catch {
          // Preserve the original onboarding failure.
        }
      }
      setProgressPercent(0);
      setProgressLabel("Portfolio onboarding needs attention.");
      setMessage(error instanceof Error ? error.message : "The portfolio onboarding import could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Portfolio & tenant onboarding</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Create the properties, units, and tenant profiles your organization will use. Certification documents are uploaded separately after this setup task.
            </p>
          </div>
        </div>
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
          <Download className="size-4" /> Download onboarding CSV
        </button>
      </div>

      <label className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/30">
        <FileSpreadsheet className="size-8 text-muted-foreground" />
        <span className="mt-3 font-medium">Choose portfolio & tenant CSV</span>
        <span className="mt-1 text-xs text-muted-foreground">Use the CertivoIQ onboarding template · certification files are not uploaded here</span>
        <span className="mt-2 text-xs font-medium text-foreground">{manifest?.name ?? "No CSV selected"}</span>
        <input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => chooseManifest(event.target.files?.[0] ?? null)} />
      </label>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm">
        <span>{totals.properties} properties · {totals.units} units · {totals.tenants} tenant profiles currently loaded</span>
        <button
          type="button"
          disabled={!manifest || busy}
          onClick={() => void importPortfolio()}
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import onboarding records"}
        </button>
      </div>

      <div className="mt-3 rounded-lg border bg-background p-3" aria-live="polite">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate text-muted-foreground">{progressLabel}</span>
          <span className="font-semibold tabular-nums text-foreground">{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Portfolio onboarding progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="mt-4"><Link to="/launchpad" className="text-sm font-medium text-primary underline">Return to setup checklist</Link></div>

      {message ? <p className="mt-3 rounded-lg border bg-background p-3 text-sm" role="status">{message}</p> : null}

      {summary.data?.length ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr><th className="py-2 pr-4">Property</th><th className="py-2 pr-4">State</th><th className="py-2 pr-4">Units</th><th className="py-2">Tenants</th></tr>
            </thead>
            <tbody>
              {summary.data.map((property) => (
                <tr key={property.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{property.name}</td>
                  <td className="py-2 pr-4">{property.state_code}</td>
                  <td className="py-2 pr-4">{property.unitCount}</td>
                  <td className="py-2">{property.tenantCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
