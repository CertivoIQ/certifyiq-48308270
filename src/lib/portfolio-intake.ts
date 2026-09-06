export const PORTFOLIO_IMPORT_COLUMNS = [
  "property_external_id", "property_name", "state", "property_address", "city", "postal_code",
  "unit_external_id", "unit_number", "bedrooms", "tenant_external_id", "household_name",
  "move_in_date", "certification_type", "certification_effective_date", "program_codes",
  "document_file_name",
] as const;

export const PORTFOLIO_REQUIRED_IMPORT_COLUMNS = [
  "property_external_id", "property_name", "state", "unit_external_id", "unit_number",
  "tenant_external_id", "household_name", "certification_type",
] as const;

type PortfolioImportColumn = typeof PORTFOLIO_IMPORT_COLUMNS[number];

// Only explicit, equivalent headings are mapped. Never derive identity from names,
// unit numbers, or row positions: stable external IDs are used for database upserts.
const HEADER_ALIASES: Partial<Record<PortfolioImportColumn, readonly string[]>> = {
  property_external_id: ["property_id", "property_code", "external_property_id"],
  state: ["state_code"],
  property_address: ["property_address_line_1", "address_line_1"],
  postal_code: ["zip_code", "zipcode"],
  unit_external_id: ["unit_id", "unit_code", "external_unit_id"],
  unit_number: ["unit_no", "apartment_number"],
  bedrooms: ["bedroom_count"],
  tenant_external_id: ["tenant_id", "tenant_code", "resident_id", "resident_code", "household_id", "external_tenant_id"],
  household_name: ["tenant_name", "resident_name", "head_of_household_name"],
  certification_type: ["cert_type"],
  certification_effective_date: ["cert_effective_date"],
};

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[\s_\-\u200B-\u200D\uFEFF]+/g, "");
const headerLookup = new Map<string, PortfolioImportColumn>();
for (const column of PORTFOLIO_IMPORT_COLUMNS) {
  for (const label of [column, ...(HEADER_ALIASES[column] ?? [])]) {
    headerLookup.set(normalizeHeader(label), column);
  }
}

export type PortfolioIntakeRow = {
  propertyExternalId: string;
  propertyName: string;
  state: string;
  propertyAddress?: string | undefined;
  city?: string | undefined;
  postalCode?: string | undefined;
  unitExternalId: string;
  unitNumber: string;
  bedrooms?: number | undefined;
  tenantExternalId: string;
  householdName: string;
  moveInDate?: string | undefined;
  certificationType: "INITIAL" | "ANNUAL" | "INTERIM";
  certificationEffectiveDate?: string | undefined;
  programCodes: string[];
  documentFileName?: string | undefined;
};

function prepareCsvInput(text: string) {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/^(?:[ \t]*(?:\r\n|\r|\n))+/, "");
  // Some spreadsheet exports place a separator directive before the headings.
  const directive = /^sep=([,;\t])(?:\r\n|\r|\n)/i.exec(cleaned);
  if (directive) return { text: cleaned.slice(directive[0].length), delimiter: directive[1]! };

  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i]!;
    if (char === '"') {
      if (quoted && cleaned[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted) {
      if (char === "\r" || char === "\n") break;
      if (counts.has(char)) counts.set(char, counts.get(char)! + 1);
    }
  }
  // Detect the separator from the header only, never from addresses or program values.
  let delimiter = ",";
  let count = 0;
  for (const [candidate, candidateCount] of counts) {
    if (candidateCount > count) { delimiter = candidate; count = candidateCount; }
  }
  return { text: cleaned, delimiter };
}

function parseCsvRecords(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      row.push(field); rows.push(row); row = []; field = "";
      if (char === "\r" && text[i + 1] === "\n") i += 1;
    } else field += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((values) => values.some((value) => value.trim()));
}

const dateOrUndefined = (value: string, label: string, rowNumber: number) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(Date.parse(trimmed + "T00:00:00Z"))) {
    throw new Error(`Row ${rowNumber}: ${label} must use YYYY-MM-DD.`);
  }
  return trimmed;
};

