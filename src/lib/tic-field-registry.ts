export type TicFieldType = "text" | "date" | "number" | "currency" | "yes_no";

export type TicFieldDefinition = {
  key: string;
  label: string;
  section: string;
  type: TicFieldType;
  aliases: readonly string[];
  placeholder?: string;
};

const field = (
  key: string,
  label: string,
  section: string,
  type: TicFieldType,
  aliases: readonly string[] = [],
  placeholder?: string,
): TicFieldDefinition => ({ key, label, section, type, aliases, ...(placeholder ? { placeholder } : {}) });

const householdMemberFields = Array.from({ length: 7 }, (_, index) => {
  const member = index + 1;
  const prefix = `Household member ${member}`;
  return [
    field(`household_member_${member}_last_name`, `${prefix} — last name`, "Part II — Household Composition", "text"),
    field(`household_member_${member}_first_name_middle_initial`, `${prefix} — first name & middle initial`, "Part II — Household Composition", "text"),
    field(`household_member_${member}_relationship`, `${prefix} — relationship to head`, "Part II — Household Composition", "text"),
    field(`household_member_${member}_date_of_birth`, `${prefix} — date of birth`, "Part II — Household Composition", "date"),
    field(`household_member_${member}_age`, `${prefix} — age`, "Part II — Household Composition", "number"),
    field(`household_member_${member}_full_time_student`, `${prefix} — full-time student`, "Part II — Household Composition", "yes_no"),
    field(`household_member_${member}_ssn_or_alien_registration`, `${prefix} — SSN / alien registration number`, "Part II — Household Composition", "text"),
  ];
}).flat();

const incomeMemberFields = Array.from({ length: 7 }, (_, index) => {
  const member = index + 1;
  const prefix = `Household member ${member}`;
  return [
    field(`income_member_${member}_wages_business`, `${prefix} — wages / salaries / tips / business income`, "Part III — Annual Income", "currency"),
    field(`income_member_${member}_social_security_pension`, `${prefix} — Social Security / SSI / pension / retirement`, "Part III — Annual Income", "currency"),
    field(`income_member_${member}_public_assistance`, `${prefix} — public assistance`, "Part III — Annual Income", "currency"),
    field(`income_member_${member}_other_income`, `${prefix} — other income`, "Part III — Annual Income", "currency"),
    field(`income_member_${member}_total_income`, `${prefix} — total annual income`, "Part III — Annual Income", "currency"),
  ];
}).flat();

const assetRowFields = Array.from({ length: 8 }, (_, index) => {
  const row = index + 1;
  return [
    field(`asset_${row}_household_member_number`, `Asset ${row} — household member #`, "Part IV — Income From Assets", "number"),
    field(`asset_${row}_type`, `Asset ${row} — type of asset`, "Part IV — Income From Assets", "text"),
    field(`asset_${row}_cash_value`, `Asset ${row} — cash value`, "Part IV — Income From Assets", "currency"),
    field(`asset_${row}_annual_income`, `Asset ${row} — annual income from asset`, "Part IV — Income From Assets", "currency"),
  ];
}).flat();

const signatureFields = Array.from({ length: 7 }, (_, index) => {
  const member = index + 1;
  return [
    field(`household_member_${member}_signature_present`, `Household member ${member} — signature present`, "Household Certification & Signatures", "yes_no"),
    field(`household_member_${member}_signature_date`, `Household member ${member} — signature date`, "Household Certification & Signatures", "date"),
  ];
}).flat();

/**
 * Comprehensive generic LIHTC Tenant Income Certification (TIC) intake schema.
 *
 * State HFAs may add or rename fields. Aliases below cover common generic/state
 * wording while the UI always shows the full registry so a reviewer can fill a
 * field that OCR did not recover. Jurisdiction-specific fields can be appended
 * without changing the confirmation contract.
 */
