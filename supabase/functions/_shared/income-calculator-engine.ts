/** Deterministic arithmetic and routing, not a nationwide eligibility/rent engine.
 * Canonical shared source: browser previews and authenticated server saves use this file.
 * Decimal inputs remain rational until the approved profile's final rounding step.
 */
export const ENGINE_VERSION = "income-calculator/1.0.0";
export const PROGRAMS = ["LIHTC", "HUD_MF", "HCV", "PBV", "PUBLIC_HOUSING", "HOME", "HTF", "RD", "BOND", "STATE_LOCAL"] as const;
export const FREQUENCIES = { WEEKLY: 52, BIWEEKLY: 26, SEMIMONTHLY: 24, MONTHLY: 12, ANNUAL: 1 } as const;
export type Frequency = keyof typeof FREQUENCIES;
export type CertType = "INITIAL" | "ANNUAL" | "INTERIM" | "OTHER";
export type Route = "PROJECTED" | "HISTORICAL" | "RD_ADJUSTED" | "IRS_AGI" | "ACCEPTED" | "MANUAL" | "NOT_DETERMINED";
export type MoneyLine = { id: string; member: string; label: string; amount: string; frequency: Frequency; source: string; reviewed: boolean };
export type PayStub = { id: string; start: string; end: string; gross: string; rate: string; hours: string; overtimeRate: string; overtimeHours: string; extras: string; source: string; reviewed: boolean; completePeriod: boolean; discrepancyReason: string };
export type Job = { id: string; member: string; employer: string; mode: "HOURLY" | "PAY_PERIOD" | "STUB_AVERAGE"; rate: string; hours: string; overtimeRate: string; overtimeHours: string; gross: string; frequency: Frequency; weeks: string; adjustment: string; changeSource: string; source: string; reviewed: boolean; stubs: PayStub[] };
export type HistoryRow = { start: string; end: string; amount: string; source: string; reviewed: boolean };
export type Layer = { program: string; adjustments: MoneyLine[]; deductions: MoneyLine[]; agi: MoneyLine[]; finalAmount: string; determinationDate: string; validThrough: string; authority: string; determinationSource: string; determinationReviewed: boolean; evidenceMonths: string; evidenceSource: string; evidenceReviewed: boolean; treatmentReviewed: boolean; assetsReviewed: boolean; reconciliationReviewed: boolean };
export type Input = { tenantId: string; propertyId: string; unitId: string; effectiveDate: string; certificationType: CertType; householdSize: string; subsidy: "NONE" | "PUBLIC_HOUSING" | "FEDERAL_TENANT_BASED" | "FEDERAL_STATE_PROJECT_BASED" | "UNKNOWN"; householdReviewed: boolean; changesReviewed: boolean; jobs: Job[]; otherIncome: MoneyLine[]; assets: MoneyLine[]; history: HistoryRow[]; historyAdjustments: MoneyLine[]; layers: Layer[] };
export type Profile = { program: string; agency: string; definition: "PART5" | "IRS_AGI" | "RD_ADJUSTED" | "MANUAL"; implementation: "LEGACY" | "HOTMA" | "SPECIAL" | "UNRESOLVED"; method: "AUTO" | "ACCEPTED" | "STREAMLINED" | "MANUAL"; effectiveFrom: string; effectiveTo: string; policyVersion: string; policySource: string; evidencePolicy: string; minEvidenceMonths: string; rounding: "CENTS" | "WHOLE_NEAREST" | "WHOLE_UP" | "WHOLE_DOWN"; designation: string; geography: string; limitSource: string; limitFrom: string; limitTo: string; limits: Record<string, string> };
export type ApprovedProfile = { id: string; profile: Profile; createdAt: string };
export type LayerResult = { program: string; route: Route; profileId: string | null; policyVersion: string | null; annualIncome: string | null; incomeLimit: string | null; difference: string | null; comparison: "ABOVE_LIMIT" | "AT_OR_BELOW_LIMIT" | "NOT_DETERMINED"; issues: string[]; basis: string };
export type Evaluation = { engineVersion: string; status: "Pending Final Review"; prospectiveAnnual: string | null; historicalAnnual: string | null; jobResults: { id: string; annual: string | null; issues: string[] }[]; results: LayerResult[]; reviewable: boolean };

