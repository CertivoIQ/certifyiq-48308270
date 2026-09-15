import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeCheck, Calculator, FileWarning, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import catalog from "@/lib/fy2026-income-limit-sources.json";
import {
  BEDROOM_SIZES,
  HOUSEHOLD_SIZES,
  HUD_LIMIT_BASES,
  STANDARD_AMI_LEVELS,
  buildUnsignedLimitProfileDraft,
  calculateRentIncomeLimits,
  allowedSourceFamilies,
  controlledDatasetFamily,
  manualSourceIssues,
  requiredSizeMethod,
  type LimitConfig,
  type LimitProfileDraft,
  type LimitProgram,
  type ManualSource,
  type RentFloorEvidence,
  type RentMethod,
  type SizeMethod,
  type SourceFamily,
} from "@/lib/rent-income-limit-engine.mjs";

const inputClass = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const bedroomLabel = (rooms: number) => (rooms === 0 ? "SRO / 0 BR" : `${rooms} BR`);
const currency = (amount: string | null) => (amount === null ? "Not determined" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount)));

const CONTROLLED_DATASETS = (catalog.official_sources ?? []).map((entry: Record<string, unknown>) => ({
  id: String(entry["dataset_id"]),
  status: String(entry["activation_status"] ?? "UNKNOWN"),
}));

const blankManual = (): ManualSource => ({
  kind: "MANUAL",
  authority: "",
  sourceReference: "",
  effectiveFrom: "",
  effectiveTo: "",
  geography: "",
  designation: "",
  basePercent: "50",
  limits: {},
  reviewConfirmed: false,
  reviewerName: "",
});

type SourceMode = "CONTROLLED" | "MANUAL";