export const TIC_FIELD_DEFINITIONS: readonly TicFieldDefinition[] = [
  field("certification_type", "Certification type", "Certification", "text", ["initial certification", "recertification", "other certification", "certification type"]),
  field("other_certification_type", "Other certification type / explanation", "Certification", "text", ["other certification type", "other explanation"]),
  field("certification_effective_date", "Certification effective date", "Certification", "date", ["certification effective date", "effective date"]),
  field("move_in_date", "Move-in date", "Certification", "date", ["move-in date", "move in date"]),
  field("certification_ending_date", "Certification ending date", "Certification", "date", ["ending date", "certification ending date"]),
  field("transfer_from_unit_number", "Transfer from unit #", "Certification", "text", ["transfer from unit", "transferred from unit"]),

  field("property_name", "Property name", "Part I — Development Data", "text", ["property name", "development name", "project name"]),
  field("property_address", "Property / building address", "Part I — Development Data", "text", ["property address", "building address", "address"]),
  field("county", "County", "Part I — Development Data", "text", ["county"]),
  field("building_identification_number", "Building Identification Number (BIN)", "Part I — Development Data", "text", ["bin #", "bin number", "building identification number"]),
  field("unit_number", "Unit number", "Part I — Development Data", "text", ["unit #", "unit number"]),
  field("unit_bedrooms", "Number of bedrooms", "Part I — Development Data", "number", ["# bedrooms", "number of bedrooms", "bedrooms"]),
  field("tax_credit_number", "Tax credit #", "Part I — Development Data", "text", ["tax credit #", "tax credit number"]),
  field("home_number", "HOME #", "Part I — Development Data", "text", ["home #", "home number"]),
  field("other_program_project_number", "Other program / project #", "Part I — Development Data", "text", ["fdic #", "project #", "program #"]),

  field("household_size", "Total number of persons in household", "Part II — Household Composition", "number", ["total # of persons in household", "total number of persons in household", "household size"]),
  field("full_time_student_count", "Number of full-time students in household", "Part II — Household Composition", "number", ["# of full-time students in household", "number of full-time students in household"]),
  ...householdMemberFields,

  ...incomeMemberFields,
  field("household_annual_income", "Total annual household income from all sources", "Part III — Annual Income", "currency", ["total annual household income from all sources", "household annual income", "annual income", "total household income", "total annual income"]),

  ...assetRowFields,
  field("total_asset_cash_value", "Total cash value of assets", "Part IV — Income From Assets", "currency", ["total cash value of assets", "total cash value"]),
  field("total_asset_annual_income", "Total annual income from assets", "Part IV — Income From Assets", "currency", ["total annual income from assets", "total income from assets"]),
  field("household_net_assets", "Net family / household assets", "Part IV — Income From Assets", "currency", ["household net assets", "net family assets", "net assets"]),
  field("assets_disposed_less_than_fair_market_value", "Assets disposed of for less than fair market value in the prior 2 years", "Part IV — Income From Assets", "yes_no", ["assets disposed", "less than fair market value", "disposed of assets"]),
  field("assets_disposed_amount", "Amount / value of assets disposed of", "Part IV — Income From Assets", "currency", ["amount disposed", "value of assets disposed"]),
  field("imputed_asset_income", "Imputed income from assets", "Part IV — Income From Assets", "currency", ["imputed income from assets", "imputed asset income"]),
  field("hotma_asset_cap", "HOTMA asset cap", "Part IV — Income From Assets", "currency", ["hotma asset cap", "asset cap"]),
  field("hotma_asset_limit_exception", "HOTMA asset-limit exception / exclusion", "Part IV — Income From Assets", "text", ["asset limit exception", "asset exception", "asset exclusion"]),

  field("applicable_lihtc_income_limit", "Current / applicable income limit per family size", "Part V — Determination of Income Eligibility", "currency", ["current income limit per family size", "applicable lihtc income limit", "applicable income limit", "60% income limit", "50% income limit"]),
  field("current_income_limit_140_percent", "Current income limit × 140% (recertification)", "Part V — Determination of Income Eligibility", "currency", ["current income limit x 140%", "current income limit × 140%", "140% income limit"]),
  field("income_exceeds_140_percent", "Household income exceeds 140% at recertification", "Part V — Determination of Income Eligibility", "yes_no", ["household income exceeds 140%", "income exceeds 140%"]),
  field("household_income_at_move_in", "Household income at move-in", "Part V — Determination of Income Eligibility", "currency", ["household income at move-in", "household income at move in"]),
  field("household_size_at_move_in", "Household size at move-in", "Part V — Determination of Income Eligibility", "number", ["household size at move-in", "household size at move in"]),
  field("household_income_restriction_percent", "Household meets income restriction at (%)", "Part V — Determination of Income Eligibility", "number", ["household meets income restriction at", "income restriction at"]),
  field("lihtc_income_limit_basis_pct", "LIHTC income-limit basis / unit designation (%)", "Part V — Determination of Income Eligibility", "number", ["income limit basis", "unit income designation", "imputed income limitation"]),
  field("lihtc_minimum_set_aside_election", "LIHTC minimum set-aside election", "Part V — Determination of Income Eligibility", "text", ["minimum set-aside election", "minimum set aside election", "20-50", "40-60", "average income"]),

  field("tenant_paid_rent", "Tenant-paid rent", "Part VI — Rent", "currency", ["tenant paid rent", "tenant-paid rent"]),
  field("utility_allowance", "Utility allowance amount", "Part VI — Rent", "currency", ["utility allowance"]),
  field("utility_allowance_source", "Utility allowance source", "Part VI — Rent", "text", ["utility allowance source", "ua source"]),
  field("rent_assistance", "Rent assistance", "Part VI — Rent", "currency", ["rent assistance", "rental assistance"]),
  field("other_non_optional_charges", "Other non-optional charges", "Part VI — Rent", "currency", ["other non-optional charges", "other non optional charges"]),
  field("gross_rent", "Gross rent for unit", "Part VI — Rent", "currency", ["gross rent for unit", "gross rent"]),
  field("unit_rent_restriction_percent", "Unit meets rent restriction at (%)", "Part VI — Rent", "number", ["unit meets rent restriction at", "rent restriction at"]),
  field("state_max_gross_rent", "Maximum rent limit for this unit", "Part VI — Rent", "currency", ["maximum rent limit for this unit", "state maximum gross rent", "max gross rent", "state max gross rent"]),

  field("all_occupants_full_time_students", "Are all occupants full-time students?", "Part VII — Student Status", "yes_no", ["are all occupants full time students", "all occupants full-time students", "all occupants full time students"]),
  field("student_exception_code", "Student exception code / explanation", "Part VII — Student Status", "text", ["student explanation", "student exception", "student exemption"]),
  field("student_exception_tanf", "Student exception — TANF / AFDC assistance", "Part VII — Student Status", "yes_no", ["afdc", "tanf assistance"]),
  field("student_exception_job_training", "Student exception — qualifying job training program", "Part VII — Student Status", "yes_no", ["job training program"]),
  field("student_exception_single_parent", "Student exception — single parent with dependent child(ren)", "Part VII — Student Status", "yes_no", ["single parent", "dependent child"]),
  field("student_exception_married_joint_return", "Student exception — married and entitled to file joint return", "Part VII — Student Status", "yes_no", ["married", "joint return"]),
  field("student_exception_former_foster_care", "Student exception — formerly in foster care", "Part VII — Student Status", "yes_no", ["foster care"]),

  field("program_type_lihtc", "Program type — LIHTC", "Part VIII — Program / Assistance", "yes_no", ["lihtc", "low income housing tax credit"]),
  field("program_type_home", "Program type — HOME", "Part VIII — Program / Assistance", "yes_no", ["home program"]),
  field("program_type_tax_exempt_bond", "Program type — tax-exempt bond", "Part VIII — Program / Assistance", "yes_no", ["tax-exempt bond", "tax exempt bond"]),
  field("program_type_rural_development", "Program type — Rural Development", "Part VIII — Program / Assistance", "yes_no", ["rural development", "rd"]),
  field("program_type_hud", "Program type — HUD / project-based assistance", "Part VIII — Program / Assistance", "yes_no", ["hud", "project based"]),
  field("program_type_other", "Program type — other", "Part VIII — Program / Assistance", "text", ["other program"]),
  field("rental_assistance_type", "Rental assistance type", "Part VIII — Program / Assistance", "text", ["rental assistance type", "rent assistance type"]),

  ...signatureFields,
  field("tenant_signature_date", "Tenant / household certification signature date", "Household Certification & Signatures", "date", ["tenant signature date", "signature date", "signed on"]),
  field("owner_representative_name", "Owner / representative name", "Owner Certification", "text", ["owner representative", "owner/representative", "owner or representative"]),
  field("owner_representative_signature_present", "Owner / representative signature present", "Owner Certification", "yes_no", ["signature of owner", "owner signature"]),
  field("owner_representative_signature_date", "Owner / representative signature date", "Owner Certification", "date", ["owner signature date", "representative date"]),
] as const;

export const TIC_FIELD_KEYS = TIC_FIELD_DEFINITIONS.map((definition) => definition.key);
export const TIC_FIELD_KEY_SET = new Set(TIC_FIELD_KEYS);
export const TIC_FIELD_BY_KEY = new Map(TIC_FIELD_DEFINITIONS.map((definition) => [definition.key, definition]));
export const TIC_FIELD_SECTIONS = [...new Set(TIC_FIELD_DEFINITIONS.map((definition) => definition.section))];

export function ticFieldDefinition(key: string): TicFieldDefinition | undefined {
  return TIC_FIELD_BY_KEY.get(key);
}

export function ticFieldIsNumeric(key: string): boolean {
  const type = TIC_FIELD_BY_KEY.get(key)?.type;
  return type === "number" || type === "currency";
}
