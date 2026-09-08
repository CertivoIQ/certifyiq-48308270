/** CSV onboarding is field-mapped, not tied to a vendor's column spelling. */
export const ONBOARDING_FIELDS = {
  property_external_id: { label: "Property reference ID", aliases: ["property id", "property code", "external property id", "property number", "community id", "community code", "site id", "site code", "project id"] },
  property_name: { label: "Property name", aliases: ["community name", "site name", "development name", "project name"] },
  state: { label: "Property state", aliases: ["state code", "property state", "property state code"] },
  property_address: { label: "Property address", aliases: ["property address line 1", "address line 1", "street address"] },
  city: { label: "Property city", aliases: ["property city", "city name"] },
  postal_code: { label: "Postal code", aliases: ["zip", "zip code", "zipcode", "property zip", "property postal code"] },
  unit_external_id: { label: "Unit reference ID", aliases: ["unit id", "unit code", "external unit id", "apartment id", "apartment code"] },
  unit_number: { label: "Unit number", aliases: ["unit no", "apartment number", "apartment no", "apt number", "apt no", "unit"] },
  bedrooms: { label: "Bedroom count", aliases: ["bedroom count", "number of bedrooms", "beds", "bedrooms count"] },
  tenant_external_id: { label: "Tenant / household reference ID", aliases: ["tenant id", "tenant code", "tenant profile id", "resident id", "resident code", "resident profile id", "household id", "external tenant id"] },
  household_name: { label: "Household / primary tenant name", aliases: ["tenant name", "resident name", "head of household name", "primary tenant name", "full name"] },
  tenant_first_name: { label: "Primary tenant first name", aliases: ["first name", "firstname", "resident first name", "head of household first name"] },
  tenant_middle_name: { label: "Primary tenant middle name / initial", aliases: ["middle name", "middle initial", "tenant middle initial", "resident middle name", "resident middle initial"] },
  tenant_last_name: { label: "Primary tenant last name", aliases: ["last name", "lastname", "surname", "resident last name", "head of household last name"] },
  move_in_date: { label: "Move-in date", aliases: ["move in", "movein date", "movein", "occupancy start date"] },
  building: { label: "Building (source detail)", aliases: ["building name", "building number", "building no", "building code"] },
  occupancy_status: { label: "Occupancy status (source detail)", aliases: ["unit status", "occupancy", "resident status"] },
  certification_type: { label: "Certification type (optional)", aliases: ["cert type", "certification category"] },
  certification_effective_date: { label: "Certification effective date (optional)", aliases: ["cert effective date", "certification date"] },
  program_codes: { label: "Program codes (optional)", aliases: ["programs", "program code", "housing programs", "program name", "housing program"] },
} as const;
export type OnboardingField = keyof typeof ONBOARDING_FIELDS;
export type OnboardingMapping = Partial<Record<OnboardingField, number | null>>;
export type CsvTable = { headers: string[]; records: string[][]; delimiter: string };
export type OnboardingOptions = { stateByPropertyId?: Record<string, string>; dateOrder?: "ISO" | "MDY" | "DMY" };
export const ONBOARDING_STATE_CODES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI".split(" ");
export const ONBOARDING_MAX_BYTES = 10 * 1024 * 1024;
export const ONBOARDING_MAX_ROWS = 5000;
export const normalizeOnboardingHeader = (text: string) => text.normalize("NFKC").trim().toLowerCase().replace(/#/g, "number").replace(/[\s_.\-\u200B-\u200D\uFEFF]+/g, "");
const fields = Object.keys(ONBOARDING_FIELDS) as OnboardingField[];
const aliasLookup = new Map<string, OnboardingField>();
for (const field of fields) for (const name of [field, ...ONBOARDING_FIELDS[field].aliases]) aliasLookup.set(normalizeOnboardingHeader(name), field);

export function readOnboardingCsv(input: string): CsvTable {
  if (new TextEncoder().encode(input).length > ONBOARDING_MAX_BYTES) throw new Error("The onboarding CSV must be 10 MB or smaller.");
  let text = input.replace(/^\uFEFF/, "").replace(/^(?:[ \t]*(?:\r\n|\r|\n))+/, "");
  if (text.includes("\0")) throw new Error("Export the spreadsheet as UTF-8 CSV before uploading.");
  const directive = /^sep=([,;\t])(?:\r\n|\r|\n)/i.exec(text);
  let delimiter = directive?.[1] ?? ",";
  if (directive) text = text.slice(directive[0].length);
  else {
    const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i]!;
      if (char === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; }
      else if (!quoted) {
        if (char === "\r" || char === "\n") break;
        if (counts.has(char)) counts.set(char, counts.get(char)! + 1);
      }
    }
    delimiter = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
  }
  const records: string[][] = [];
  let row: string[] = [], value = "", quoted = false, closedQuote = false;
  const finishCell = () => { row.push(value); value = ""; closedQuote = false; };
  const finishRow = () => {
    finishCell();
    if (row.some((cell) => cell.trim())) records.push(row);
    if (row.length > 200) throw new Error("The onboarding CSV supports up to 200 columns.");
    if (records.length > ONBOARDING_MAX_ROWS + 1) throw new Error("Import no more than 5,000 unit / tenant rows at once.");
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else value += char;
    } else if (char === delimiter) finishCell();
    else if (char === "\n" || char === "\r") { finishRow(); if (char === "\r" && text[i + 1] === "\n") i++; }
    else if (char === '"' && !value && !closedQuote) quoted = true;
    else if (closedQuote || char === '"') throw new Error(`CSV record ${records.length + 1}: unexpected character near a quoted value.`);
    else value += char;
    if (value.length > 10000) throw new Error("A CSV cell exceeds the 10,000-character limit.");
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  if (value.length || row.length || closedQuote) finishRow();
  if (records.length < 2) throw new Error("Include a header row and at least one unit or tenant row.");
  const headers = records.shift()!;
  for (const [index, record] of records.entries()) {
    if (record.length !== headers.length) throw new Error(`CSV record ${index + 2}: ${record.length} cells do not match ${headers.length} headings. Check separators and quoted values.`);
  }
  return { headers, records, delimiter };
}

