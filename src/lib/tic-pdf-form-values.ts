type PdfFieldWidget = {
  value?: unknown;
  fieldValue?: unknown;
  buttonValue?: unknown;
  exportValues?: unknown;
  type?: unknown;
  page?: unknown;
};

export type PdfFieldObjects = Record<string, PdfFieldWidget[]>;

function cleanValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(cleanValue).filter(Boolean).join(", ");
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function widgetValue(widget: PdfFieldWidget): string {
  for (const candidate of [widget.value, widget.fieldValue, widget.buttonValue]) {
    const cleaned = cleanValue(candidate);
    if (cleaned) return cleaned;
  }
  return "";
}

function pageNumber(widget: PdfFieldWidget): number {
  const raw = Number(widget.page);
  return Number.isInteger(raw) && raw >= 0 ? raw + 1 : 1;
}

function isSelectedButton(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized && !["off", "false", "0", "no", "none", "null", "undefined"].includes(normalized));
}

function rowFromSuffix(name: string, base: string, maxRows: number): number | null {
  if (name === base) return 1;
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}-(\\d+)$`).exec(name);
  if (!match?.[1]) return null;
  const row = Number(match[1]) + 2;
  return row >= 1 && row <= maxRows ? row : null;
}

function staticFieldAlias(name: string): string | null {
  const aliases: Record<string, string> = {
    "Movein Date": "move-in date",
    "Current Date": "current date",
    "Effective Date": "effective date",
    "Other-0": "other certification type",
    "Property Name": "property name",
    County: "county",
    TC: "tc#",
    BIN: "bin#",
    Address: "address",
    "Unit Number": "unit number",
    "# Bedrooms": "# bedrooms",
    "Total Employment": "total employment",
    "Total SS/Pensions": "total ss/pensions",
    "Total Public Assistance": "total public assistance",
    "Total Other Income": "total other income",
    "Total Income": "total income (e)",
    "Total Actual Income from Assets": "actual income earned from all assets",
    "Total of NNPP": "total of nnpp",
    "Total Income from Assets": "total income from assets",
    "Total Annual Household Income": "total annual household income from all sources",
    "Current Income Limit per Family Size": "current income limit per family size",
    "Household Income at Movein": "household income at move-in",
    "Household Size at Move-in": "household size at move-in",
    "Tenant Paid Rent": "tenant paid rent",
    "Utility Allowance": "utility allowance",
    "Rent Assistance": "rent assistance",
    "Rental Assistance Type": "rental assistance type",
    "Other non-optional charges": "other non-optional charges",
    "Gross Rent for Unit": "gross rent for unit",
    "Maximum Rent Limit for this unit": "maximum rent limit for this unit",
    "Student Status Explanation": "student explanation",
    "Signature of OwnerRepresentative": "owner representative",
    "Date-3": "owner signature date",
  };
  return aliases[name] ?? null;
}

function householdAlias(name: string): string | null {
  const columns: Array<[string, string]> = [
    ["Last Name", "last name"],
    ["First Name Middle Initial", "first name middle initial"],
    ["Rel HH", "relationship"],
    ["Race", "race"],
    ["Ethn", "ethnicity"],
    ["Dsbs", "disability"],
    ["Gndr", "gender"],
    ["Date of Birth", "date of birth"],
    ["FIT Student", "full-time student"],
    ["Social Security Or Alien Reg No", "ssn alien registration"],
  ];
  for (const [base, suffix] of columns) {
    const row = rowFromSuffix(name, base, 10);
    if (row) return `household member ${row} ${suffix}`;
  }
  return null;
}

function incomeAlias(name: string): string | null {
  const columns: Array<[string, string]> = [
    ["A Employment or Wages", "employment or wages"],
    ["B Social SecurityPensions", "social security pensions"],
    ["C Public Assistance", "public assistance"],
    ["D Other Income", "other income"],
  ];
  for (const [base, suffix] of columns) {
    const row = rowFromSuffix(name, base, 10);
    if (row) return `income member ${row} ${suffix}`;
  }
  return null;
}

function assetAlias(name: string): string | null {
  const columns: Array<[string, string]> = [
    ["Hshld Mbr", "household member number"],
    ["G Type of Asset", "type"],
    ["H Current Disposed", "current disposed"],
    ["I NNPP  Real Tax Relief", "category"],
    ["J Cash Value of Asset", "cash value"],
    ["K Actual Imputed", "income method"],
    ["L Annual Income from Asset", "annual income"],
  ];
  for (const [base, suffix] of columns) {
    const row = rowFromSuffix(name, base, 27);
    if (row) return `asset ${row} ${suffix}`;
  }
  return null;
}

function signatureAlias(name: string): string | null {
  const dateRow = rowFromSuffix(name, "Date", 4);
  if (dateRow) return `household member ${dateRow} signature date`;
  const signatureRow = rowFromSuffix(name, "Signature", 4);
  if (signatureRow) return `household member ${signatureRow} signature present`;
  return null;
}

function selectedButtonAlias(name: string, value: string): [string, string] | null {
  if (!isSelectedButton(value)) return null;
  if (["Initial Certification", "Recertification", "Other"].includes(name)) {
    return ["certification type", name];
  }
  const incomeRestrictions: Record<string, string> = {
    "80": "80", "70": "70", "60": "60", "50": "50", "40": "40", "30": "30", "20": "20",
  };
  if (incomeRestrictions[name]) return ["household meets income restriction at", incomeRestrictions[name]!];
  const rentRestrictions: Record<string, string> = {
    "80-0": "80", "70-0": "70", "60-0": "60", "50-0": "50", "40-0": "40", "30-0": "30", "20-0": "20",
  };
  if (rentRestrictions[name]) return ["unit meets rent restriction at", rentRestrictions[name]!];
  const programs: Record<string, string> = {
    "a Tax Credit": "program type tax credit",
    "b HOME": "program type home",
    "c Tax Exempt": "program type tax exempt",
    "d PennHOMES": "program type pennhomes",
    ePennHOMESHOME: "program type pennhomes home",
  };
  if (programs[name]) return [programs[name]!, "Yes"];
  return null;
}

function pushLine(byPage: Map<number, string[]>, page: number, line: string) {
  const existing = byPage.get(page) ?? [];
  if (!existing.includes(line)) existing.push(line);
  byPage.set(page, existing);
}

/**
 * Convert native Acrobat/PDF.js form controls into deterministic label/value
 * lines that the existing TIC field parser can consume before OCR fallback.
 * These values come from the PDF form data itself, not from visual inference.
 */
export function ticPdfFormValueLinesByPage(fieldObjects: PdfFieldObjects | null | undefined): Map<number, string[]> {
  const byPage = new Map<number, string[]>();
  if (!fieldObjects) return byPage;

  for (const [name, widgets] of Object.entries(fieldObjects)) {
    for (const widget of widgets ?? []) {
      const value = widgetValue(widget);
      if (!value) continue;

      const button = selectedButtonAlias(name, value);
      if (button) {
        pushLine(byPage, pageNumber(widget), `${button[0]}: ${button[1]}`);
        continue;
      }
      const type = String(widget.type ?? "").toLowerCase();
      if ((type.includes("button") || type.includes("checkbox") || type.includes("radio")) && !isSelectedButton(value)) {
        continue;
      }

      const alias = staticFieldAlias(name) ?? householdAlias(name) ?? incomeAlias(name) ?? assetAlias(name) ?? signatureAlias(name);
      if (!alias) continue;
      const normalizedValue = alias.endsWith("signature present") ? "Yes" : value;
      pushLine(byPage, pageNumber(widget), `${alias}: ${normalizedValue}`);
    }
  }
  return byPage;
}
