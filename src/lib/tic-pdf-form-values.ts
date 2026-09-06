type PdfFieldWidget = {
  value?: unknown;
  fieldValue?: unknown;
  buttonValue?: unknown;
  exportValues?: unknown;
  type?: unknown;
  page?: unknown;
};

export type PdfFieldObjects = Record<string, PdfFieldWidget[]>;

const DIRECT_PREFIX = "__CERTIVOIQ_TIC_FIELD__";

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

function yesNoFromButtonValue(value: string): "Yes" | "No" | null {
  const normalized = value.toLowerCase();
  if (/(?:^|[_\s-])yes(?:[_\s-]|$)/.test(normalized)) return "Yes";
  if (/(?:^|[_\s-])no(?:[_\s-]|$)/.test(normalized)) return "No";
  return null;
}

function rowFromSuffix(name: string, base: string, maxRows: number): number | null {
  if (name === base) return 1;
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}-(\\d+)$`).exec(name);
  if (!match?.[1]) return null;
  const row = Number(match[1]) + 2;
  return row >= 1 && row <= maxRows ? row : null;
}

function directLine(key: string, value: string): string {
  return `${DIRECT_PREFIX} ${key}: ${cleanValue(value)}`;
}

function staticFieldKey(name: string): string | null {
  const keys: Record<string, string> = {
    "Movein Date": "move_in_date",
    "Current Date": "current_date",
    "Effective Date": "certification_effective_date",
    "Other-0": "other_certification_type",
    "Property Name": "property_name",
    County: "county",
    TC: "tax_credit_number",
    BIN: "building_identification_number",
    Address: "property_address",
    "Unit Number": "unit_number",
    "# Bedrooms": "unit_bedrooms",
    "Total Employment": "total_employment_income",
    "Total SS/Pensions": "total_social_security_pensions",
    "Total Public Assistance": "total_public_assistance",
    "Total Other Income": "total_other_income",
    "Total Income": "total_income_e",
    "Total Actual Income from Assets": "asset_actual_income_below_iit",
    "Total of NNPP": "total_nnpp",
    "Total Income from Assets": "total_income_assets_m",
    "Total Annual Household Income": "household_annual_income",
    "Current Income Limit per Family Size": "applicable_lihtc_income_limit",
    "Household Income at Movein": "household_income_at_move_in",
    "Household Size at Move-in": "household_size_at_move_in",
    "Tenant Paid Rent": "tenant_paid_rent",
    "Utility Allowance": "utility_allowance",
    "Rent Assistance": "rent_assistance",
    "Rental Assistance Type": "rental_assistance_type",
    "Other non-optional charges": "other_non_optional_charges",
    "Gross Rent for Unit": "gross_rent",
    "Maximum Rent Limit for this unit": "state_max_gross_rent",
    "Student Status Explanation": "student_exception_code",
    "Date-3": "owner_representative_signature_date",
  };
  return keys[name] ?? null;
}

function householdKey(name: string): string | null {
  const columns: Array<[string, string]> = [
    ["Last Name", "last_name"],
    ["First Name Middle Initial", "first_name_middle_initial"],
    ["Rel HH", "relationship"],
    ["Race", "race"],
    ["Ethn", "ethnicity"],
    ["Dsbs", "disability"],
    ["Gndr", "gender"],
    ["Date of Birth", "date_of_birth"],
    ["FIT Student", "full_time_student"],
    ["Social Security Or Alien Reg No", "ssn_or_alien_registration"],
  ];
  for (const [base, suffix] of columns) {
    const row = rowFromSuffix(name, base, 10);
    if (row) return `household_member_${row}_${suffix}`;
  }
  return null;
}

function incomeKey(name: string): string | null {
  const columns: Array<[string, string]> = [
    ["A Employment or Wages", "wages_business"],
    ["B Social SecurityPensions", "social_security_pension"],
    ["C Public Assistance", "public_assistance"],
    ["D Other Income", "other_income"],
  ];
  for (const [base, suffix] of columns) {
    const row = rowFromSuffix(name, base, 10);
    if (row) return `income_member_${row}_${suffix}`;
  }
  return null;
}

function assetKey(name: string): string | null {
  const columns: Array<[string, string]> = [
    ["Hshld Mbr", "household_member_number"],
    ["G Type of Asset", "type"],
    ["H Current Disposed", "current_disposed"],
    ["I NNPP  Real Tax Relief", "category"],
    ["J Cash Value of Asset", "cash_value"],
    ["K Actual Imputed", "income_method"],
    ["L Annual Income from Asset", "annual_income"],
  ];
  for (const [base, suffix] of columns) {
    const row = rowFromSuffix(name, base, 27);
    if (row) return `asset_${row}_${suffix}`;
  }
  return null;
}

function signatureKey(name: string): string | null {
  const dateRow = rowFromSuffix(name, "Date", 4);
  if (dateRow) return `household_member_${dateRow}_signature_date`;
  const signatureRow = rowFromSuffix(name, "Signature", 4);
  if (signatureRow) return `household_member_${signatureRow}_signature_present`;
  return null;
}

function selectedButtonField(name: string, value: string): [string, string] | null {
  if (!isSelectedButton(value)) return null;
  if (["Initial Certification", "Recertification", "Other"].includes(name)) {
    return ["certification_type", name];
  }
  if (name === "at recertification") {
    const answer = yesNoFromButtonValue(value);
    return answer ? ["income_exceeds_140_percent", answer] : null;
  }
  if (name === "RadioButton") {
    const answer = yesNoFromButtonValue(value);
    return answer ? ["all_occupants_full_time_students", answer] : null;
  }

  const incomeRestrictions: Record<string, string> = {
    "80": "80", "70": "70", "60": "60", "50": "50", "40": "40", "30": "30", "20": "20",
  };
  if (incomeRestrictions[name]) return ["household_income_restriction_percent", incomeRestrictions[name]!];

  const rentRestrictions: Record<string, string> = {
    "80-0": "80", "70-0": "70", "60-0": "60", "50-0": "50", "40-0": "40", "30-0": "30", "20-0": "20",
  };
  if (rentRestrictions[name]) return ["unit_rent_restriction_percent", rentRestrictions[name]!];

  const programs: Record<string, string> = {
    "a Tax Credit": "program_type_lihtc",
    "b HOME": "program_type_home",
    "c Tax Exempt": "program_type_tax_exempt_bond",
    "d PennHOMES": "program_type_pennhomes",
    ePennHOMESHOME: "program_type_pennhomes_home",
  };
  if (programs[name]) return [programs[name]!, "Yes"];

  const homeStatus: Record<string, string> = {
    "50 AMGI": "50% AMGI", "60 AMGI": "60% AMGI", "80 AMGI": "80% AMGI", OI: "OI",
  };
  if (homeStatus[name]) return ["program_home_income_status", homeStatus[name]!];

  const taxExemptStatus: Record<string, string> = {
    "50 AMGI-0": "50% AMGI", "60 AMGI-0": "60% AMGI", "80 AMGI-0": "80% AMGI", "OI-0": "OI",
  };
  if (taxExemptStatus[name]) return ["program_tax_exempt_income_status", taxExemptStatus[name]!];

  const pennhomesStatus: Record<string, string> = {
    "20 AMGI": "20% AMGI", "40 AMGI": "40% AMGI", "50 AMGI-1": "50% AMGI",
    "60 AMGI-1": "60% AMGI", "80-1": "80% AMGI", "OI-1": "OI",
  };
  if (pennhomesStatus[name]) return ["program_pennhomes_income_status", pennhomesStatus[name]!];

  const pennhomesHomeStatus: Record<string, string> = {
    "20 AMGI-0": "20% AMGI", "40 AMGI-0": "40% AMGI", "50 AMGI-2": "50% AMGI",
    "60 AMGI-2": "60% AMGI", "80-2": "80% AMGI", "O I": "OI",
  };
  if (pennhomesHomeStatus[name]) return ["program_pennhomes_home_income_status", pennhomesHomeStatus[name]!];

  return null;
}

function pushLine(byPage: Map<number, string[]>, page: number, line: string) {
  const existing = byPage.get(page) ?? [];
  if (!existing.includes(line)) existing.push(line);
  byPage.set(page, existing);
}

/**
 * Convert native Acrobat/PDF.js form controls into exact CertivoIQ TIC field
 * keys before OCR fallback. A source Last Name, County, Property Name, etc.
 * therefore cannot be routed to a neighboring field by text-order heuristics.
 */
export function ticPdfFormValueLinesByPage(fieldObjects: PdfFieldObjects | null | undefined): Map<number, string[]> {
  const byPage = new Map<number, string[]>();
  if (!fieldObjects) return byPage;

  for (const [name, widgets] of Object.entries(fieldObjects)) {
    for (const widget of widgets ?? []) {
      const value = widgetValue(widget);
      if (!value) continue;
      const page = pageNumber(widget);

      const button = selectedButtonField(name, value);
      if (button) {
        pushLine(byPage, page, directLine(button[0], button[1]));
        continue;
      }

      const type = String(widget.type ?? "").toLowerCase();
      if ((type.includes("button") || type.includes("checkbox") || type.includes("radio")) && !isSelectedButton(value)) {
        continue;
      }

      if (name === "Signature of OwnerRepresentative") {
        pushLine(byPage, page, directLine("owner_representative_signature_present", "Yes"));
        pushLine(byPage, page, directLine("owner_representative_name", value));
        continue;
      }

      const key = staticFieldKey(name) ?? householdKey(name) ?? incomeKey(name) ?? assetKey(name) ?? signatureKey(name);
      if (!key) continue;
      const normalizedValue = key.endsWith("_signature_present") ? "Yes" : value;
      pushLine(byPage, page, directLine(key, normalizedValue));
    }
  }
  return byPage;
}