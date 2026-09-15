declare module "@/lib/rent-income-limit-engine.mjs" {
  export const RENT_INCOME_LIMIT_ENGINE_VERSION: string;
  export const LIMIT_PROGRAMS: readonly ["LIHTC_SECTION42", "BOND_SECTION142", "OTHER_PROGRAM"];
  export const HUD_LIMIT_BASES: readonly ["AMI_MEDIAN", "MTSP", "VLI_50", "LOW_80", "ELI_30"];
  export const SET_ASIDES: readonly ["20_50", "40_60", "AVERAGE_INCOME", "NOT_ELECTED"];
  export const SIZE_METHODS: readonly ["ONE_POINT_FIVE", "PLUS_ONE", "CUSTOM"];
  export const STANDARD_AMI_LEVELS: readonly number[];
  export const HOUSEHOLD_SIZES: readonly number[];
  export const BEDROOM_SIZES: readonly number[];
  export const HISTORICAL_YEARS_REQUIRED: number;
  export const SOURCE_FAMILIES: readonly ["MTSP", "HOME", "HTF", "SECTION8", "USDA_RD", "STATE_LOCAL_MANUAL"];
  export const CONTROLLED_DATASET_FAMILIES: Readonly<Record<string, string>>;
  export const PROGRAM_ALLOWED_FAMILIES: Readonly<Record<string, readonly string[]>>;
  export type SourceFamily = (typeof SOURCE_FAMILIES)[number];
  export function requiredSizeMethod(program: string): "ONE_POINT_FIVE" | null;
  export function controlledDatasetFamily(datasetId: string): string | null;
  export function allowedSourceFamilies(config?: Partial<LimitConfig>): string[];
  export function rentMethodIssues(config?: Partial<LimitConfig>): string[];
  export function rentFloorIssues(config?: Partial<LimitConfig>): string[];

  export type LimitProgram = (typeof LIMIT_PROGRAMS)[number];
  export type HudLimitBasis = (typeof HUD_LIMIT_BASES)[number];
  export type SetAside = (typeof SET_ASIDES)[number];
  export type SizeMethod = (typeof SIZE_METHODS)[number];

  export type ManualSource = {
    kind: "MANUAL";
    program?: LimitProgram;
    authority: string;
    sourceReference: string;
    effectiveFrom: string;
    effectiveTo: string;
    geography: string;
    designation: string;
    basePercent: string | number;
    datasetVersion?: string;
    limits: Record<string, string>;
    reviewConfirmed: boolean;
    reviewerName: string;
    reviewedProgram?: LimitProgram;
  };

  export type RentMethod = { methodReference: string; sourceReference: string; reviewerName: string; reviewConfirmed: boolean };
  export type RentFloorEvidence = { effectiveDate: string; sourceReference: string; reviewerName: string; reviewConfirmed: boolean };

  export type ControlledSource = { kind: "CONTROLLED"; program?: LimitProgram; datasetId: string };

  export type LimitConfig = {
    program: LimitProgram;
    limitYear: string;
    stateCode: string;
    areaId: string;
    msa?: string;
    placedInServiceDate?: string;
    setAside?: SetAside;
    amiLevels?: number[];
    customLevels?: number[];
    householdSizes?: number[];
    bedroomSizes?: number[];
    sizeMethod: SizeMethod;
    customSizes?: Record<string, string>;
    utilityAllowances?: Record<string, string>;
    grossRentFloor?: Record<string, string>;
    showGrossRent?: boolean;
    showTenantPaid?: boolean;
    showFmr?: boolean;
    showOneForty?: boolean;
    showHistorical?: boolean;
    hudBasis?: HudLimitBasis | "";
    sourceFamily?: SourceFamily | "";
    rentMethod?: RentMethod;
    rentFloorEvidence?: RentFloorEvidence;
    historicalIncomeLevels?: number[];
    historicalRentLevels?: number[];
    ruralRule?: boolean;
    source?: ControlledSource | ManualSource | Record<string, unknown>;
    catalog?: { version?: string; official_sources?: Record<string, unknown>[] };
    historicalRecords?: { year: number; verified: boolean }[];
    fmrRecords?: { bedrooms: number; amount: string; verified: boolean }[];
  };

  export type Provenance = {
    kind: string | null;
    authority: string | null;
    datasetId: string | null;
    version: string | null;
    sourceReference: string | null;
    sha256: string | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    geography: string | null;
    verification: string;
    activationStatus: string;
  };

  export type LimitRow = { level: number; label?: string; byHouseholdSize: { size: number; amount: string | null }[] };
  export type RentRow = {
    level: number;
    byBedroom: {
      bedrooms: number;
      householdSize: number | null;
      grossRent: string | null;
      utilityAllowance: string | null;
      tenantPaid: string | null;
      projectFloor: string | null;
      floorApplied: boolean;
      floorTreatment: string;
      applicableRent: string | null;
      issue: string | null;
    }[];
  };

  export type LimitResult = {
    engineVersion: string;
    status: "DETERMINED" | "PARTIAL" | "NOT_DETERMINED";
    blockers: string[];
    area: Record<string, unknown>;
    provenance: Provenance;
    referenceLimits: LimitRow[];
    incomeLimits: LimitRow[];
    rentLimits: RentRow[];
    oneForty: { basisLevel: number | null; notDetermined: boolean; reason: string | null; byHouseholdSize: { size: number; amount: string | null }[] };
    fmr: { available: boolean; reason: string | null; records: { bedrooms: number; amount: string }[] };
    historical: { available: boolean; years: number; incomeLevels: number[]; rentLevels: number[]; reason: string | null };
    rentAuthority: { determined: boolean; issues: string[]; reason: string | null; methodReference: string | null; sourceReference: string | null; reviewerName: string | null };
    floorTreatment: { entered: boolean; applied: boolean; status: string; issues: string[]; effectiveDate: string | null; sourceReference: string | null; reviewerName: string | null };
  };

  export type LimitProfileDraft = {
    signed: false;
    approved: false;
    program: string;
    agency: string;
    designation: string;
    geography: string;
    limitSource: string;
    limitFrom: string;
    limitTo: string;
    limits: Record<string, string>;
    engineVersion: string;
  };

  export function assumedHouseholdSize(bedrooms: number, method: SizeMethod, customSizes?: Record<string, string>): number | null;
  export function manualSourceIssues(manual?: Partial<ManualSource>): string[];
  export function resolveLimitSource(config?: Partial<LimitConfig>): {
    status: "RESOLVED" | "NOT_DETERMINED";
    blockers: string[];
    provenance: Provenance | null;
    limits?: Record<string, string>;
    basePercent?: number | null;
  };
  export function oneFortyBasis(config?: Partial<LimitConfig>): { level: number | null; notDetermined: boolean; reason: string | null };
  export function historicalAvailability(config?: Partial<LimitConfig>): { available: boolean; years: number; incomeLevels: number[]; rentLevels: number[]; reason: string | null };
  export function fmrAvailability(config?: Partial<LimitConfig>): { available: boolean; reason: string | null; records: { bedrooms: number; amount: string }[] };
  export function calculateRentIncomeLimits(config?: Partial<LimitConfig>): LimitResult;
  export function buildUnsignedLimitProfileDraft(
    config?: Partial<LimitConfig>,
    result?: LimitResult,
    level?: number | null,
  ): { ok: boolean; issues: string[]; draft: LimitProfileDraft | null };

}