declare module "@/lib/hotma-applicability-gate.mjs" {
  export const HOTMA_APPLICABILITY_GATE_BUILD: string;
  export const HOTMA_APPLICABILITY_RULE_ID: string;
  export const HOTMA_APPLICABILITY_STATUS: {
    applicable: "APPLICABLE";
    notApplicable: "NOT_APPLICABLE";
    unableToDetermine: "UNABLE_TO_DETERMINE";
  };
  export const HOTMA_PHA_PROGRAMS: readonly string[];
  export const HOTMA_MFH_PROGRAM: "HUD_MFH_PROJECT_BASED";
  export const HOTMA_MFH_PROGRAM_SUBTYPES: readonly string[];

  export interface HotmaProgramAuthorityRecord {
    program_code: string;
    authority_document_id: string;
    authority_document_sha256: string;
    citation: string;
    program_applicability_validated: boolean;
    effective_for_event_date_validated: boolean;
    source_status_conflict?: boolean;
  }

  export interface HotmaApplicabilityInput {
    property_id?: string;
    programs?: readonly string[];
    program_inventory_validated?: boolean;
    assistance_sources_reconciled?: boolean;
    program_authority_records?: readonly HotmaProgramAuthorityRecord[];
    mfh_program_subtype?: string;
  }

  export interface HotmaApplicabilityResult {
    applicability_status:
      | "APPLICABLE"
      | "NOT_APPLICABLE"
      | "UNABLE_TO_DETERMINE";
    resolution_status: string;
    determination_status: string;
    rule_engine_authority: "ALLOWED" | "BLOCKED" | "NOT_APPLICABLE";
    finding: "READY" | "NOT_APPLICABLE" | "UNABLE_TO_DETERMINE";
    reason_code?: string;
    reason?: string;
    missing_inputs?: string[];
    programs?: string[];
    hotma_covered_programs?: string[];
    mfh_program_subtype?: string | null;
    asset_cap_applicable: boolean;
    module_scope_required?: boolean;
    authority_document_ids?: string[];
    authority_manifest_sha256?: string;
    state_or_county_used_for_applicability: false;
    agent_approval_required: true;
    human_approval_required: true;
    engine_build: string;
  }

  export function classifyHotmaApplicability(
    input?: HotmaApplicabilityInput,
  ): HotmaApplicabilityResult;
}
