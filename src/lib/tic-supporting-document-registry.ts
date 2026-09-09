export type SupportingDocumentType =
  | "income_calculation_worksheet"
  | "vawa_notice"
  | "vawa_certification"
  | "vawa_emergency_transfer_plan"
  | "vawa_emergency_transfer_request"
  | "employment_verification"
  | "rental_application"
  | "annual_student_certification"
  | "voluntary_race_ethnicity_disability"
  | "zero_income_certification"
  | "disposal_of_assets_certification"
  | "dependent_children_certification"
  | "no_child_support_certification"
  | "self_certification"
  | "affidavit"
  | "bank_statement"
  | "check_stub"
  | "other_income"
  | "other_supporting_document";

export type SupportingDocumentDefinition = {
  type: SupportingDocumentType;
  label: string;
  aliases: readonly string[];
  strongSignals: readonly RegExp[];
  weakSignals?: readonly RegExp[];
};

export const SUPPORTING_DOCUMENT_DEFINITIONS: readonly SupportingDocumentDefinition[] = [
  {type: "income_calculation_worksheet", label: "Annual Income Calculation Worksheet", aliases: ["Annual Income Calculation Worksheet"], strongSignals: [/annual\s+income\s+calculation\s+worksheet/i]},
  {type: "vawa_notice", label: "VAWA — Notice of Occupancy Rights (HUD-5380)", aliases: ["VAWA Notice", "HUD-5380"], strongSignals: [/hud[-\s]*5380\b/i, /notice\s+of\s+occupancy\s+rights.*violence\s+against\s+women/is]},
  {type: "vawa_certification", label: "VAWA — Certification (HUD-5382)", aliases: ["VAWA Certification", "HUD-5382"], strongSignals: [/hud[-\s]*5382\b/i, /certification\s+of\s+domestic\s+violence/i]},
  {type: "vawa_emergency_transfer_plan", label: "VAWA — Emergency Transfer Plan (HUD-5381)", aliases: ["VAWA Emergency Transfer Plan", "HUD-5381"], strongSignals: [/hud[-\s]*5381\b/i, /emergency\s+transfer\s+plan.*victims/is]},
  {type: "vawa_emergency_transfer_request", label: "VAWA — Emergency Transfer Request (HUD-5383)", aliases: ["VAWA Emergency Transfer Request", "HUD-5383"], strongSignals: [/hud[-\s]*5383\b/i, /emergency\s+transfer\s+request.*victims/is]},
  {type: "employment_verification", label: "Employment Verification", aliases: ["Employment Verification", "Verification of Employment"], strongSignals: [/employment\s+verification/i, /verification\s+of\s+employment/i]},
  {type: "rental_application", label: "Rental Application", aliases: ["Rental Application", "Application for Rental"], strongSignals: [/rental\s+application/i, /application\s+for\s+rental/i]},
  {
    type: "annual_student_certification",
    label: "Annual Student Certification",
    aliases: ["Annual Student Certification", "Student Certification", "Student Status Certification"],
    strongSignals: [
      /annual\s+student\s+certification/i,
      /student\s+status\s+certification/i,
      /full[-\s]?time\s+student.*certification/i,
    ],
    weakSignals: [/student\s+status/i, /full[-\s]?time\s+student/i],
  },
  {
    type: "voluntary_race_ethnicity_disability",
    label: "Voluntary Race, Ethnicity & Disability Form",
    aliases: [
      "Voluntary Race, Ethnicity & Disability Form",
      "Race and Ethnicity Form",
      "Race/Ethnicity/Disability Form",
      "HUD 27061-H",
    ],
    strongSignals: [
      /voluntary.*race.*ethnicity/i,
      /race.*ethnicity.*disability/i,
      /hud[-\s]?27061[-\s]?h/i,
    ],
    weakSignals: [/ethnicity/i, /disability/i, /race/i],
  },
  {
    type: "zero_income_certification",
    label: "Certification of Zero Income",
    aliases: ["Certification of Zero Income", "Zero Income Certification", "Zero Income Affidavit"],
    strongSignals: [
      /certification\s+of\s+zero\s+income/i,
      /zero\s+income\s+certification/i,
      /zero\s+income\s+affidavit/i,
      /no\s+income\s+certification/i,
    ],
    weakSignals: [/zero\s+income/i, /no\s+income/i],
  },
  {
    type: "disposal_of_assets_certification",
    label: "Disposal of Assets Certification",
    aliases: ["Disposal of Assets Certification", "Assets Disposed of for Less Than Fair Market Value"],
    strongSignals: [
      /disposal\s+of\s+assets/i,
      /assets?\s+disposed.*less\s+than\s+fair\s+market\s+value/i,
      /disposed\s+of\s+for\s+less\s+than\s+fair\s+market\s+value/i,
    ],
    weakSignals: [/fair\s+market\s+value/i, /disposed\s+asset/i],
  },
  {
    type: "dependent_children_certification",
    label: "Certification of Dependent Children",
    aliases: ["Certification of Dependent Children", "Dependent Child Certification", "Dependent Children Affidavit"],
    strongSignals: [
      /certification\s+of\s+dependent\s+children/i,
      /dependent\s+child(?:ren)?\s+certification/i,
      /dependent\s+child(?:ren)?\s+affidavit/i,
    ],
    weakSignals: [/dependent\s+child/i],
  },
  {
    type: "no_child_support_certification",
    label: "Certification of No Child Support",
    aliases: ["Certification of No Child Support", "No Child Support Affidavit", "Child Support Certification"],
    strongSignals: [
      /certification\s+of\s+no\s+child\s+support/i,
      /no\s+child\s+support\s+affidavit/i,
      /not\s+receiv(?:e|ing).*child\s+support/i,
    ],
    weakSignals: [/child\s+support/i, /spousal\s+support/i],
  },
  {
    type: "self_certification",
    label: "Self-Certification Form",
    aliases: ["Self-Certification", "Self Certification", "Tenant Self-Certification"],
    strongSignals: [
      /self[-\s]?certification/i,
      /tenant\s+self[-\s]?certification/i,
    ],
    weakSignals: [/certify\s+that/i],
  },
  {
    type: "affidavit",
    label: "Affidavit / Sworn Statement",
    aliases: ["Affidavit", "Sworn Statement"],
    strongSignals: [
      /^\s*affidavit\b/im,
      /sworn\s+statement/i,
      /being\s+duly\s+sworn/i,
      /notary\s+public/i,
    ],
    weakSignals: [/under\s+penalty\s+of\s+perjury/i],
  },
  {
    type: "bank_statement",
    label: "Bank Statement",
    aliases: ["Bank Statement", "Account Statement"],
    strongSignals: [/bank\s+statement/i, /account\s+statement/i, /beginning\s+balance.*ending\s+balance/is],
    weakSignals: [/statement\s+(?:period|date)/i, /interest\s+(?:earned|paid)/i, /account\s+(?:number|ending)/i],
  },
  {
    type: "check_stub",
    label: "Pay Stub / Check Stub",
    aliases: ["Pay Stub", "Check Stub", "Earnings Statement", "Payroll Statement"],
    strongSignals: [
      /pay\s+stub/i,
      /check\s+stub/i,
      /earnings\s+statement/i,
      /payroll\s+statement/i,
      /gross\s+pay.*net\s+pay/i,
      /pay\s+period.*gross/i,
    ],
    weakSignals: [/ytd\s+gross/i, /net\s+pay/i, /hours\s+worked/i],
  },
  {
    type: "other_income", label: "Other Income",
    aliases: ["Other Income", "Benefit Award Letter", "Pension Statement", "Social Security Benefits", "Unemployment Benefits", "Child Support Income", "Self-Employment Income"],
    strongSignals: [/benefit\s+(?:award|verification)\s+letter/i, /pension\s+statement/i, /social\s+security\s+benefit/i, /unemployment\s+(?:benefit|compensation)/i, /self[-\s]?employment\s+income/i],
  },
  {
    type: "other_supporting_document",
    label: "Other Supporting Document",
    aliases: ["Other Supporting Document"],
    strongSignals: [],
  },
] as const;

export const SUPPORTING_DOCUMENT_TYPE_SET = new Set(
  SUPPORTING_DOCUMENT_DEFINITIONS.map((definition) => definition.type),
);

export const SUPPORTING_DOCUMENT_BY_TYPE = new Map(
  SUPPORTING_DOCUMENT_DEFINITIONS.map((definition) => [definition.type, definition]),
);

export function supportingDocumentLabel(type: string): string {
  return SUPPORTING_DOCUMENT_BY_TYPE.get(type as SupportingDocumentType)?.label ?? "Other Supporting Document";
}

export const TIC_PAGE_SIGNALS = [
  /tenant\s+income\s+certification/i,
  /part\s+i.*development\s+data/i,
  /part\s+ii.*household/i,
  /part\s+iii.*annual\s+income/i,
  /part\s+iv.*assets/i,
  /determination\s+of\s+income\s+eligibility/i,
  /gross\s+rent\s+for\s+unit/i,
] as const;

