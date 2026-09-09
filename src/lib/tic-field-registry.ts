import { TIC_SUPPLEMENTAL_FIELDS, TIC_SOURCE_PRESENCE_FIELDS } from "./tic-supplemental-fields";
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

export const TIC_HOUSEHOLD_ROW_COUNT = 10;
export const TIC_INCOME_ROW_COUNT = 10;
export const TIC_ASSET_ROW_COUNT = 27;
export const TIC_SIGNATURE_ROW_COUNT = 4;

const householdMemberFields = Array.from({ length: TIC_HOUSEHOLD_ROW_COUNT }, (_, index) => {
  const member = index + 1;
  const prefix = `Household member ${member}`;
  return [
    field(`household_member_${member}_last_name`, `${prefix} — last name`, "Part II — Household Composition", "text", [`household member ${member} last name`]),
    field(`household_member_${member}_first_name_middle_initial`, `${prefix} — first name & middle initial`, "Part II — Household Composition", "text", [`household member ${member} first name middle initial`]),
    field(`household_member_${member}_relationship`, `${prefix} — relationship to head`, "Part II — Household Composition", "text", [`household member ${member} relationship`]),
    field(`household_member_${member}_race`, `${prefix} — race`, "Part II — Household Composition", "text", [`household member ${member} race`]),
    field(`household_member_${member}_ethnicity`, `${prefix} — ethnicity`, "Part II — Household Composition", "text", [`household member ${member} ethnicity`]),
    field(`household_member_${member}_disability`, `${prefix} — disability status`, "Part II — Household Composition", "text", [`household member ${member} disability`]),
    field(`household_member_${member}_gender`, `${prefix} — gender`, "Part II — Household Composition", "text", [`household member ${member} gender`]),
    field(`household_member_${member}_date_of_birth`, `${prefix} — date of birth`, "Part II — Household Composition", "date", [`household member ${member} date of birth`]),
    field(`household_member_${member}_age`, `${prefix} — age`, "Part II — Household Composition", "number", [`household member ${member} age`]),
    field(`household_member_${member}_full_time_student`, `${prefix} — full-time student`, "Part II — Household Composition", "yes_no", [`household member ${member} full-time student`]),
    field(`household_member_${member}_ssn_or_alien_registration`, `${prefix} — SSN / alien registration number`, "Part II — Household Composition", "text", [`household member ${member} ssn alien registration`]),
  ];
}).flat();

const incomeMemberFields = Array.from({ length: TIC_INCOME_ROW_COUNT }, (_, index) => {
  const row = index + 1;
  const prefix = `Income row ${row}`;
  return [
    field(`income_member_${row}_household_member_number`, `${prefix} — HH Mbr #`, "Part III — Gross Annual Income", "number", [`income member ${row} household member number`]),
    field(`income_member_${row}_wages_business`, `${prefix} — employment or wages`, "Part III — Gross Annual Income", "currency", [`income member ${row} employment or wages`]),
    field(`income_member_${row}_social_security_pension`, `${prefix} — Social Security / pensions`, "Part III — Gross Annual Income", "currency", [`income member ${row} social security pensions`]),
    field(`income_member_${row}_public_assistance`, `${prefix} — public assistance`, "Part III — Gross Annual Income", "currency", [`income member ${row} public assistance`]),
    field(`income_member_${row}_other_income`, `${prefix} — other income`, "Part III — Gross Annual Income", "currency", [`income member ${row} other income`]),
    field(`income_member_${row}_total_income`, `${prefix} — total annual income`, "Part III — Gross Annual Income", "currency", [`income member ${row} total annual income`]),
  ];
}).flat();

