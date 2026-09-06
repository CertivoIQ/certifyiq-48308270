export const PORTFOLIO_IMPORT_COLUMNS = [
  "property_external_id", "property_name", "state", "property_address", "city", "postal_code",
  "unit_external_id", "unit_number", "bedrooms", "tenant_external_id", "household_name",
  "move_in_date", "certification_type", "certification_effective_date", "program_codes",
  "document_file_name",
] as const;

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

function parseCsvRecords(text: string) {
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
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
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
  const records = parseCsvRecords(text);
  if (records.length < 2) throw new Error("The intake CSV must include a header and at least one tenant row.");
  const headers = records[0]!.map((value) => value.trim().toLowerCase());
  const required = ["property_external_id","property_name","state","unit_external_id","unit_number","tenant_external_id","household_name","certification_type"];
  for (const column of required) if (!headers.includes(column)) throw new Error(`Missing required column: ${column}`);
  const index = (name: string) => headers.indexOf(name);
  const get = (values: string[], name: string) => index(name) < 0 ? "" : (values[index(name)] ?? "").trim();

  return records.slice(1).map((values, offset) => {
    const rowNumber = offset + 2;
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