const blankRentMethod = (): RentMethod => ({ methodReference: "", sourceReference: "", reviewerName: "", reviewConfirmed: false });
const blankFloorEvidence = (): RentFloorEvidence => ({ effectiveDate: "", sourceReference: "", reviewerName: "", reviewConfirmed: false });
const FAMILY_LABELS: Record<string, string> = { MTSP: "HUD MTSP (LIHTC / bond)", HOME: "HOME", HTF: "Housing Trust Fund", SECTION8: "HUD / Section 8", USDA_RD: "USDA Rural Development", STATE_LOCAL_MANUAL: "State / local (manual sourced set)" };

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="font-display text-lg">{title}</h2>
      {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({ title, value, onChange, type = "text", hint }: { title: string; value: string; onChange: (v: string) => void; type?: string; hint?: string }) {
  return (
    <label className="block min-w-0 text-xs font-medium">
      {title}
      <input aria-label={title} className={inputClass} type={type} value={value} maxLength={500} onChange={(e) => onChange(e.target.value)} />
      {hint ? <span className="mt-1 block font-normal leading-5 text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Choose({ title, value, onChange, options }: { title: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block min-w-0 text-xs font-medium">
      {title}
      <select aria-label={title} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({ children, checked, onChange }: { children: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm leading-5">
      <input className="mt-1 size-4 shrink-0 accent-primary" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function Toggles<T extends number>({ legend, values, selected, onChange, render }: { legend: string; values: readonly T[]; selected: T[]; onChange: (next: T[]) => void; render: (value: T) => string }) {
  return (
    <fieldset className="rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {values.map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              className="size-4 accent-primary"
              type="checkbox"
              checked={selected.includes(value)}
              onChange={(e) => onChange(e.target.checked ? [...selected, value] : selected.filter((item) => item !== value))}
            />
            {render(value)}
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...values])}>
          Select all
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([])}>
          Clear
        </Button>
      </div>
    </fieldset>
  );
}

function Status({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: ReactNode; tone: string }> = {
    DETERMINED: { label: "Source verified", icon: <BadgeCheck className="size-4" />, tone: "border-primary/40 bg-primary/5 text-foreground" },
    PARTIAL: { label: "Review required", icon: <FileWarning className="size-4" />, tone: "border-border bg-muted/40 text-foreground" },
    NOT_DETERMINED: { label: "Not determined", icon: <ShieldAlert className="size-4" />, tone: "border-destructive/40 bg-destructive/5 text-foreground" },
  };
  const state = map[status] ?? map["NOT_DETERMINED"]!;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${state.tone}`}>
      {state.icon}
      {state.label}
    </span>
  );
}

function Table({ caption, headers, rows }: { caption: string; headers: string[]; rows: (string | null)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <caption className="pb-2 text-left text-sm font-semibold">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="border-b border-border px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="odd:bg-muted/20">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-border px-3 py-2">
                  {cell ?? "Not determined"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RentIncomeLimits({
  headerSlot,
  propertyState,
  onUseLimits,
}: {
  headerSlot?: ReactNode;
  propertyState?: { stateCode: string; name: string } | null;
  onUseLimits?: (draft: LimitProfileDraft) => void;
}) {
  const [program, setProgram] = useState<LimitProgram>("LIHTC_SECTION42");
  const [limitYear, setLimitYear] = useState("2026");
  const [stateCode, setStateCode] = useState("");
  const [areaId, setAreaId] = useState("");
  const [msa, setMsa] = useState("");
  const [placedInServiceDate, setPlacedInServiceDate] = useState("");
  const [setAside, setSetAside] = useState("40_60");
  const [amiLevels, setAmiLevels] = useState<number[]>([50, 60]);
  const [customLevel, setCustomLevel] = useState("");
  const [customLevels, setCustomLevels] = useState<number[]>([]);
  const [ruralRule, setRuralRule] = useState(false);
  const [hudBasis, setHudBasis] = useState("");
  const [sizeMethod, setSizeMethod] = useState<SizeMethod>("ONE_POINT_FIVE");
  const [customSizes, setCustomSizes] = useState<Record<string, string>>({});
  const [householdSizes, setHouseholdSizes] = useState<number[]>([...HOUSEHOLD_SIZES]);
  const [bedroomSizes, setBedroomSizes] = useState<number[]>([...BEDROOM_SIZES]);
  const [utilityAllowances, setUtilityAllowances] = useState<Record<string, string>>({});
  const [grossRentFloor, setGrossRentFloor] = useState<Record<string, string>>({});
  const [showGrossRent, setShowGrossRent] = useState(true);
  const [showTenantPaid, setShowTenantPaid] = useState(true);
  const [showFmr, setShowFmr] = useState(false);
  const [showOneForty, setShowOneForty] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>("CONTROLLED");
  const [datasetId, setDatasetId] = useState(CONTROLLED_DATASETS[0]?.id ?? "");
  const [manual, setManual] = useState<ManualSource>(blankManual);
  const [manualLimitsText, setManualLimitsText] = useState("");
  const [sourceFamily, setSourceFamily] = useState<SourceFamily | "">("");
  const [rentMethod, setRentMethod] = useState<RentMethod>(blankRentMethod);
  const [floorEvidence, setFloorEvidence] = useState<RentFloorEvidence>(blankFloorEvidence);
  const [historicalIncomeLevels, setHistoricalIncomeLevels] = useState<number[]>([50, 60]);
  const [historicalRentLevels, setHistoricalRentLevels] = useState<number[]>([60]);
  const [calculated, setCalculated] = useState<LimitConfig | null>(null);
  const [carryLevel, setCarryLevel] = useState("");

  const manualLimits = useMemo(() => {
    const limits: Record<string, string> = {};
    for (const line of manualLimitsText.split("\n")) {
      const [size, amount] = line.split("=").map((part) => part.trim());
      if (size && amount) limits[size] = amount;
    }
    return limits;
  }, [manualLimitsText]);

  const config = useMemo<LimitConfig>(
    () => ({
      program,
      limitYear,
      stateCode,
      areaId,
      msa,
      placedInServiceDate,
      setAside: setAside as Exclude<LimitConfig["setAside"], undefined>,
      amiLevels,
      customLevels,
      householdSizes,
      bedroomSizes,
      sizeMethod,
      customSizes,
      utilityAllowances,
      grossRentFloor,
      showGrossRent,
      showTenantPaid,
      showFmr,
      showOneForty,
      showHistorical,
      hudBasis: hudBasis as Exclude<LimitConfig["hudBasis"], undefined>,
      sourceFamily: sourceFamily as Exclude<LimitConfig["sourceFamily"], undefined>,
      rentMethod,
      rentFloorEvidence: floorEvidence,
      historicalIncomeLevels,
      historicalRentLevels,
      ruralRule,
      source:
        sourceMode === "CONTROLLED"
          ? { kind: "CONTROLLED", program, datasetId }
          : { ...manual, kind: "MANUAL", program, reviewedProgram: program, limits: manualLimits },
      catalog: catalog as Exclude<LimitConfig["catalog"], undefined>,
      historicalRecords: [],
      fmrRecords: [],
    }),
    [program, limitYear, stateCode, areaId, msa, placedInServiceDate, setAside, amiLevels, customLevels, householdSizes, bedroomSizes, sizeMethod, customSizes, utilityAllowances, grossRentFloor, showGrossRent, showTenantPaid, showFmr, showOneForty, showHistorical, hudBasis, sourceFamily, rentMethod, floorEvidence, historicalIncomeLevels, historicalRentLevels, ruralRule, sourceMode, datasetId, manual, manualLimits],
  );

  const families = useMemo(() => allowedSourceFamilies({ program, sourceFamily: (sourceFamily || undefined) as SourceFamily }), [program, sourceFamily]);
  const datasetOptions = useMemo(() => CONTROLLED_DATASETS.filter((dataset) => families.includes(controlledDatasetFamily(dataset.id) ?? "")), [families]);

  useEffect(() => {
    setCalculated(null);
    setCarryLevel("");
    setManual((current) => ({ ...current, reviewConfirmed: false }));
    if (requiredSizeMethod(program)) setSizeMethod("ONE_POINT_FIVE");
    if (program !== "OTHER_PROGRAM") setSourceFamily("MTSP");
    else setSourceFamily("");
  }, [program]);
  useEffect(() => {
    setCalculated(null);
    setCarryLevel("");
  }, [sourceMode, datasetId, sourceFamily]);
  useEffect(() => {
    if (datasetId && !datasetOptions.some((dataset) => dataset.id === datasetId)) setDatasetId("");
  }, [datasetOptions, datasetId]);

  const result = useMemo(() => (calculated ? calculateRentIncomeLimits(calculated) : null), [calculated]);
  const manualIssues = sourceMode === "MANUAL" ? manualSourceIssues({ ...manual, limits: manualLimits }) : [];

  const carry = () => {
    if (!calculated || !result) return;
    const level = Number(carryLevel || result.incomeLimits[0]?.level);
    const built = buildUnsignedLimitProfileDraft(calculated, result, Number.isFinite(level) ? level : null);
    if (!built.ok || !built.draft) {
      toast.error(built.issues[0] ?? "These limits cannot be carried into Household Income.");
      return;
    }
    onUseLimits?.(built.draft);
  };

  return (
    <AppShell title="Rent & Income Limits" subtitle="Calculate and document program-specific rent and income limits from controlled source data.">
      {headerSlot}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Calculator className="size-6 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Rent & Income Limits</p>
            <p className="text-xs text-muted-foreground">Nothing is inferred. Limits appear only from an activated controlled dataset or a reviewed sourced limit set.</p>
          </div>
        </div>
        <Status status={result?.status ?? "NOT_DETERMINED"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card title="Program & project context">
            <fieldset className="rounded-lg border border-border p-3">
              <legend className="px-1 text-xs font-semibold">Program type</legend>
              <div className="space-y-2">
                {(
                  [
                    ["LIHTC_SECTION42", "Section 42 LIHTC"],
                    ["BOND_SECTION142", "Section 142 tax-exempt bonds"],
                    ["OTHER_PROGRAM", "Other federal / state / local program"],
                  ] as const
                ).map(([value, title]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input className="size-4 accent-primary" type="radio" name="limit-program" value={value} checked={program === value} onChange={() => setProgram(value)} />
                    {title}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choose title="Limit year" value={limitYear} onChange={setLimitYear} options={Array.from({ length: 14 }, (_, index) => String(2026 - index)).map((year) => ({ value: year, label: year }))} />
              <Field title="State" value={stateCode} onChange={setStateCode} hint="Two-letter state or territory code" />
              <Field title="County / HUD area" value={areaId} onChange={setAreaId} />
              <Field title="Metropolitan statistical area / HUD area (if applicable)" value={msa} onChange={setMsa} />
              <Field title="Placed-in-service date" type="date" value={placedInServiceDate} onChange={setPlacedInServiceDate} />
              {program !== "OTHER_PROGRAM" ? (
                <Choose title="Minimum set-aside election" value={setAside} onChange={setSetAside} options={[{ value: "NOT_ELECTED", label: "Not recorded" }, { value: "20_50", label: "20% at 50%" }, { value: "40_60", label: "40% at 60%" }, { value: "AVERAGE_INCOME", label: "Average Income" }]} />
              ) : null}
            </div>
            {propertyState ? <Button type="button" size="sm" variant="outline" onClick={() => { setStateCode(propertyState.stateCode); setAreaId(propertyState.name); }}>Prefill from {propertyState.name}</Button> : null}
            <Check checked={ruralRule} onChange={setRuralRule}>Use rural / nonmetropolitan rule when the resolved source or rule profile supports it. It is never applied silently.</Check>
          </Card>

          <Card title="Displayed AMI percentages">
            <Toggles legend="Designation / target percentages" values={STANDARD_AMI_LEVELS} selected={amiLevels} onChange={setAmiLevels} render={(level) => `${level}%`} />
            <div className="flex items-end gap-2">
              <Field title="Custom percentage" value={customLevel} onChange={setCustomLevel} />
              <Button type="button" size="sm" variant="outline" onClick={() => { const value = Number(customLevel); if (!Number.isFinite(value) || value <= 0 || value > 200) { toast.error("Enter a custom percentage between 0 and 200."); return; } setCustomLevels([...new Set([...customLevels, value])]); setCustomLevel(""); }}>Add</Button>
            </div>
            {customLevels.length ? <p className="text-xs text-muted-foreground">Custom levels: {customLevels.map((level) => `${level}%`).join(", ")} <button type="button" className="underline" onClick={() => setCustomLevels([])}>Clear</button></p> : null}
          </Card>

          {program !== "LIHTC_SECTION42" ? (
            <Card title="Assumed HUD published limit basis" description="An unavailable basis is never mapped to another dataset.">
              <Choose title="Published limit basis" value={hudBasis} onChange={setHudBasis} options={[{ value: "", label: "Select basis" }, ...HUD_LIMIT_BASES.filter((basis) => basis !== "ELI_30" || program === "OTHER_PROGRAM").map((basis) => ({ value: basis, label: { AMI_MEDIAN: "AMI / median", MTSP: "MTSP", VLI_50: "Very low income (50%)", LOW_80: "Low income (80%)", ELI_30: "Extremely low income (30%)" }[basis]! }))]} />
            </Card>
          ) : null}

          <Card title="Household & bedroom assumptions">
            {program === "LIHTC_SECTION42" ? <p className="rounded-md border border-border bg-muted/40 p-3 text-xs leading-5">Section 42 LIHTC uses the 1.5-persons-per-bedroom rent convention (a 0-bedroom / SRO unit uses one person). This is not a user assumption and cannot be changed.</p> : <Choose title="Assumed household size method" value={sizeMethod} onChange={(value) => setSizeMethod(value as SizeMethod)} options={[{ value: "ONE_POINT_FIVE", label: "1.5 persons per bedroom" }, { value: "PLUS_ONE", label: "1 person per bedroom + 1" }, { value: "CUSTOM", label: "Custom by bedroom size" }]} />}
            {sizeMethod === "CUSTOM" ? <div className="grid gap-3 sm:grid-cols-2">{bedroomSizes.map((room) => <Field key={room} title={`${bedroomLabel(room)} assumed household size`} value={customSizes[String(room)] ?? ""} onChange={(value) => setCustomSizes({ ...customSizes, [String(room)]: value })} />)}</div> : null}
            <Toggles legend="Displayed household sizes" values={HOUSEHOLD_SIZES} selected={householdSizes} onChange={setHouseholdSizes} render={(size) => `${size} person`} />
            <Toggles legend="Displayed bedroom sizes" values={BEDROOM_SIZES} selected={bedroomSizes} onChange={setBedroomSizes} render={bedroomLabel} />
          </Card>

          <Card title="Utility allowances & rent floors" description="Entered amounts are property-specific inputs, not national authority, until backed by a CertivoIQ source record.">
            <div className="grid gap-3 sm:grid-cols-2">
              {bedroomSizes.map((room) => <Field key={`ua-${room}`} title={`${bedroomLabel(room)} monthly utility allowance ($)`} value={utilityAllowances[String(room)] ?? ""} onChange={(value) => setUtilityAllowances({ ...utilityAllowances, [String(room)]: value })} />)}
              {bedroomSizes.map((room) => <Field key={`floor-${room}`} title={`${bedroomLabel(room)} project gross rent floor ($)`} value={grossRentFloor[String(room)] ?? ""} onChange={(value) => { setGrossRentFloor({ ...grossRentFloor, [String(room)]: value }); setFloorEvidence((current) => ({ ...current, reviewConfirmed: false })); }} />)}
            </div>
            <fieldset className="rounded-lg border border-border p-3">
              <legend className="px-1 text-xs font-semibold">Project rent floor evidence</legend>
              <p className="mb-3 text-xs leading-5 text-muted-foreground">A project floor is property-specific evidence and is not regulatory authority by itself. It is shown as a separate Project floor column and is only applied after this review is recorded and the rent methodology is reviewed.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field title="Floor effective / election date" type="date" value={floorEvidence.effectiveDate} onChange={(value) => setFloorEvidence({ ...floorEvidence, effectiveDate: value, reviewConfirmed: false })} />
                <Field title="Floor source / election reference" value={floorEvidence.sourceReference} onChange={(value) => setFloorEvidence({ ...floorEvidence, sourceReference: value, reviewConfirmed: false })} />
                <Field title="Floor reviewer name" value={floorEvidence.reviewerName} onChange={(value) => setFloorEvidence({ ...floorEvidence, reviewerName: value, reviewConfirmed: false })} />
              </div>
              <div className="mt-3"><Check checked={floorEvidence.reviewConfirmed} onChange={(value) => setFloorEvidence({ ...floorEvidence, reviewConfirmed: value })}>I reviewed the cited floor election and confirm the program / rule context supports applying it to the calculated gross rent.</Check></div>
            </fieldset>
            <Check checked={showGrossRent} onChange={setShowGrossRent}>Show gross rent before utility allowance</Check>
            <Check checked={showTenantPaid} onChange={setShowTenantPaid}>Show maximum tenant-paid rent after utility allowance</Check>
          </Card>

          <Card title="Optional outputs">
            <Check checked={showFmr} onChange={setShowFmr}>Show HUD Fair Market Rents when a controlled FMR source exists</Check>
            <Check checked={showOneForty} onChange={setShowOneForty}>Show 140% income limits for Next Available Unit analysis</Check>
            <Check checked={showHistorical} onChange={setShowHistorical}>Show historical charts and 12-year average change when source records exist</Check>
            {showHistorical ? <div className="space-y-3"><Toggles legend="Historical income levels requested" values={STANDARD_AMI_LEVELS} selected={historicalIncomeLevels} onChange={setHistoricalIncomeLevels} render={(level) => `${level}% income`} /><Toggles legend="Historical rent levels requested" values={STANDARD_AMI_LEVELS} selected={historicalRentLevels} onChange={setHistoricalRentLevels} render={(level) => `${level}% rent`} /><p className="text-xs text-muted-foreground">Selections are recorded with the calculation. No chart points are drawn without a verified 12-year source series.</p></div> : null}
          </Card>

          <Card title="Applicable rent methodology" description="Income limits may be determined from a reviewed income-limit source, but maximum-rent outputs stay Not Determined until the applicable rent rule and methodology are reviewed.">
            <Field title="Applicable maximum-rent rule / methodology reference" value={rentMethod.methodReference} onChange={(value) => setRentMethod({ ...rentMethod, methodReference: value, reviewConfirmed: false })} />
            <Field title="Rent methodology source document reference / URL" value={rentMethod.sourceReference} onChange={(value) => setRentMethod({ ...rentMethod, sourceReference: value, reviewConfirmed: false })} />
            <Field title="Rent methodology reviewer name" value={rentMethod.reviewerName} onChange={(value) => setRentMethod({ ...rentMethod, reviewerName: value, reviewConfirmed: false })} />
            <Check checked={rentMethod.reviewConfirmed} onChange={(value) => setRentMethod({ ...rentMethod, reviewConfirmed: value })}>I reviewed the cited rent rule and methodology for this program, geography and effective period.</Check>
          </Card>

          <Card title="Limit source" description="Controlled datasets remain unavailable until activation is recorded. The manual path requires authority, source, dates and explicit review.">
            <fieldset className="rounded-lg border border-border p-3"><legend className="px-1 text-xs font-semibold">Source path</legend><div className="space-y-2"><label className="flex items-center gap-2 text-sm"><input className="size-4 accent-primary" type="radio" name="limit-source" checked={sourceMode === "CONTROLLED"} onChange={() => setSourceMode("CONTROLLED")} />Controlled HUD dataset</label><label className="flex items-center gap-2 text-sm"><input className="size-4 accent-primary" type="radio" name="limit-source" checked={sourceMode === "MANUAL"} onChange={() => setSourceMode("MANUAL")} />Manual sourced limit set (reviewed)</label></div></fieldset>
            {program === "OTHER_PROGRAM" ? <Choose title="Compatible source family" value={sourceFamily} onChange={(value) => setSourceFamily(value as SourceFamily | "")} options={[{ value: "", label: "Select source family" }, ...["HOME", "HTF", "SECTION8", "USDA_RD", "STATE_LOCAL_MANUAL"].map((family) => ({ value: family, label: FAMILY_LABELS[family]! }))]} /> : <p className="text-xs text-muted-foreground">Section 42 and Section 142 may use only HUD MTSP-family controlled datasets.</p>}
            {sourceMode === "CONTROLLED" ? <><Choose title="Controlled dataset" value={datasetId} onChange={setDatasetId} options={[{ value: "", label: datasetOptions.length ? "Select dataset" : "No compatible controlled dataset" }, ...datasetOptions.map((dataset) => ({ value: dataset.id, label: dataset.id }))]} /><p className="text-xs text-muted-foreground">Activation status: {CONTROLLED_DATASETS.find((dataset) => dataset.id === datasetId)?.status ?? "UNKNOWN"}</p></> : <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field title="Administering authority" value={manual.authority} onChange={(value) => setManual({ ...manual, authority: value, reviewConfirmed: false })} /><Field title="Source document reference / URL" value={manual.sourceReference} onChange={(value) => setManual({ ...manual, sourceReference: value, reviewConfirmed: false })} /><Field title="Limit effective from" type="date" value={manual.effectiveFrom} onChange={(value) => setManual({ ...manual, effectiveFrom: value, reviewConfirmed: false })} /><Field title="Limit effective to" type="date" value={manual.effectiveTo} onChange={(value) => setManual({ ...manual, effectiveTo: value, reviewConfirmed: false })} /><Field title="Limit geography" value={manual.geography} onChange={(value) => setManual({ ...manual, geography: value, reviewConfirmed: false })} /><Field title="Designation / published basis" value={manual.designation} onChange={(value) => setManual({ ...manual, designation: value, reviewConfirmed: false })} /><Field title="Published base percentage" value={String(manual.basePercent)} onChange={(value) => setManual({ ...manual, basePercent: value, reviewConfirmed: false })} /><Field title="Reviewer name" value={manual.reviewerName} onChange={(value) => setManual({ ...manual, reviewerName: value })} /></div><label className="block text-xs font-medium">Sourced household-size limits (one per line, size=amount)<textarea aria-label="Sourced household-size limits" className={`${inputClass} h-28 font-mono`} value={manualLimitsText} onChange={(e) => { setManualLimitsText(e.target.value); setManual((current) => ({ ...current, reviewConfirmed: false })); }} /></label><Check checked={manual.reviewConfirmed} onChange={(value) => setManual({ ...manual, reviewConfirmed: value })}>I reviewed this sourced limit set against the cited authority, geography, designation and effective dates.</Check>{manualIssues.length ? <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">{manualIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}</div>}
          </Card>

          <Button type="button" className="w-full" onClick={() => setCalculated(config)}>Calculate limits</Button>
        </div>

        <div className="space-y-5" aria-live="polite">
          {!result ? <Card title="No calculation yet"><p className="text-sm text-muted-foreground">Complete the configuration and select Calculate limits. Results, provenance and any missing source evidence appear here.</p></Card> : <>
            <Card title="Source & area summary"><dl className="grid gap-3 text-sm sm:grid-cols-2">{([ ["Program", String(result.area["program"] ?? "—")], ["Limit year", String(result.area["limitYear"] ?? "—")], ["State", String(result.area["stateCode"] || "—")], ["County / HUD area", String(result.area["areaId"] || "—")], ["MSA / HUD area", String(result.area["msa"] || "—")], ["Placed in service", String(result.area["placedInServiceDate"] || "—")], ["Minimum set-aside", String(result.area["setAside"] || "—")], ["Effective from", String(result.area["effectiveFrom"] || "Not determined")] ] as const).map(([term, value]) => <div key={term}><dt className="text-xs text-muted-foreground">{term}</dt><dd className="font-medium">{value}</dd></div>)}</dl></Card>
            {result.blockers.length ? <Card title="Missing source evidence / review required"><ul className="list-disc space-y-1 pl-5 text-sm">{result.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></Card> : null}
            {result.status !== "NOT_DETERMINED" ? <>
              <Card title="HUD published reference limits"><Table caption="Reference limits by household size" headers={["Level", ...householdSizes.map((size) => `${size} person`)]} rows={result.referenceLimits.map((row) => [row.label ?? `${row.level}%`, ...row.byHouseholdSize.map((entry) => currency(entry.amount))])} /></Card>
              <Card title="Calculated income limits"><Table caption="Income limits by AMI percentage and household size" headers={["AMI %", ...householdSizes.map((size) => `${size} person`)]} rows={result.incomeLimits.map((row) => [`${row.level}%`, ...row.byHouseholdSize.map((entry) => currency(entry.amount))])} /></Card>
              <Card title="Calculated maximum rents" description="Project floors are shown separately. Rent outputs require a reviewed rent methodology.">
                {!result.rentAuthority.determined ? <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"><p className="font-semibold">Maximum rents: Not determined</p><p>{result.rentAuthority.reason}</p><ul className="list-disc space-y-1 pl-5 text-xs">{result.rentAuthority.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : <>
                  {showGrossRent ? <Table caption="Calculated gross rent before utility allowance" headers={["AMI %", ...bedroomSizes.map(bedroomLabel)]} rows={result.rentLimits.map((row) => [`${row.level}%`, ...row.byBedroom.map((entry) => currency(entry.grossRent))])} /> : null}
                  {result.floorTreatment.entered ? <><Table caption="Project floor (property-specific evidence, not regulatory authority)" headers={["Bedroom", "Project floor", "Floor treatment"]} rows={(result.rentLimits[0]?.byBedroom ?? []).map((entry) => [bedroomLabel(entry.bedrooms), entry.projectFloor === null ? "Not entered" : currency(entry.projectFloor), result.floorTreatment.status === "REVIEWED_APPLICABLE" ? (entry.floorApplied ? "Applied — floor exceeds calculated rent" : "Reviewed — calculated rent is higher") : "Review required"])} />{result.floorTreatment.status !== "REVIEWED_APPLICABLE" ? <p className="text-sm">Floor treatment: Review required. The calculated gross rent above is unchanged.</p> : <Table caption="Applicable rent after reviewed floor treatment" headers={["AMI %", ...bedroomSizes.map(bedroomLabel)]} rows={result.rentLimits.map((row) => [`${row.level}%`, ...row.byBedroom.map((entry) => currency(entry.applicableRent))])} />}</> : null}
                  {showTenantPaid ? <Table caption="Maximum tenant-paid rent after utility allowance" headers={["AMI %", ...bedroomSizes.map(bedroomLabel)]} rows={result.rentLimits.map((row) => [`${row.level}%`, ...row.byBedroom.map((entry) => currency(entry.tenantPaid))])} /> : null}
                  <p className="text-xs text-muted-foreground">Assumed household sizes: {result.rentLimits[0]?.byBedroom.map((entry) => `${bedroomLabel(entry.bedrooms)} = ${entry.householdSize ?? "not determined"}`).join(" · ")}</p>
                </>}
              </Card>
              {showOneForty ? <Card title="140% income limits — Next Available Unit Rule">{result.oneForty.notDetermined ? <p className="text-sm">Not determined — {result.oneForty.reason}</p> : <Table caption={`140% of the applicable ${result.oneForty.basisLevel}% limit`} headers={["Basis", ...result.oneForty.byHouseholdSize.map((entry) => `${entry.size} person`)]} rows={[[`${result.oneForty.basisLevel}% × 140%`, ...result.oneForty.byHouseholdSize.map((entry) => currency(entry.amount))]]} />}</Card> : null}
              {showFmr ? <Card title="HUD Fair Market Rents">{result.fmr.available ? <Table caption="FMR by bedroom size" headers={["Bedroom", "FMR"]} rows={result.fmr.records.map((record) => [bedroomLabel(record.bedrooms), currency(record.amount)])} /> : <p className="text-sm">Not determined — {result.fmr.reason}</p>}</Card> : null}
              {showHistorical ? <Card title="Historical limits & average change"><p className="text-xs text-muted-foreground">Requested income levels: {result.historical.incomeLevels.map((level) => `${level}%`).join(", ") || "none"} · requested rent levels: {result.historical.rentLevels.map((level) => `${level}%`).join(", ") || "none"}</p>{result.historical.available ? <p className="text-sm">Historical source records available: {result.historical.years} years.</p> : <p className="text-sm">Not determined — {result.historical.reason}</p>}</Card> : null}
              <Card title="Use these limits in Household Income" description="This creates an unsigned property/unit limit-profile draft for the existing approval flow. Signed calculations are never changed and no rule is activated."><Choose title="AMI percentage to carry over" value={carryLevel || String(result.incomeLimits[0]?.level ?? "")} onChange={setCarryLevel} options={result.incomeLimits.map((row) => ({ value: String(row.level), label: `${row.level}%` }))} /><Button type="button" onClick={carry}>Use these limits in Household Income</Button></Card>
            </> : null}
            <Card title="Provenance"><dl className="grid gap-3 text-sm sm:grid-cols-2">{([ ["Source path", result.provenance.kind ?? "Not selected"], ["Authority", result.provenance.authority ?? "Not determined"], ["Dataset / version", [result.provenance.datasetId, result.provenance.version].filter(Boolean).join(" · ") || "Not determined"], ["Source reference", result.provenance.sourceReference ?? "Not determined"], ["Source hash", result.provenance.sha256 ?? "Not recorded"], ["Effective dates", [result.provenance.effectiveFrom, result.provenance.effectiveTo].filter(Boolean).join(" → ") || "Not determined"], ["Geography", result.provenance.geography ?? "Not determined"], ["Verification state", `${result.provenance.verification} · ${result.provenance.activationStatus}`], ["Source family", String(result.area["sourceFamily"] ?? (program === "OTHER_PROGRAM" ? sourceFamily || "Not selected" : "MTSP"))], ["Rent methodology", result.rentAuthority.determined ? `Reviewed · ${result.rentAuthority.methodReference}` : "Not determined — rent rule / methodology not reviewed"], ["Rent methodology source", result.rentAuthority.sourceReference || "Not recorded"], ["Project floor treatment", result.floorTreatment.entered ? `${result.floorTreatment.status} · ${result.floorTreatment.effectiveDate ?? "no date"}` : "No project floor entered"], ["Engine version", result.engineVersion] ] as const).map(([term, value]) => <div key={term}><dt className="text-xs text-muted-foreground">{term}</dt><dd className="break-words font-medium">{value}</dd></div>)}</dl></Card>
          </>}
        </div>
      </div>
    </AppShell>
  );
}