const assetRowFields = Array.from({ length: TIC_ASSET_ROW_COUNT }, (_, index) => {
  const row = index + 1;
  return [
    field(`asset_${row}_household_member_number`, `Asset ${row} — household member #`, "Part IV — Income From Assets", "number", [`asset ${row} household member number`]),
    field(`asset_${row}_type`, `Asset ${row} — type of asset`, "Part IV — Income From Assets", "text", [`asset ${row} type`]),
    field(`asset_${row}_current_disposed`, `Asset ${row} — current / disposed`, "Part IV — Income From Assets", "text", [`asset ${row} current disposed`]),
    field(`asset_${row}_category`, `Asset ${row} — NNPP / Real / Tax Relief`, "Part IV — Income From Assets", "text", [`asset ${row} category`]),
    field(`asset_${row}_cash_value`, `Asset ${row} — cash value`, "Part IV — Income From Assets", "currency", [`asset ${row} cash value`]),
    field(`asset_${row}_income_method`, `Asset ${row} — actual / imputed`, "Part IV — Income From Assets", "text", [`asset ${row} income method`]),
    field(`asset_${row}_annual_income`, `Asset ${row} — annual income from asset`, "Part IV — Income From Assets", "currency", [`asset ${row} annual income`]),
  ];
}).flat();

const signatureFields = Array.from({ length: TIC_SIGNATURE_ROW_COUNT }, (_, index) => {
  const member = index + 1;
  return [
    field(`household_member_${member}_signature_present`, `Household member ${member} — signature present`, "Household Certification & Signatures", "yes_no", [`household member ${member} signature present`]),
    field(`household_member_${member}_signature_date`, `Household member ${member} — signature date`, "Household Certification & Signatures", "date", [`household member ${member} signature date`]),
  ];
}).flat();