type Q = { n: bigint; d: bigint };
const ZERO: Q = { n: 0n, d: 1n };
function gcd(a: bigint, b: bigint): bigint { a = a < 0n ? -a : a; while (b) { const c = a % b; a = b; b = c; } return a || 1n; }
function q(n: bigint, d = 1n): Q { if (!d) throw new Error("Division by zero"); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
const add = (a: Q, b: Q): Q => q(a.n * b.d + b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q): Q => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q): Q => q(a.n * b.d, a.d * b.n);
const neg = (a: Q): Q => ({ n: -a.n, d: a.d });
function decimal(s: string, signed = false): Q {
  if (typeof s !== "string" || !(signed ? /^-?\d{1,10}(\.\d{1,6})?$/ : /^\d{1,10}(\.\d{1,6})?$/).test(s)) throw new Error("Enter a valid decimal (up to six decimal places; no commas).");
  const [whole = "", fraction = ""] = s.split("."); const d = 10n ** BigInt(fraction.length);
  return q(BigInt(whole.replace("-", "")) * d * (s.startsWith("-") ? -1n : 1n) + BigInt(fraction || "0") * (s.startsWith("-") ? -1n : 1n), d);
}
function read(s: string, label: string, issues: string[], signed = false): Q { try { return decimal(s, signed); } catch { issues.push(`${label}: valid amount required.`); return ZERO; } }
function rounded(a: Q, mode: Profile["rounding"] = "CENTS"): bigint {
  const scale = mode === "CENTS" ? 100n : 1n; const n = (a.n < 0n ? -a.n : a.n) * scale;
  let units = n / a.d;
  if (mode === "WHOLE_UP") { if (n % a.d) units++; }
  else if (mode !== "WHOLE_DOWN" && (n % a.d) * 2n >= a.d) units++;
  return units * (a.n < 0n ? -1n : 1n) * (mode === "CENTS" ? 1n : 100n);
}
function currency(cents: bigint): string { const a = cents < 0n ? -cents : cents; return `${cents < 0n ? "-" : ""}${a / 100n}.${String(a % 100n).padStart(2, "0")}`; }
const money = (a: Q, mode?: Profile["rounding"]) => currency(rounded(a, mode));
const nonblank = (s: unknown): s is string => typeof s === "string" && !!s.trim();
export function validDate(s: string): boolean { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(`${s}T00:00:00Z`); return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === s; }
function moveMonths(s: string, months: number): string { const d = new Date(`${s}T00:00:00Z`); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); return d.toISOString().slice(0, 10); }
function previousDay(s: string): string { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
export function historyPeriods(effective: string): HistoryRow[] { if (!validDate(effective)) return []; return Array.from({ length: 12 }, (_, i) => ({ start: moveMonths(effective, i - 12), end: previousDay(moveMonths(effective, i - 11)), amount: "", source: "", reviewed: false })); }
export function normalizeProgram(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = { SECTION_42: "LIHTC", TAX_CREDIT: "LIHTC", HUD_MULTIFAMILY: "HUD_MF", HUD: "HUD_UNSPECIFIED", SECTION_8: "HUD_UNSPECIFIED", SECTION8: "HUD_UNSPECIFIED", HUD_SECTION_8: "HUD_UNSPECIFIED", SECTION_8_PBRA: "HUD_MF", PBRA: "HUD_MF", HOUSING_CHOICE_VOUCHER: "HCV", SECTION_8_HCV: "HCV", SECTION_8_PBV: "PBV", PH: "PUBLIC_HOUSING", USDA: "RD", USDA_RD: "RD", RURAL_DEVELOPMENT: "RD", SECTION_515: "RD", SECTION_514: "RD", TAX_EXEMPT_BOND: "BOND", BONDS: "BOND", NHTF: "HTF", STATE: "STATE_LOCAL", LOCAL: "STATE_LOCAL" };
  return aliases[s] || s;
}
export function newLine(id: string): MoneyLine { return { id, member: "", label: "", amount: "", frequency: "ANNUAL", source: "", reviewed: false }; }
export function newJob(id: string): Job { return { id, member: "", employer: "", mode: "HOURLY", rate: "", hours: "", overtimeRate: "0", overtimeHours: "0", gross: "", frequency: "WEEKLY", weeks: "52", adjustment: "0", changeSource: "", source: "", reviewed: false, stubs: [] }; }
export function newStub(id: string): PayStub { return { id, start: "", end: "", gross: "", rate: "", hours: "", overtimeRate: "", overtimeHours: "", extras: "", source: "", reviewed: false, completePeriod: false, discrepancyReason: "" }; }
export function newLayer(program: string): Layer { return { program: normalizeProgram(program), adjustments: [], deductions: [], agi: [], finalAmount: "", determinationDate: "", validThrough: "", authority: "", determinationSource: "", determinationReviewed: false, evidenceMonths: "", evidenceSource: "", evidenceReviewed: false, treatmentReviewed: false, assetsReviewed: false, reconciliationReviewed: false }; }
export function newInput(): Input { return { tenantId: "", propertyId: "", unitId: "", effectiveDate: "", certificationType: "INITIAL", householdSize: "", subsidy: "UNKNOWN", householdReviewed: false, changesReviewed: false, jobs: [], otherIncome: [], assets: [], history: [], historyAdjustments: [], layers: [] }; }
export function newProfile(program: string): Profile { const p = normalizeProgram(program); return { program: p, agency: "", definition: p === "RD" ? "RD_ADJUSTED" : PROGRAMS.includes(p as typeof PROGRAMS[number]) && !["BOND", "STATE_LOCAL"].includes(p) ? "PART5" : "MANUAL", implementation: "UNRESOLVED", method: ["BOND", "STATE_LOCAL"].includes(p) || !PROGRAMS.includes(p as typeof PROGRAMS[number]) ? "MANUAL" : "AUTO", effectiveFrom: "", effectiveTo: "", policyVersion: "", policySource: "", evidencePolicy: "", minEvidenceMonths: ["HOME", "HTF"].includes(p) ? "2" : "", rounding: "CENTS", designation: "", geography: "", limitSource: "", limitFrom: "", limitTo: "", limits: {} }; }

// Structural checks fail closed before traversing untrusted JSON. No coercion of blanks to zero.
function object(v: unknown): asserts v is Record<string, unknown> { if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Invalid calculator object."); }
function strings(v: Record<string, unknown>, keys: string[]) { for (const k of keys) if (typeof v[k] !== "string" || (v[k] as string).length > 2000) throw new Error(`Invalid ${k}.`); }
function booleans(v: Record<string, unknown>, keys: string[]) { for (const k of keys) if (typeof v[k] !== "boolean") throw new Error(`Invalid ${k}.`); }
function enumeration(value: unknown, allowed: readonly string[], name: string) { if (typeof value !== "string" || !allowed.includes(value)) throw new Error(`Invalid ${name}.`); }
function array(v: unknown, max = 240): asserts v is unknown[] { if (!Array.isArray(v) || v.length > max) throw new Error("Invalid or oversized input collection."); }
function lineShape(v: unknown) { object(v); strings(v, ["id", "member", "label", "amount", "source"]); booleans(v, ["reviewed"]); enumeration(v["frequency"], Object.keys(FREQUENCIES), "frequency"); }
export function assertInput(v: unknown): asserts v is Input {
  object(v); strings(v, ["tenantId", "propertyId", "unitId", "effectiveDate", "householdSize"]); booleans(v, ["householdReviewed", "changesReviewed"]);
  enumeration(v["certificationType"], ["INITIAL", "ANNUAL", "INTERIM", "OTHER"], "certification type"); enumeration(v["subsidy"], ["NONE", "PUBLIC_HOUSING", "FEDERAL_TENANT_BASED", "FEDERAL_STATE_PROJECT_BASED", "UNKNOWN"], "subsidy");
  array(v["jobs"], 60); for (const j of v["jobs"]) { object(j); strings(j, ["id", "member", "employer", "rate", "hours", "overtimeRate", "overtimeHours", "gross", "weeks", "adjustment", "changeSource", "source"]); booleans(j, ["reviewed"]); enumeration(j["mode"], ["HOURLY", "PAY_PERIOD", "STUB_AVERAGE"], "wage basis"); enumeration(j["frequency"], Object.keys(FREQUENCIES), "frequency"); array(j["stubs"]); for (const s of j["stubs"]) { object(s); strings(s, ["id", "start", "end", "gross", "rate", "hours", "overtimeRate", "overtimeHours", "extras", "source", "discrepancyReason"]); booleans(s, ["reviewed", "completePeriod"]); } }
  for (const k of ["otherIncome", "assets", "historyAdjustments"]) { array(v[k]); for (const l of v[k]) lineShape(l); }
  array(v["history"], 12); for (const h of v["history"]) { object(h); strings(h, ["start", "end", "amount", "source"]); booleans(h, ["reviewed"]); }
  array(v["layers"], 20); for (const l of v["layers"]) { object(l); strings(l, ["program", "finalAmount", "determinationDate", "validThrough", "authority", "determinationSource", "evidenceMonths", "evidenceSource"]); booleans(l, ["determinationReviewed", "evidenceReviewed", "treatmentReviewed", "assetsReviewed", "reconciliationReviewed"]); for (const k of ["adjustments", "deductions", "agi"]) { array(l[k]); for (const x of l[k]) lineShape(x); } }
}
export function assertProfile(v: unknown): asserts v is Profile {
  object(v); strings(v, ["program", "agency", "effectiveFrom", "effectiveTo", "policyVersion", "policySource", "evidencePolicy", "minEvidenceMonths", "designation", "geography", "limitSource", "limitFrom", "limitTo"]);
  enumeration(v["definition"], ["PART5", "IRS_AGI", "RD_ADJUSTED", "MANUAL"], "definition"); enumeration(v["implementation"], ["LEGACY", "HOTMA", "SPECIAL", "UNRESOLVED"], "implementation"); enumeration(v["method"], ["AUTO", "ACCEPTED", "STREAMLINED", "MANUAL"], "method"); enumeration(v["rounding"], ["CENTS", "WHOLE_NEAREST", "WHOLE_UP", "WHOLE_DOWN"], "rounding"); object(v["limits"]); if (Object.keys(v["limits"]).length > 30) throw new Error("Too many income-limit sizes."); for (const [k, amount] of Object.entries(v["limits"])) { if (!/^[1-9]\d?$/.test(k) || Number(k) > 30 || typeof amount !== "string") throw new Error("Invalid household-size limit."); decimal(amount); }
}
export function profileIssues(p: Profile): string[] {
  assertProfile(p); const issues: string[] = [];
  for (const [key, label] of [["program", "Program"], ["agency", "Administering agency"], ["policyVersion", "Policy version"], ["policySource", "Policy source"], ["evidencePolicy", "Evidence policy"], ["designation", "Unit designation"], ["geography", "Limit geography"], ["limitSource", "Income-limit source"]] as const) if (!nonblank(p[key])) issues.push(`${label} required.`);
  if (!validDate(p.effectiveFrom) || !validDate(p.effectiveTo) || p.effectiveFrom > p.effectiveTo) issues.push("Valid policy effective dates required.");
  if (!validDate(p.limitFrom) || !validDate(p.limitTo) || p.limitFrom > p.limitTo) issues.push("Valid income-limit effective dates required.");
  if (!/^\d{1,2}$/.test(p.minEvidenceMonths) || Number(p.minEvidenceMonths) > 24) issues.push("Evidence-month requirement must be explicitly configured (0–24).");
  if (p.implementation === "UNRESOLVED") issues.push("Income-method implementation status is unresolved.");
  if (!Object.keys(p.limits).length) issues.push("At least one sourced household-size income limit is required.");
  if (p.method === "AUTO" && p.definition === "IRS_AGI" && !["HOME", "HTF"].includes(p.program)) issues.push("IRS AGI automatic routing is restricted to an approved HOME/HTF definition.");
  if (p.method === "AUTO" && p.program === "RD" && p.definition !== "RD_ADJUSTED") issues.push("RD automatic routing requires adjusted-income definition.");
  if (p.method === "AUTO" && p.program !== "RD" && p.definition === "RD_ADJUSTED") issues.push("RD deductions cannot be assigned to another program.");
  if (p.method === "AUTO" && ["LIHTC", "HUD_MF", "HCV", "PBV", "PUBLIC_HOUSING"].includes(p.program) && p.definition !== "PART5") issues.push("This automatic route requires the approved Part 5 income definition.");
  return issues;
}
export function selectRoute(p: Profile, input: Pick<Input, "certificationType" | "subsidy">): Route {
  if (p.implementation === "UNRESOLVED") return "NOT_DETERMINED";
  if (p.program === "HTF" && input.subsidy === "UNKNOWN") return "NOT_DETERMINED";
  if (p.program === "HTF" && input.subsidy !== "NONE") return "ACCEPTED";
  if (p.method === "ACCEPTED") return "ACCEPTED";
  if (p.method === "MANUAL" || p.method === "STREAMLINED" || p.implementation === "SPECIAL" || input.certificationType === "OTHER") return "MANUAL";
  if (["BOND", "STATE_LOCAL"].includes(p.program) || !PROGRAMS.includes(p.program as typeof PROGRAMS[number])) return "MANUAL";
  if (p.program === "RD") return "RD_ADJUSTED";
  if (["HOME", "HTF"].includes(p.program)) return p.definition === "IRS_AGI" ? "IRS_AGI" : "PROJECTED";
  if (["HUD_MF", "HCV", "PBV", "PUBLIC_HOUSING"].includes(p.program) && p.implementation === "HOTMA" && input.certificationType === "ANNUAL") return "HISTORICAL";
  return "PROJECTED";
}
function evidence(reviewed: boolean, source: string, label: string, issues: string[]) { if (!reviewed || !nonblank(source)) issues.push(`${label}: source reference and reviewed evidence required.`); }
function sumLines(lines: MoneyLine[], label: string, issues: string[], signed = false, annualOnly = false): Q {
  let total = ZERO; const ids = new Set<string>();
  for (const l of lines) { if (!nonblank(l.id) || ids.has(l.id)) issues.push(`${label}: duplicate/missing source row ID.`); ids.add(l.id); if (!nonblank(l.label)) issues.push(`${label}: income/adjustment description required.`); evidence(l.reviewed, l.source, `${label} ${l.label}`, issues); if (annualOnly && l.frequency !== "ANNUAL") issues.push(`${label}: use annual amounts only.`); total = add(total, mul(read(l.amount, `${label} ${l.label}`, issues, signed), q(BigInt(FREQUENCIES[l.frequency])))); }
  return total;
}
function jobValue(j: Job, effectiveDate: string): { value: Q; issues: string[] } {
  const issues: string[] = []; if (!nonblank(j.member) || !nonblank(j.employer)) issues.push("Household member and employer required.");
  evidence(j.reviewed, j.source, j.employer || "Job", issues);
  const weeks = read(j.weeks, "Expected paid weeks", issues); if (weeks.n < 0n || weeks.n > 52n * weeks.d) issues.push("Expected paid weeks must be between 0 and 52; document partial-year schedules.");
  let sampleTotal = ZERO; const periods: { start: string; end: string }[] = []; const stubIds = new Set<string>();
  for (const s of j.stubs) {
    if (!s.id || stubIds.has(s.id)) issues.push("Duplicate/missing pay-statement ID."); stubIds.add(s.id);
    if (!validDate(s.start) || !validDate(s.end) || s.start > s.end || (validDate(effectiveDate) && s.end >= effectiveDate)) issues.push("Pay-statement dates must be valid, ordered, and before the certification effective date.");
    if (periods.some((p) => s.start <= p.end && s.end >= p.start)) issues.push("Duplicate or overlapping pay periods; the same wages cannot be counted twice."); periods.push({ start: s.start, end: s.end });
    const gross = read(s.gross, "Pay-statement gross", issues); sampleTotal = add(sampleTotal, gross); evidence(s.reviewed, s.source, "Pay statement", issues);
    if (j.mode === "STUB_AVERAGE" && !s.completePeriod) issues.push("Only complete, comparable pay periods can support the pay-statement average.");
    const hasHours = [s.rate, s.hours, s.overtimeRate, s.overtimeHours, s.extras].some(nonblank);
    if (hasHours) {
      const calculated = add(add(mul(read(s.rate, "Statement regular rate", issues), read(s.hours, "Statement regular hours", issues)), mul(read(s.overtimeRate, "Statement overtime rate", issues), read(s.overtimeHours, "Statement overtime hours", issues))), read(s.extras, "Statement other gross earnings", issues));
      const delta = rounded(add(gross, neg(calculated))); if ((delta < -1n || delta > 1n) && !nonblank(s.discrepancyReason)) issues.push("Pay-statement gross does not reconcile to rate × hours plus other earnings; explain and review the discrepancy.");
    }
  }
  let value = ZERO;
  if (j.mode === "HOURLY") {
    const rate = read(j.rate, "Current regular hourly rate", issues), hours = read(j.hours, "Regular hours per week", issues), otRate = read(j.overtimeRate, "Overtime hourly rate", issues), otHours = read(j.overtimeHours, "Overtime hours per week", issues);
    const totalHours = add(hours, otHours); if (totalHours.n > 168n * totalHours.d) issues.push("Combined weekly hours cannot exceed 168.");
    if (otHours.n > 0n && otRate.n === 0n) issues.push("A documented overtime rate is required when overtime hours are entered.");
    value = mul(add(mul(rate, hours), mul(otRate, otHours)), weeks);
  } else if (j.mode === "PAY_PERIOD") value = mul(mul(read(j.gross, "Current gross per pay period", issues), q(BigInt(FREQUENCIES[j.frequency]))), div(weeks, q(52n)));
  else { if (!j.stubs.length) issues.push("Pay-statement averaging requires at least one reviewed complete pay period."); else value = mul(mul(div(sampleTotal, q(BigInt(j.stubs.length))), q(BigInt(FREQUENCIES[j.frequency]))), div(weeks, q(52n))); }
  const change = read(j.adjustment, "Documented net annual expected-change adjustment", issues, true); if (change.n !== 0n && !nonblank(j.changeSource)) issues.push("Expected-change adjustment requires its calculation and source reference.");
  value = add(value, change); if (value.n < 0n) issues.push("Job annual income cannot be negative."); return { value, issues };
}
export function evaluate(input: Input, approved: ApprovedProfile[], options: { requireSavedHousehold?: boolean } = {}): Evaluation {
  assertInput(input); const common: string[] = [];
  if (options.requireSavedHousehold !== false && (!input.tenantId || !input.propertyId || !input.unitId)) common.push("Select a saved property, unit, and household.");
  if (!validDate(input.effectiveDate)) common.push("Valid certification effective date required.");
  if (!/^([1-9]|[12]\d|30)$/.test(input.householdSize)) common.push("Verified household size (1–30) required.");
  if (!input.householdReviewed) common.push("Household composition and income sources must be reviewed.");
  if (!input.layers.length) common.push("At least one applicable program is required.");
  const jobIds = new Set<string>(), sharedIssues: string[] = [];
  let projected = ZERO;
  const jobResults = input.jobs.map((j) => { const r = jobValue(j, input.effectiveDate); if (!j.id || jobIds.has(j.id)) r.issues.push("Duplicate/missing job ID."); jobIds.add(j.id); projected = add(projected, r.value); sharedIssues.push(...r.issues.map((x) => `${j.employer || "Job"}: ${x}`)); return { id: j.id, annual: r.issues.length ? null : money(r.value), issues: r.issues }; });
  projected = add(projected, sumLines(input.otherIncome, "Other income", sharedIssues));
  const assetIssues: string[] = []; const assetValue = sumLines(input.assets, "Anticipated asset income", assetIssues, false, true); projected = add(projected, assetValue);
  const historyIssues: string[] = []; let historical = ZERO; const expected = historyPeriods(input.effectiveDate);
  if (input.history.length !== 12 || expected.length !== 12) historyIssues.push("The full previous 12-month period is required; three months cannot substitute for this route.");
  input.history.forEach((h, i) => { if (h.start !== expected[i]?.start || h.end !== expected[i]?.end) historyIssues.push("Historical rows must cover the exact prior 12 months without gaps or overlap."); historical = add(historical, read(h.amount, `Historical period ${i + 1}`, historyIssues)); evidence(h.reviewed, h.source, `Historical period ${i + 1}`, historyIssues); });
  historical = add(add(historical, sumLines(input.historyAdjustments, "Historical reconciliation", historyIssues, true, true)), assetValue);
  if (historical.n < 0n) historyIssues.push("Reconciled annual income cannot be negative.");
  const programs = new Set<string>();
  const results = input.layers.map((layer): LayerResult => {
    const issues = [...common]; const versions = approved.filter((a) => a.profile.program === layer.program); const active = versions.length === 1 ? versions[0] : null; const p = active?.profile;
    if (programs.has(layer.program)) issues.push("Duplicate program layer. Resolve the property configuration."); programs.add(layer.program);
    if (!p) issues.push(versions.length > 1 ? "Ambiguous rule versions; resolve the property configuration." : "No approved property/unit rule profile is effective for this program.");
    if (p) { issues.push(...profileIssues(p)); if (input.effectiveDate < p.effectiveFrom || input.effectiveDate > p.effectiveTo) issues.push("Policy version is not effective on the certification date."); if (input.effectiveDate < p.limitFrom || input.effectiveDate > p.limitTo) issues.push("Income-limit source is not effective on the certification date."); }
    const route = p ? selectRoute(p, input) : "NOT_DETERMINED";
    if (!layer.treatmentReviewed) issues.push("Program-specific inclusions, exclusions, and deductions require review.");
    if (!layer.assetsReviewed) issues.push("Program-specific asset treatment (including no assets when applicable) requires review.");
    evidence(layer.evidenceReviewed, layer.evidenceSource, "Program evidence package", issues);
    if (!/^\d{1,2}$/.test(layer.evidenceMonths) || Number(layer.evidenceMonths) > 24) issues.push("Enter verified source-document coverage in months (0–24).");
    const direct = ["PROJECTED", "HISTORICAL", "RD_ADJUSTED", "IRS_AGI"].includes(route);
    if (direct && p && Number(layer.evidenceMonths || -1) < Number(p.minEvidenceMonths)) issues.push(`The approved evidence policy requires at least ${p.minEvidenceMonths} months of source documents or a separately approved alternative route.`);
    let total = ZERO; let basis = ""; let amountKnown = true;
    if (route === "PROJECTED" || route === "RD_ADJUSTED") { total = projected; issues.push(...sharedIssues, ...assetIssues); if (!input.changesReviewed) issues.push("Expected changes and the projection basis require review."); basis = "Current supported income projected over the upcoming 12 months; hourly detail and statement gross are alternative bases, not additive sources."; amountKnown = !sharedIssues.length && !assetIssues.length; }
    else if (route === "HISTORICAL") { total = historical; issues.push(...historyIssues, ...assetIssues); if (!layer.reconciliationReviewed) issues.push("Interim reexaminations and unreflected changes must be reconciled."); basis = "Prior 12 months of non-asset income + documented reconciliation + anticipated asset income."; amountKnown = !historyIssues.length && !assetIssues.length; }
    else if (route === "IRS_AGI") { if (!layer.agi.length) issues.push("Document the IRS AGI components; do not substitute HUD wages or a tax-return total without the approved prevailing-income method."); const before = issues.length; total = sumLines(layer.agi, "IRS AGI component", issues, true, true); amountKnown = layer.agi.length > 0 && issues.length === before; if (!input.changesReviewed) issues.push("Prevailing income and expected changes require review."); basis = "Approved IRS AGI definition, calculated from separately documented annual components."; }
    else if (route === "ACCEPTED" || route === "MANUAL") {
      const before = issues.length; total = read(layer.finalAmount, "Documented final annual amount", issues); evidence(layer.determinationReviewed, layer.determinationSource, "Accepted/special determination", issues);
      if (!nonblank(layer.authority)) issues.push("Determining provider and acceptance/special-method authority required.");
      if (!validDate(layer.determinationDate) || !validDate(layer.validThrough) || layer.determinationDate > input.effectiveDate || layer.validThrough < input.effectiveDate || layer.validThrough < layer.determinationDate) issues.push("A valid, current provider/special determination is required.");
      if (layer.adjustments.length || layer.deductions.length || layer.agi.length) issues.push("An accepted/manual final amount cannot be silently modified with direct-calculation adjustments.");
      amountKnown = issues.length === before; basis = route === "ACCEPTED" ? "Documented applicable provider determination; not an independent recalculation." : "Documented approved special/manual/streamlined method; no nationwide formula assumed.";
    } else { amountKnown = false; issues.push("Calculation route is unresolved; verify implementation and attached assistance."); }
    if (direct) { const before = issues.length; total = add(total, sumLines(layer.adjustments, `${layer.program} annual inclusion/exclusion`, issues, true, true)); if (route === "RD_ADJUSTED") total = add(total, neg(sumLines(layer.deductions, "Verified RD deduction", issues, false, true))); else if (layer.deductions.length) issues.push("RD deductions cannot reduce another program's countable income."); if (route !== "IRS_AGI" && layer.agi.length) issues.push("Unused AGI components must be removed or assigned to an approved AGI route."); if (issues.length !== before) amountKnown = false; }
    if (route === "RD_ADJUSTED" && total.n < 0n) total = ZERO;
    else if (total.n < 0n) { issues.push("Countable annual income cannot be negative; resolve the adjustments."); amountKnown = false; }
    const limitText = p?.limits[input.householdSize]; const limitIssues: string[] = []; const limit = read(limitText || "", "Sourced household-size income limit", limitIssues); if (limit.n <= 0n) limitIssues.push("A positive, sourced household-size income limit is required."); issues.push(...limitIssues);
    const incomeCents = amountKnown ? rounded(total, p?.rounding) : null; const limitCents = !limitIssues.length ? rounded(limit) : null;
    const unique = [...new Set(issues)]; const comparison = unique.length || incomeCents === null || limitCents === null ? "NOT_DETERMINED" : incomeCents > limitCents ? "ABOVE_LIMIT" : "AT_OR_BELOW_LIMIT";
    return { program: layer.program, route, profileId: active?.id || null, policyVersion: p?.policyVersion || null, annualIncome: incomeCents === null ? null : currency(incomeCents), incomeLimit: limitCents === null ? null : currency(limitCents), difference: comparison === "NOT_DETERMINED" ? null : currency(incomeCents! - limitCents!), comparison, issues: unique, basis };
  });
  return { engineVersion: ENGINE_VERSION, status: "Pending Final Review", prospectiveAnnual: sharedIssues.length || assetIssues.length ? null : money(projected), historicalAnnual: historyIssues.length || assetIssues.length ? null : money(historical), jobResults, results, reviewable: results.length > 0 && results.every((r) => r.comparison !== "NOT_DETERMINED") };
}

/** Parse only explicitly sourced limits; blanks and duplicate sizes fail closed. */
export function parseSourcedLimits(text: string): Record<string, string> {
  const limits: Record<string, string> = {};
  for (const row of text.split("\n").filter((r) => r.trim())) {
    const match = /^\s*([1-9]\d?)\s*=\s*(\d+(?:\.\d{1,6})?)\s*$/.exec(row);
    const size = match?.[1], amount = match?.[2];
    if (!size || !amount || Number(size) > 30 || Object.hasOwn(limits, size)) throw new Error("Each limit row requires a unique household size (1–30) and exact amount, without commas.");
    decimal(amount);
    limits[size] = amount;
  }
  if (!Object.keys(limits).length) throw new Error("At least one sourced household-size income limit is required.");
  return limits;
}

