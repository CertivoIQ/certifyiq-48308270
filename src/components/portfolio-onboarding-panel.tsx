import { Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Download, FileSpreadsheet } from "lucide-react";
import { listPortfolioSummary } from "@/lib/portfolio-intake.functions";
import { createPortfolioOnboarding } from "@/lib/portfolio-onboarding.functions";
import {
  ONBOARDING_FIELDS, ONBOARDING_MAX_BYTES, ONBOARDING_STATE_CODES,
  previewOnboarding, readOnboardingCsv, suggestOnboardingMapping,
  type CsvTable, type OnboardingField, type OnboardingMapping, type OnboardingOptions,
} from "@/lib/portfolio-onboarding-csv";

const fields = Object.keys(ONBOARDING_FIELDS) as OnboardingField[];
const ONBOARDING_TEMPLATE = fields.join(",") + "\n";

export function PortfolioOnboardingPanel() {
  const queryClient = useQueryClient();
  const createOnboarding = useServerFn(createPortfolioOnboarding);
  const listSummary = useServerFn(listPortfolioSummary);
  const selectionVersion = useRef(0);
  const [manifest, setManifest] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<OnboardingMapping>({});
  const [stateByPropertyId, setStateByPropertyId] = useState<Record<string, string>>({});
  const [dateOrder, setDateOrder] = useState<NonNullable<OnboardingOptions["dateOrder"]>>("ISO");
  const [confirmed, setConfirmed] = useState(false);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Choose your portfolio CSV to begin.");
  const summary = useQuery({ queryKey: ["portfolio-intake-summary"], queryFn: () => listSummary() });
  const totals = useMemo(() => {
    const rows = summary.data ?? [];
    return { properties: rows.length, units: rows.reduce((sum, property) => sum + property.unitCount, 0), tenants: rows.reduce((sum, property) => sum + property.tenantCount, 0) };
  }, [summary.data]);
  const suggestions = useMemo(() => table ? suggestOnboardingMapping(table.headers) : null, [table]);
  const preview = useMemo(() => table ? previewOnboarding(table, mapping, { stateByPropertyId, dateOrder }) : null, [table, mapping, stateByPropertyId, dateOrder]);
  // Keep state controls visible after selection, so the user can correct a choice.
  const missingFileStates = useMemo(() => table ? previewOnboarding(table, mapping, { dateOrder }).stateNeeded : [], [table, mapping, dateOrder]);
  const unmappedHeaders = table?.headers.filter((_, index) => !Object.values(mapping).includes(index)) ?? [];

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([ONBOARDING_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "certivoiq-portfolio-tenant-onboarding-template.csv"; anchor.click();
    URL.revokeObjectURL(url);
  }
  function edited() { setConfirmed(false); setMessage(""); setProgressPercent(0); setProgressLabel("Review the matched fields and preview before importing."); }
  async function chooseManifest(file: File | null) {
    const version = ++selectionVersion.current;
    setManifest(null); setTable(null); setText(""); setMapping({}); setStateByPropertyId({}); setDateOrder("ISO"); setConfirmed(false); setMessage(""); setProgressPercent(0); setReading(false);
    if (!file) { setProgressLabel("Choose your portfolio CSV to begin."); return; }
    if (!/\.(csv|tsv)$/i.test(file.name) && !["text/csv", "text/tab-separated-values"].includes(file.type)) {
      setMessage("Choose a CSV or TSV export. Certification PDFs belong in Upload Certification & OCR after setup."); return;
    }
    if (file.size > ONBOARDING_MAX_BYTES) { setMessage("The onboarding CSV must be 10 MB or smaller."); return; }
    setReading(true); setProgressLabel("Recognizing property, unit, and tenant fields…");
    try {
      const contents = await file.text();
      if (version !== selectionVersion.current) return;
      const parsed = readOnboardingCsv(contents);
      setManifest(file); setText(contents); setTable(parsed); setMapping(suggestOnboardingMapping(parsed.headers).mapping);
      setProgressLabel("Review the matched fields and preview before importing.");
    } catch (error) {
      if (version === selectionVersion.current) { setMessage(error instanceof Error ? error.message : "The CSV could not be read."); setProgressLabel("The selected file needs attention."); }
    } finally { if (version === selectionVersion.current) setReading(false); }
  }
  async function importPortfolio() {
    if (!manifest || busy || !preview?.canImport || !confirmed) return;
    setBusy(true); setMessage(""); setProgressPercent(20); setProgressLabel("Validating the confirmed field mapping…");
    try {
      setProgressPercent(40); setProgressLabel("Creating properties, units, and tenant profiles…");
      const intake = await createOnboarding({ data: { text, sourceName: manifest.name, mapping, stateByPropertyId, dateOrder } });
      setManifest(null); setTable(null); setText(""); setConfirmed(false); setProgressPercent(100); setProgressLabel("Portfolio onboarding task complete.");
      setMessage(`Created or updated ${intake.propertyCount} properties, ${intake.unitCount} units, and ${intake.tenantCount} tenant profiles. Return to LaunchPad to continue setup.`);
      // Saving succeeded even if a later read cannot refresh the summary immediately.
      try { await queryClient.invalidateQueries(); } catch { setMessage(`Saved ${intake.propertyCount} properties, ${intake.unitCount} units, and ${intake.tenantCount} tenant profiles. Refresh the setup checklist to reload the counts.`); }
    } catch (error) {
      setProgressPercent(0); setProgressLabel("Portfolio onboarding needs attention.");
      setMessage(error instanceof Error ? error.message : "The portfolio onboarding import could not be completed.");
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"><Building2 className="mt-0.5 size-5 text-primary" /><div>
          <h2 className="font-semibold">Portfolio & tenant onboarding</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Create the properties, units, and tenant profiles your organization will use. Use your existing export: equivalent column headings are matched automatically, and unfamiliar headings can be matched below. Certification documents are uploaded separately.</p>
        </div></div>
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"><Download className="size-4" /> Download onboarding CSV</button>
      </div>
      <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/30">
        <FileSpreadsheet className="size-8 text-muted-foreground" /><span className="mt-3 font-medium">Choose portfolio & tenant CSV</span>
        <span className="mt-1 text-xs text-muted-foreground">Your existing CSV or TSV · template optional · up to 5,000 tenant rows / 10 MB</span>
        <span className="mt-2 text-xs font-medium text-foreground">{reading ? "Reading selected file…" : manifest?.name ?? "No CSV selected"}</span>
        <input className="sr-only" type="file" disabled={busy} accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={(event) => { const file = event.target.files?.[0] ?? null; event.target.value = ""; void chooseManifest(file); }} />
      </label>
      {table && preview ? (
        <fieldset disabled={busy} className="mt-5 min-w-0 space-y-5">
          <legend className="font-semibold">Match fields & preview</legend>
          <p className="text-sm text-muted-foreground">{table.records.length.toLocaleString()} source rows detected. Review the suggested matches. Reference IDs stay unchanged; a household name is assembled from first, middle, and last name when no full-name column is supplied.</p>
          <details open className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Column matches</summary>
            <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">CertivoIQ field</th><th className="p-2">Your source column</th><th className="p-2">First source value</th></tr></thead><tbody>
              {fields.map((field) => {
                const index = mapping[field];
                const automatic = suggestions?.mapping[field] === index && index != null;
                const ambiguous = (suggestions?.candidates[field]?.length ?? 0) > 1 && index == null;
                return <tr key={field} className="border-b last:border-0"><th scope="row" className="p-2 font-medium">{ONBOARDING_FIELDS[field].label}</th><td className="p-2">
                  <select aria-label={`Source column for ${ONBOARDING_FIELDS[field].label}`} className="w-full min-w-48 rounded-md border bg-background p-2" value={index == null ? "" : String(index)} onChange={(event) => { edited(); setMapping((old) => ({ ...old, [field]: event.target.value === "" ? null : Number(event.target.value) })); }}>
                    <option value="">Not mapped</option>{table.headers.map((heading, column) => <option key={column} value={column}>{column + 1}. {heading || "(blank heading)"}</option>)}
                  </select><span className="mt-1 block text-xs text-muted-foreground">{ambiguous ? "Multiple matches — choose the correct column" : automatic ? "Auto-matched" : index != null ? "Selected match" : "No source column selected"}</span>
                </td><td className="max-w-64 truncate p-2" title={index == null ? "" : table.records[0]?.[index] ?? ""}>{index == null ? "—" : table.records[0]?.[index] || "(blank)"}</td></tr>;
              })}
            </tbody></table></div>
          </details>
          {missingFileStates.length ? <div className="rounded-lg border p-4"><h3 className="text-sm font-semibold">Property state not supplied in this file</h3><p className="mt-1 text-sm text-muted-foreground">Select each property's actual state. No state is inferred from names or sample data.</p><div className="mt-3 grid gap-3 md:grid-cols-2">
            {missingFileStates.map((property) => <label key={property.id} className="text-sm">{property.name} ({property.id})<select aria-label={`State for ${property.name} (${property.id})`} className="mt-1 block w-full rounded-md border bg-background p-2" value={stateByPropertyId[property.id] ?? ""} onChange={(event) => { edited(); setStateByPropertyId((old) => ({ ...old, [property.id]: event.target.value })); }}><option value="">Select property state</option>{ONBOARDING_STATE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>)}
          </div></div> : null}
          <label className="block text-sm font-medium">Date format for non-ISO dates<select className="mt-1 block rounded-md border bg-background p-2 font-normal" value={dateOrder} onChange={(event) => { edited(); setDateOrder(event.target.value as NonNullable<OnboardingOptions["dateOrder"]>); }}><option value="ISO">YYYY-MM-DD only</option><option value="MDY">Month / day / year</option><option value="DMY">Day / month / year</option></select></label>
          <p className="text-sm text-muted-foreground">Certification type and program are optional for onboarding. Missing values remain unspecified; they are not guessed. Building, occupancy, name components, and other source columns are retained as import source details, not certification determinations.</p>
          {unmappedHeaders.length ? <p className="text-xs text-muted-foreground">Retained as source details only: {unmappedHeaders.map((name) => name || "(blank heading)").join(", ")}</p> : null}
          {preview.issueCount ? <div role="alert" className="rounded-lg border p-3 text-sm"><p className="font-medium">Resolve {preview.issueCount} mapping or data issue{preview.issueCount === 1 ? "" : "s"} before importing.</p>{preview.issues.slice(0, 8).map((issue, index) => <p key={index} className="mt-1">{issue}</p>)}{preview.issueCount > 8 ? <p className="mt-1">Showing the first 8 issues. Correct these to continue reviewing.</p> : null}</div> : null}
          {preview.rows.length ? <div className="overflow-x-auto rounded-lg border p-3"><p className="mb-2 text-sm font-semibold">Preview: {preview.counts.properties} properties · {preview.counts.units} units · {preview.counts.tenants} tenant profiles</p><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Property</th><th className="p-2">Unit</th><th className="p-2">Tenant reference</th><th className="p-2">Household name</th><th className="p-2">State</th></tr></thead><tbody>{preview.rows.slice(0, 5).map((row, index) => <tr key={index} className="border-t"><td className="p-2">{row.propertyName}</td><td className="p-2">{row.unitNumber}</td><td className="p-2">{row.tenantExternalId}</td><td className="p-2">{row.householdName}</td><td className="p-2">{row.state || "Select state"}</td></tr>)}</tbody></table><p className="mt-2 text-xs text-muted-foreground">Showing the first {Math.min(5, preview.rows.length)} rows. All rows are validated before saving.</p></div> : null}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={!preview.canImport} onChange={(event) => setConfirmed(event.target.checked)} /><span>I have reviewed the field matches, property states, and preview. Import these onboarding records.</span></label>
        </fieldset>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm"><span>{totals.properties} properties · {totals.units} units · {totals.tenants} tenant profiles currently loaded</span><button type="button" disabled={!manifest || reading || busy || !confirmed || !preview?.canImport} onClick={() => void importPortfolio()} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">{busy ? "Importing…" : "Import onboarding records"}</button></div>
      <div className="mt-3 rounded-lg border bg-background p-3" aria-live="polite"><div className="flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">{progressLabel}</span><span className="font-semibold tabular-nums">{progressPercent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Portfolio onboarding progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${progressPercent}%` }} /></div></div>
      <div className="mt-4"><Link to="/launchpad" className="text-sm font-medium text-primary underline">Return to setup checklist</Link></div>
      {message ? <p className="mt-3 rounded-lg border bg-background p-3 text-sm" role="status">{message}</p> : null}
      {summary.data?.length ? <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-2 pr-4">Property</th><th className="py-2 pr-4">State</th><th className="py-2 pr-4">Units</th><th className="py-2">Tenants</th></tr></thead><tbody>{summary.data.map((property) => <tr key={property.id} className="border-b last:border-0"><td className="py-2 pr-4 font-medium">{property.name}</td><td className="py-2 pr-4">{property.state_code}</td><td className="py-2 pr-4">{property.unitCount}</td><td className="py-2">{property.tenantCount}</td></tr>)}</tbody></table></div> : null}
    </section>
  );
}