export function suggestOnboardingMapping(headers: readonly string[]) {
  const candidates: Partial<Record<OnboardingField, number[]>> = {};
  headers.forEach((header, index) => {
    const field = aliasLookup.get(normalizeOnboardingHeader(header));
    if (field) (candidates[field] ??= []).push(index);
  });
  const mapping: OnboardingMapping = {};
  for (const field of fields) {
    const exact = (candidates[field] ?? []).filter((index) => normalizeOnboardingHeader(headers[index]!) === normalizeOnboardingHeader(field));
    mapping[field] = exact.length === 1 ? exact[0]! : candidates[field]?.length === 1 ? candidates[field]![0]! : null;
  }
  return { mapping, candidates };
}

export type OnboardingRow = {
  propertyExternalId: string; propertyName: string; state: string;
  propertyAddress?: string | undefined; city?: string | undefined; postalCode?: string | undefined;
  unitExternalId: string; unitNumber: string; bedrooms?: number | undefined;
  tenantExternalId: string; householdName: string; isVacant: boolean; moveInDate?: string | undefined;
  certificationType?: "INITIAL" | "ANNUAL" | "INTERIM" | undefined;
  certificationEffectiveDate?: string | undefined; programCodes: string[];
  sourceData: {
    csvRecord: number;
    columns: { heading: string; value: string }[];
    mapping: OnboardingMapping;
    suppliedState: string | null;
    dateOrder: "ISO" | "MDY" | "DMY";
  };
};

