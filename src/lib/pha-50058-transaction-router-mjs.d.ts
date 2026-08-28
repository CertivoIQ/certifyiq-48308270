declare module "@/lib/pha-50058-transaction-router.mjs" {
  export type Pha50058TransactionStatus =
    | "READY"
    | "BLOCKED"
    | "PRE_IMPLEMENTATION"
    | "NOT_APPLICABLE"
    | "AWAITING_HUD_GUIDANCE";

  export interface Pha50058TransactionInput {
    program?: string;
    transaction_type?: string;
    effective_date?: string;
    pha_hotma_cohort?: string | null;
    hud_50058_reporting_path?: string | null;
    program_applicability_validated?: boolean;
    controlled_source_release_approved?: boolean;
    current_rule_version_validated?: boolean;
    source_status_conflict?: boolean;
    full_hotma_policy_set_validated?: boolean;
    reporting_path_validated?: boolean;
    software_compatibility_validated?: boolean;
  }

  export interface Pha50058TransactionResult {
    status: Pha50058TransactionStatus;
    reason_code?: string;
    reason?: string;
    missing_inputs?: string[];
    transaction_type?: string;
    program?: string;
    effective_date?: string;
    classifications?: Array<Record<string, unknown>>;
    human_approval_required: true;
    router_build: string;
  }

  export const PHA_50058_TRANSACTION_ROUTER_BUILD: string;
  export function routePha50058Transaction(input?: Pha50058TransactionInput): Pha50058TransactionResult;
}
