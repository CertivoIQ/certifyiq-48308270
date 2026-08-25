declare module "@/lib/mfh-hotma-rule-engine.mjs" {
  export type MfhHotmaProgramSubtype =
    | "SECTION_8_PBRA"
    | "SECTION_202_8"
    | "SECTION_202_162_PAC"
    | "SECTION_202_811_PRAC"
    | "SECTION_236_IRP"
    | "SECTION_811_PRA"
    | "SPRAC";

  export type MfhHotmaFindingClassification =
    | "NOT_APPLICABLE"
    | "PRE_IMPLEMENTATION_OBSERVATION"
    | "COMPLIANCE_FINDING"
    | "UNABLE_TO_DETERMINE";

  export interface MfhHotmaRuleModule {
    module_id: string;
    attachment: string;
    name: string;
    hotma_sections: readonly string[];
    applies_to: readonly MfhHotmaProgramSubtype[];
    authority_class: string;
    citations: readonly string[];
    requirement: string;
    evidence_fields: readonly string[];
    policy_evidence_fields: readonly string[];
    source_ids: readonly string[];
    classification_controls: {
      required_input_flags: readonly string[];
    };
  }

  export interface MfhHotmaReviewInput {
    module_id?: string;
    mfh_program_subtype?: MfhHotmaProgramSubtype | string;
    program_applicability_validated?: boolean;
    certification_effective_date?: string;
    controlled_source_release_approved?: boolean;
    current_rule_version_validated?: boolean;
    source_status_conflict?: boolean;
    property_hotma_implementation_date?: string;
    inflation_adjustment_release_validated?: boolean;
    tracs_and_form_version_validated?: boolean;
    policy_evidence?: Record<string, unknown>;
  }

  export interface MfhHotmaClassification {
    resolution_status: string;
    determination_status: string;
    rule_engine_authority: "ALLOWED" | "BLOCKED" | "NOT_APPLICABLE";
    finding: "READY" | "UNABLE_TO_DETERMINE" | "NOT_APPLICABLE";
    finding_classification: MfhHotmaFindingClassification;
    reason_code?: string;
    reason?: string;
    missing_inputs?: string[];
    module_id?: string;
    attachment?: string;
    module_name?: string;
    mfh_program_subtype?: string;
    human_approval_required: true;
    engine_build: string;
  }

  export interface MfhHotmaAllModuleResult {
    engine_build: string;
    rule_pack_id: string;
    activation_status: string;
    final_rule_effective_date: string;
    mandatory_compliance_date: string;
    module_count: number;
    classifications: MfhHotmaClassification[];
    human_approval_required: true;
  }

  export const MFH_HOTMA_ENGINE_BUILD: string;
  export const MFH_HOTMA_FINAL_RULE_EFFECTIVE_DATE: string;
  export const MFH_HOTMA_MANDATORY_COMPLIANCE_DATE: string;
  export const MFH_HOTMA_FINDING_CLASSIFICATION: Readonly<
    Record<string, MfhHotmaFindingClassification>
  >;
  export const MFH_HOTMA_PROGRAM_SUBTYPES: readonly MfhHotmaProgramSubtype[];
  export const MFH_HOTMA_RULE_MODULES: readonly MfhHotmaRuleModule[];

  export function classifyMfhHotmaReview(
    input?: MfhHotmaReviewInput,
  ): MfhHotmaClassification;
  export function classifyAllMfhHotmaModules(
    input?: Omit<MfhHotmaReviewInput, "module_id">,
  ): MfhHotmaAllModuleResult;
}