/** Comprehensive LIHTC Tenant Income Certification intake schema. */
export const TIC_FIELD_DEFINITIONS: readonly TicFieldDefinition[] = [
  ...TIC_SUPPLEMENTAL_FIELDS,
  ...TIC_SOURCE_PRESENCE_FIELDS,
  field("certification_type", "Certification type", "Certification", "text", ["certification type", "initial certification", "recertification", "other certification"]),
  field("other_certification_type", "Other certification type / explanation", "Certification", "text", ["other certification type", "other explanation"]),
  field("certification_effective_date", "Effective Date", "Certification", "date", ["certification effective date", "effective date"]),
  field("move_in_date", "Move-in Date", "Certification", "date", ["move-in date", "move in date"]),
  field("current_date", "Current Date", "Certification", "date", ["current date"]),
  field("certification_ending_date", "Certification ending date", "Certification", "date", ["ending date", "certification ending date"]),
  field("transfer_from_unit_number", "Transfer from unit #", "Certification", "text", ["transfer from unit", "transferred from unit"]),

  field("property_name", "Property Name", "Part I — Development Data", "text", ["property name", "development name", "project name"]),
  field("property_address", "Address", "Part I — Development Data", "text", ["property address", "building address", "address"]),
  field("county", "County", "Part I — Development Data", "text", ["county"]),
  field("building_identification_number", "BIN#", "Part I — Development Data", "text", ["bin #", "bin#", "bin number", "building identification number"]),
  field("unit_number", "Unit Number", "Part I — Development Data", "text", ["unit #", "unit number"]),
  field("unit_bedrooms", "# Bedrooms", "Part I — Development Data", "number", ["# bedrooms", "number of bedrooms", "bedrooms"]),
  field("tax_credit_number", "TC#", "Part I — Development Data", "text", ["tc#", "tc #", "tax credit #", "tax credit number"]),
  field("home_number", "HOME #", "Part I — Development Data", "text", ["home #", "home number"]),
  field("other_program_project_number", "Other program / project #", "Part I — Development Data", "text", ["fdic #", "project #", "program #"]),

  field("household_size", "Total number of persons in household", "Part II — Household Composition", "number", ["total # of persons in household", "total number of persons in household", "household size"]),
  field("full_time_student_count", "Number of full-time students in household", "Part II — Household Composition", "number", ["# of full-time students in household", "number of full-time students in household"]),
  ...householdMemberFields,

  ...incomeMemberFields,
  field("total_employment_income", "Total Employment / Wages", "Part III — Gross Annual Income", "currency", ["total employment"]),
  field("total_social_security_pensions", "Total Social Security / Pensions", "Part III — Gross Annual Income", "currency", ["total ss/pensions"]),
  field("total_public_assistance", "Total Public Assistance", "Part III — Gross Annual Income", "currency", ["total public assistance"]),
  field("total_other_income", "Total Other Income", "Part III — Gross Annual Income", "currency", ["total other income"]),
  field("total_income_e", "TOTAL INCOME (E)", "Part III — Gross Annual Income", "currency", ["total income (e)", "total income e"]),
  field("household_annual_income", "Total Annual Household Income from all Sources", "Part V — Total Household Income", "currency", ["total annual household income from all sources", "household annual income", "total household income"]),

  field("asset_actual_income_below_iit", "Actual income earned from all assets (F)", "Part IV — Income From Assets", "currency", ["actual income earned from all assets", "actual income from all assets"]),
  ...assetRowFields,
  field("total_nnpp", "TOTAL of NNPP", "Part IV — Income From Assets", "currency", ["total of nnpp", "total nnpp", "net family assets"]),
  field("total_income_assets_m", "TOTAL INCOME FROM ASSETS (M)", "Part IV — Income From Assets", "currency", ["total income from assets (m)", "total income from assets"]),
  field("total_asset_cash_value", "Total cash value of assets", "Part IV — Income From Assets", "currency", ["total cash value of assets", "total cash value"]),
  field("total_asset_annual_income", "Total annual income from assets", "Part IV — Income From Assets", "currency", ["total annual income from assets"]),
  field("household_net_assets", "Net family / household assets", "Part IV — Income From Assets", "currency", ["household net assets", "net family assets", "net assets"]),
  field("assets_disposed_less_than_fair_market_value", "Assets disposed of for less than fair market value in the prior 2 years", "Part IV — Income From Assets", "yes_no", ["assets disposed", "less than fair market value", "disposed of assets"]),
  field("assets_disposed_amount", "Amount / value of assets disposed of", "Part IV — Income From Assets", "currency", ["amount disposed", "value of assets disposed"]),
  field("imputed_asset_income", "Imputed income from assets", "Part IV — Income From Assets", "currency", ["imputed income from assets", "imputed asset income"]),
  field("hotma_asset_cap", "HOTMA asset cap", "Part IV — Income From Assets", "currency", ["hotma asset cap", "asset cap"]),
  field("hotma_asset_limit_exception", "HOTMA asset-limit exception / exclusion", "Part IV — Income From Assets", "text", ["asset limit exception", "asset exception", "asset exclusion"]),

  field("applicable_lihtc_income_limit", "Current Income Limit per Family Size", "Part VI — Determination of Income Eligibility", "currency", ["current income limit per family size", "applicable lihtc income limit", "applicable income limit"]),
  field("current_income_limit_140_percent", "Current Income Limit × 140%", "Part VI — Determination of Income Eligibility", "currency", ["current income limit x 140%", "current income limit × 140%", "140% income limit"]),
  field("income_exceeds_140_percent", "Household Income exceeds 140% at recertification", "Part VI — Determination of Income Eligibility", "yes_no", ["household income exceeds 140%", "income exceeds 140%"]),
  field("household_income_at_move_in", "Household Income at Move-in", "Part VI — Determination of Income Eligibility", "currency", ["household income at move-in", "household income at move in"]),
  field("household_size_at_move_in", "Household Size at Move-in", "Part VI — Determination of Income Eligibility", "number", ["household size at move-in", "household size at move in"]),
  field("household_income_restriction_percent", "Household Meets Income Restriction at (%)", "Part VI — Determination of Income Eligibility", "number", ["household meets current income restriction at", "household meets income restriction at", "income restriction at"]),
  field("lihtc_income_limit_basis_pct", "LIHTC income-limit basis / unit designation (%)", "Part VI — Determination of Income Eligibility", "number", ["income limit basis", "unit income designation", "imputed income limitation"]),
  field("lihtc_minimum_set_aside_election", "LIHTC minimum set-aside election", "Part VI — Determination of Income Eligibility", "text", ["minimum set-aside election", "minimum set aside election", "20-50", "40-60", "average income"]),

  field("tenant_paid_rent", "Tenant Paid Rent", "Part VII — Rent", "currency", ["tenant paid rent", "tenant-paid rent"]),
  field("utility_allowance", "Utility Allowance", "Part VII — Rent", "currency", ["utility allowance"]),
  field("utility_allowance_source", "Utility Allowance Source", "Part VII — Rent", "text", ["utility allowance source", "ua source"]),
  field("rent_assistance", "Rent Assistance", "Part VII — Rent", "currency", ["rent assistance", "rental assistance amount", "rental assistance:"]),
  field("other_non_optional_charges", "Other non-optional charges", "Part VII — Rent", "currency", ["other non-optional charges", "other non optional charges"]),
  field("gross_rent", "GROSS RENT FOR UNIT", "Part VII — Rent", "currency", ["gross rent for unit", "gross rent"]),
  field("unit_rent_restriction_percent", "Unit Meets Rent Restriction at (%)", "Part VII — Rent", "number", ["unit meets rent restriction at", "rent restriction at"]),
  field("state_max_gross_rent", "Maximum Rent Limit for this unit", "Part VII — Rent", "currency", ["maximum rent limit for this unit", "state maximum gross rent", "max gross rent"]),
  field("rental_assistance_type", "Rental Assistance Type", "Part VII — Rent", "text", ["rental assistance type", "rent assistance type"]),

  field("all_occupants_full_time_students", "Are all occupants full-time students?", "Part VIII — Student Status", "yes_no", ["are all occupants full-time students", "are all occupants full time students", "all occupants full-time students"]),
  field("student_exception_code", "Student Explanation / Exception", "Part VIII — Student Status", "text", ["student explanation", "student exception", "student exemption"]),
  field("student_exception_tanf", "Student exception — TANF / AFDC assistance", "Part VIII — Student Status", "yes_no", ["afdc", "tanf assistance"]),
  field("student_exception_job_training", "Student exception — qualifying job training program", "Part VIII — Student Status", "yes_no", ["job training program"]),
  field("student_exception_single_parent", "Student exception — single parent with dependent child(ren)", "Part VIII — Student Status", "yes_no", ["single parent", "dependent child"]),
  field("student_exception_married_joint_return", "Student exception — married and entitled to file joint return", "Part VIII — Student Status", "yes_no", ["married", "joint return"]),
  field("student_exception_former_foster_care", "Student exception — formerly in foster care", "Part VIII — Student Status", "yes_no", ["foster care"]),

  field("program_type_lihtc", "Program type — Tax Credit", "Part IX — Program Type", "yes_no", ["program type tax credit", "tax credit", "lihtc", "low income housing tax credit"]),
  field("program_type_home", "Program type — HOME", "Part IX — Program Type", "yes_no", ["program type home", "home program"]),
  field("program_type_tax_exempt_bond", "Program type — Tax Exempt", "Part IX — Program Type", "yes_no", ["program type tax exempt", "tax exempt", "tax-exempt bond", "tax exempt bond"]),
  field("program_type_pennhomes", "Program type — PennHOMES", "Part IX — Program Type", "yes_no", ["program type pennhomes", "pennhomes"]),
  field("program_type_pennhomes_home", "Program type — PennHOMES/HOME", "Part IX — Program Type", "yes_no", ["program type pennhomes home", "pennhomes/home"]),
  field("program_type_rural_development", "Program type — Rural Development", "Part IX — Program Type", "yes_no", ["program type rural development", "rural development", "rd"]),
  field("program_type_hud", "Program type — HUD / project-based assistance", "Part IX — Program Type", "yes_no", ["program type hud", "hud", "project based"]),
  field("program_type_other", "Program type — other", "Part IX — Program Type", "text", ["other program"]),
  field("program_lihtc_income_status", "Tax Credit income status", "Part IX — Program Type", "text", ["tax credit income status"]),
  field("program_home_income_status", "HOME income status", "Part IX — Program Type", "text", ["home income status"]),
  field("program_tax_exempt_income_status", "Tax Exempt income status", "Part IX — Program Type", "text", ["tax exempt income status"]),
  field("program_pennhomes_income_status", "PennHOMES income status", "Part IX — Program Type", "text", ["pennhomes income status"]),
  field("program_pennhomes_home_income_status", "PennHOMES/HOME income status", "Part IX — Program Type", "text", ["pennhomes home income status"]),

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