function normalizeDate(value: string, order: "ISO" | "MDY" | "DMY") {
  if (!value) return undefined;
  let normalized = value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
    if (order === "ISO" || !parts) throw new Error("use YYYY-MM-DD or select the file's month/day or day/month date order");
    const month = order === "MDY" ? parts[1]! : parts[2]!;
    const day = order === "MDY" ? parts[2]! : parts[1]!;
    normalized = `${parts[3]}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const date = new Date(normalized + "T00:00:00Z");
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized || normalized.startsWith("0000")) throw new Error("not a valid calendar date");
  return normalized;
}

export function previewOnboarding(table: CsvTable, mapping: OnboardingMapping, options: OnboardingOptions = {}) {
  const issues: string[] = [];
  let issueCount = 0;
  const issue = (message: string) => { issueCount++; if (issues.length < 50) issues.push(message); };
  const used = new Map<number, string>();
  for (const [field, index] of Object.entries(mapping)) {
    if (!Object.hasOwn(ONBOARDING_FIELDS, field)) { issue(`Unknown destination field: ${field}.`); continue; }
    if (index == null) continue;
    if (!Number.isInteger(index) || index < 0 || index >= table.headers.length) { issue(`Choose a valid source column for ${field}.`); continue; }
    if (used.has(index)) issue(`Column ${index + 1} is assigned to both ${used.get(index)} and ${field}. Resolve the duplicate mapping.`);
    used.set(index, field);
  }
  const required: OnboardingField[] = ["property_external_id", "property_name", "unit_external_id", "unit_number"];
  for (const field of required) if (mapping[field] == null) issue(`Choose the source column for ${ONBOARDING_FIELDS[field].label}.`);
  const stateNeeded = new Map<string, { id: string; name: string }>();
  const rows: OnboardingRow[] = [];
  const propertySeen = new Map<string, Record<string, unknown>>();
  const unitSeen = new Map<string, Record<string, unknown>>();
  const tenantSeen = new Map<string, Record<string, unknown>>();
  const dateOrder = options.dateOrder ?? "ISO";
  const checkIdentity = (map: Map<string, Record<string, unknown>>, key: string, data: Record<string, unknown>, label: string, record: number) => {
    const previous = map.get(key) ?? {};
    for (const [field, value] of Object.entries(data)) {
      if (value === undefined || value === "") continue;
      if (previous[field] !== undefined && JSON.stringify(previous[field]) !== JSON.stringify(value)) issue(`CSV record ${record}: conflicting ${field} for the same ${label} reference. Resolve the conflicting records before import.`);
      previous[field] = value;
    }
    map.set(key, previous);
  };
  if (issueCount) return { rows, issues, issueCount, stateNeeded: [...stateNeeded.values()], canImport: false, counts: { properties: 0, units: 0, tenants: 0 } };
  for (const [offset, values] of table.records.entries()) {
    const record = offset + 2;
    const get = (field: OnboardingField) => mapping[field] == null ? "" : (values[mapping[field]!] ?? "").trim();
    const propertyExternalId = get("property_external_id"), propertyName = get("property_name");
    const suppliedState = Object.hasOwn(options.stateByPropertyId ?? {}, propertyExternalId) ? options.stateByPropertyId![propertyExternalId]!.trim().toUpperCase() : "";
    const rawState = get("state").toUpperCase();
    const state = rawState || suppliedState;
    if (!state) stateNeeded.set(propertyExternalId, { id: propertyExternalId, name: propertyName });
    else if (!ONBOARDING_STATE_CODES.includes(state)) issue(`CSV record ${record}: property state must be a valid two-letter code.`);
    const nameParts = [get("tenant_first_name"), get("tenant_middle_name"), get("tenant_last_name")];
    const householdName = get("household_name") || (nameParts[0] && nameParts[2] ? nameParts.filter(Boolean).join(" ") : "");
    const occupancy = normalizeOnboardingHeader(get("occupancy_status"));
    const isVacant = ["vacant", "vacantready", "vacantunready", "vacantnotready", "unoccupied"].includes(occupancy);
    if (isVacant && [get("tenant_external_id"), householdName, ...nameParts, get("move_in_date"), get("certification_type"), get("certification_effective_date")].some(Boolean)) {
      issue(`CSV record ${record}: vacant units must not include tenant or certification details. Correct the occupancy or clear those details.`);
    }
    const row: OnboardingRow = {
      propertyExternalId, propertyName, state, isVacant,
      propertyAddress: get("property_address") || undefined, city: get("city") || undefined, postalCode: get("postal_code") || undefined,
      unitExternalId: get("unit_external_id"), unitNumber: get("unit_number"), tenantExternalId: get("tenant_external_id"), householdName,
      programCodes: get("program_codes").split(/[|;]/).map((value) => value.trim().toUpperCase()).filter(Boolean),
      sourceData: { csvRecord: record, columns: table.headers.map((heading, i) => ({ heading, value: values[i] ?? "" })), mapping, suppliedState: rawState ? null : suppliedState || null, dateOrder },
    };
    for (const [label, value, max] of [
      ["property reference ID", row.propertyExternalId, 120], ["property name", row.propertyName, 240], ["unit reference ID", row.unitExternalId, 120],
      ["unit number", row.unitNumber, 80],
    ] as const) if (!value || value.length > max) issue(`CSV record ${record}: ${label} is required and must be no longer than ${max} characters.`);
    if (!isVacant) for (const [label, value, max] of [["tenant reference ID", row.tenantExternalId, 160], ["household name", row.householdName, 240]] as const) {
      if (!value || value.length > max) issue(`CSV record ${record}: ${label} is required for occupied units and must be no longer than ${max} characters. For a vacant unit, map occupancy status and supply Vacant.`);
    }
    for (const [label, value, max] of [["property address", row.propertyAddress, 300], ["city", row.city, 160], ["postal code", row.postalCode, 20]] as const) if (value && value.length > max) issue(`CSV record ${record}: ${label} is too long.`);
    if (row.programCodes.length > 20 || row.programCodes.some((value) => value.length > 80)) issue(`CSV record ${record}: invalid program-code length or count.`);
    const bedroomText = get("bedrooms");
    if (bedroomText) {
      row.bedrooms = Number(bedroomText);
      if (!Number.isInteger(row.bedrooms) || row.bedrooms < 0 || row.bedrooms > 20) issue(`CSV record ${record}: bedroom count must be a whole number from 0 to 20.`);
    }
    const typeText = get("certification_type").toUpperCase();
    if (typeText) {
      const types: Record<string, "INITIAL" | "ANNUAL" | "INTERIM"> = { INITIAL: "INITIAL", ANNUAL: "ANNUAL", INTERIM: "INTERIM", "INITIAL CERTIFICATION": "INITIAL", RECERTIFICATION: "ANNUAL", "ANNUAL RECERTIFICATION": "ANNUAL", "ANNUAL CERTIFICATION": "ANNUAL", "INTERIM CERTIFICATION": "INTERIM" };
      if (Object.hasOwn(types, typeText)) row.certificationType = types[typeText];
      else issue(`CSV record ${record}: unknown certification type. Choose an equivalent source column; do not substitute another certification type.`);
    }
    for (const [field, target] of [["move_in_date", "moveInDate"], ["certification_effective_date", "certificationEffectiveDate"]] as const) {
      try { row[target] = normalizeDate(get(field), dateOrder); }
      catch (error) { issue(`CSV record ${record}: ${field}: ${error instanceof Error ? error.message : "invalid date"}.`); }
    }
    checkIdentity(propertySeen, row.propertyExternalId, { propertyName, state, propertyAddress: row.propertyAddress, city: row.city, postalCode: row.postalCode }, "property", record);
    checkIdentity(unitSeen, JSON.stringify([row.propertyExternalId, row.unitExternalId]), { unitNumber: row.unitNumber, bedrooms: row.bedrooms, isVacant: row.isVacant }, "unit", record);
    if (!row.isVacant && row.tenantExternalId) checkIdentity(tenantSeen, row.tenantExternalId, { propertyExternalId, unitExternalId: row.unitExternalId, householdName, moveInDate: row.moveInDate, certificationType: row.certificationType, certificationEffectiveDate: row.certificationEffectiveDate, programCodes: row.programCodes.length ? row.programCodes : undefined }, "tenant", record);
    rows.push(row);
  }
  return { rows, issues, issueCount, stateNeeded: [...stateNeeded.values()], canImport: issueCount === 0 && stateNeeded.size === 0 && rows.length > 0, counts: { properties: propertySeen.size, units: unitSeen.size, tenants: tenantSeen.size } };
}
