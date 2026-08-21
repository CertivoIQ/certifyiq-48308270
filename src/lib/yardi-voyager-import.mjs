const HEADER_ALIASES = {
  propertyCode: ["propertycode", "property_code", "property", "propcode", "propertyid"],
  propertyName: ["propertyname", "property_name", "propname"],
  unitCode: ["unitcode", "unit_code", "unit", "unitid"],
  residentCode: ["residentcode", "resident_code", "resident", "residentid", "tenantcode"],
  householdName: ["householdname", "household_name", "residentname", "tenantname"],
  certificationType: ["certificationtype", "certification_type", "certtype"],
  effectiveDate: ["effectivedate", "effective_date", "certificationdate", "certdate"],
  annualIncome: ["annualincome", "annual_income", "totalannualincome", "income"],
  status: ["status", "residentstatus", "certificationstatus"],
};

const REQUIRED_FIELDS = ["propertyCode", "unitCode", "residentCode"];

function canonicalHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text ?? "").replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted value.");
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function buildHeaderMap(headers) {
  const normalized = headers.map(canonicalHeader);
  const map = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) map[field] = index;
  }
  return map;
}

function parseDate(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const candidate = match
    ? new Date(Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2])))
    : new Date(trimmed);
  return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString().slice(0, 10);
}

function parseCurrency(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed.replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1"));
  return Number.isFinite(numeric) ? numeric : null;
}

export function importYardiVoyagerCsv(text) {
  const csvRows = parseCsvRows(text);
  if (csvRows.length < 2) {
    return { provider: "Yardi Voyager", source: "csv_export", records: [], errors: [{ row: 1, field: "file", message: "A header and at least one data row are required." }], summary: { total: 0, accepted: 0, rejected: 0, duplicates: 0 } };
  }

  const headerMap = buildHeaderMap(csvRows[0]);
  const missingHeaders = REQUIRED_FIELDS.filter((field) => headerMap[field] === undefined);
  if (missingHeaders.length) {
    return { provider: "Yardi Voyager", source: "csv_export", records: [], errors: missingHeaders.map((field) => ({ row: 1, field, message: `Required Yardi export column is missing: ${field}.` })), summary: { total: csvRows.length - 1, accepted: 0, rejected: csvRows.length - 1, duplicates: 0 } };
  }

  const records = [];
  const errors = [];
  const seen = new Set();
  let duplicates = 0;

  csvRows.slice(1).forEach((values, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const read = (field) => headerMap[field] === undefined ? "" : String(values[headerMap[field]] ?? "").trim();
    const raw = {
      propertyCode: read("propertyCode"),
      propertyName: read("propertyName"),
      unitCode: read("unitCode"),
      residentCode: read("residentCode"),
      householdName: read("householdName"),
      certificationType: read("certificationType"),
      effectiveDate: read("effectiveDate"),
      annualIncome: read("annualIncome"),
      status: read("status"),
    };
    const rowErrors = [];
    for (const field of REQUIRED_FIELDS) {
      if (!raw[field]) rowErrors.push({ row: rowNumber, field, message: `${field} is required.` });
    }
    const effectiveDate = parseDate(raw.effectiveDate);
    if (raw.effectiveDate && !effectiveDate) rowErrors.push({ row: rowNumber, field: "effectiveDate", message: "Effective date is invalid." });
    const annualIncome = parseCurrency(raw.annualIncome);
    if (raw.annualIncome && annualIncome === null) rowErrors.push({ row: rowNumber, field: "annualIncome", message: "Annual income is invalid." });

    const externalRecordKey = [raw.propertyCode, raw.unitCode, raw.residentCode, effectiveDate ?? ""].join(":");
    if (seen.has(externalRecordKey)) {
      duplicates += 1;
      rowErrors.push({ row: rowNumber, field: "externalRecordKey", message: "Duplicate Yardi record in this file." });
    }
    seen.add(externalRecordKey);

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }

    records.push({
      provider: "Yardi Voyager",
      importMode: "csv_export",
      externalRecordKey,
      property: { externalId: raw.propertyCode, name: raw.propertyName || null },
      unit: { externalId: raw.unitCode },
      household: { externalId: raw.residentCode, name: raw.householdName || null, status: raw.status || null },
      certification: { type: raw.certificationType || null, effectiveDate, annualIncome },
      sourceRow: rowNumber,
    });
  });

  return {
    provider: "Yardi Voyager",
    source: "csv_export",
    records,
    errors,
    summary: { total: csvRows.length - 1, accepted: records.length, rejected: (csvRows.length - 1) - records.length, duplicates },
  };
}

export function reconcileYardiImport(result) {
  const acceptedKeys = new Set(result.records.map((record) => record.externalRecordKey));
  return {
    provider: result.provider,
    source: result.source,
    totalsMatch: result.summary.total === result.summary.accepted + result.summary.rejected,
    acceptedKeysUnique: acceptedKeys.size === result.records.length,
    readyToCommit: result.errors.length === 0 && result.summary.accepted > 0,
    summary: result.summary,
  };
}