export function parsePortfolioIntakeCsv(text: string): PortfolioIntakeRow[] {
  const prepared = prepareCsvInput(text);
  const records = parseCsvRecords(prepared.text, prepared.delimiter);
  if (records.length < 2) throw new Error("The intake CSV must include a header and at least one tenant row.");
  const headers = records[0]!.map((value) => headerLookup.get(normalizeHeader(value)) ?? "");
  const seen = new Map<string, number>();
  headers.forEach((header, index) => {
    if (!header) return; // Unrelated export columns remain ignored.
    const prior = seen.get(header);
    if (prior !== undefined) throw new Error(`Columns ${prior + 1} and ${index + 1} both map to ${header}. Keep only one column for this field to avoid importing the wrong value.`);
    seen.set(header, index);
  });
  const missing = PORTFOLIO_REQUIRED_IMPORT_COLUMNS.filter((column) => !seen.has(column));
  if (missing.length) {
    const identityHelp = missing.some((column) => column.endsWith("_external_id"))
      ? " External IDs are stable property, unit, and tenant reference codes from your records, not personal identification numbers. Keep the same codes on future imports; do not substitute names."
      : "";
    throw new Error(`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Put column headings in the first row or use Download onboarding CSV. Property ID / Property Code, Unit ID, and Tenant ID / Resident ID are also accepted.${identityHelp}`);
  }
  const get = (values: string[], name: PortfolioImportColumn) => {
    const index = seen.get(name);
    return index === undefined ? "" : (values[index] ?? "").trim();
  };

  return records.slice(1).map((values, offset) => {
    const rowNumber = offset + 2;
    if (values.slice(headers.length).some((value) => value.trim())) {
      throw new Error(`Row ${rowNumber}: more values than column headings. Quote values containing the CSV separator and check the header row.`);
    }
    const state = get(values, "state").toUpperCase();
    const certificationType = get(values, "certification_type").toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) throw new Error(`Row ${rowNumber}: state must be a two-letter code.`);
    if (!["INITIAL","ANNUAL","INTERIM"].includes(certificationType)) throw new Error(`Row ${rowNumber}: certification_type must be INITIAL, ANNUAL, or INTERIM.`);
    const bedroomsText = get(values, "bedrooms");
    const bedrooms = bedroomsText ? Number(bedroomsText) : undefined;
    if (bedrooms !== undefined && (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 20)) throw new Error(`Row ${rowNumber}: bedrooms must be a whole number from 0 to 20.`);
    const programs = get(values, "program_codes").split(/[|;]/).map((value) => value.trim().toUpperCase()).filter(Boolean);
    return {
      propertyExternalId: get(values, "property_external_id"),
      propertyName: get(values, "property_name"),
      state,
      propertyAddress: get(values, "property_address") || undefined,
      city: get(values, "city") || undefined,
      postalCode: get(values, "postal_code") || undefined,
      unitExternalId: get(values, "unit_external_id"),
      unitNumber: get(values, "unit_number"),
      bedrooms,
      tenantExternalId: get(values, "tenant_external_id"),
      householdName: get(values, "household_name"),
      moveInDate: dateOrUndefined(get(values, "move_in_date"), "move_in_date", rowNumber),
      certificationType: certificationType as PortfolioIntakeRow["certificationType"],
      certificationEffectiveDate: dateOrUndefined(get(values, "certification_effective_date"), "certification_effective_date", rowNumber),
      programCodes: programs.length ? programs : ["LIHTC"],
      documentFileName: get(values, "document_file_name") || undefined,
    };
  }).map((row, offset) => {
    for (const [label, value] of Object.entries({
      property_external_id: row.propertyExternalId, property_name: row.propertyName,
      unit_external_id: row.unitExternalId, unit_number: row.unitNumber,
      tenant_external_id: row.tenantExternalId, household_name: row.householdName,
    })) if (!String(value).trim()) throw new Error(`Row ${offset + 2}: ${label} is required.`);
    return row;
  });
}

export const PORTFOLIO_IMPORT_TEMPLATE = PORTFOLIO_IMPORT_COLUMNS.join(",") + "\n" +
  "PROP-001,Oak Terrace,TN,100 Main St,Nashville,37201,UNIT-101,101,2,TENANT-001,Sample Household,2026-01-15,ANNUAL,2026-09-01,LIHTC|HOME,tenant-001-certification.pdf\n";
