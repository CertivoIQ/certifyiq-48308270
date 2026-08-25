declare module "@/lib/pha-hotma-implementation-engine.mjs" {
  export type PhaHotmaCohort =
    | "NON_MTW_NON_FRS"
    | "INITIAL_MTW"
    | "MTW_EXPANSION"
    | "FRS_EXCLUSIVE";

  export type PhaHotmaProgram =
    | "HCV_TENANT_BASED"
    | "HUD_PBV"
    | "MOD_REHAB"
    | "MOD_REHAB_SRO"
    | "PUBLIC_HOUSING";

  export type PhaHotmaReportingPath =
    | "HUD_50058_2024"
    | "HUD_50058_2020_ALTERNATIVE";

  export type PhaHotmaFindingClassification =
    | "NOT_APPLICABLE"
    | "PRE_IMPLEMENTATION_OBSERVATION"
    | "COMPLIANCE_FINDING"
    | "UNABLE_TO_DETERMINE";

  export interface PhaHotmaImplementationInput {
    module_id?: string;
    program?: PhaHotmaProgram | string;
    program_applicability_validated?: boolean;
    pha_cohort?: PhaHotmaCohort | string;
    transaction_effective_date?: string;
    controlled_source_release_approved?: boolean;
    current_rule_version_validated?: boolean;
    source_status_conflict?: boolean;
    hud_50058_reporting_path?: PhaHotmaReportingPath | string;
    full_hotma_policy_set_validated?: boolean;
    reporting_path_validated?: boolean;
    software_compatibility_validated?: boolean;
    alternative_50058_instructions_validated?: boolean;
    alternative_hotma_indicator_validated?: boolean;
    eid_enrollment_status_validated?: boolean;
    hud_9886_a_version_validated?: boolean;
    july_2025_provisions_validated?: boolean;
  }

  export interface PhaHotmaClassification {
    resolution_status: string;
    determination_status: string;
    rule_engine_authority: "ALLOWED" | "BLOCKED" | "NOT_APPLICABLE";
    finding: "READY" | "UNABLE_TO_DETERMINE" | "NOT_APPLICABLE";
    finding_classification: PhaHotmaFindingClassification;
    reason_code?: string;
    reason?: string;
    missing_inputs?: string[];
    module_id?: string;
    module_name?: string;
    program?: string;
    pha_cohort?: string;
    human_approval_required: true;
    engine_build: string;
  }

  export interface PhaHotmaAllModuleResult {
    engine_build: string;
    rule_pack_id: string;
    activation_status: string;
    full_compliance_date: string;
    module_count: number;
    classifications: PhaHotmaClassification[];
    human_approval_required: true;
  }

  export const PHA_HOTMA_ENGINE_BUILD: string;
  export const PHA_HOTMA_FULL_COMPLIANCE_DATE: string;
  export const PHA_HOTMA_FINDING_CLASSIFICATION: Readonly<
    Record<string, PhaHotmaFindingClassification>
  >;
  export const PHA_HOTMA_COHORTS: readonly PhaHotmaCohort[];
  export const PHA_HOTMA_PROGRAMS: readonly PhaHotmaProgram[];
  export const PHA_HOTMA_REPORTING_PATHS: readonly PhaHotmaReportingPath[];

  export function classifyPhaHotmaImplementation(
    input?: PhaHotmaImplementationInput,
  ): PhaHotmaClassification;
  export function classifyAllPhaHotmaImplementationModules(
    input?: Omit<PhaHotmaImplementationInput, "module_id">,
  ): PhaHotmaAllModuleResult;
}
