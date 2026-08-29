export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_access: {
        Row: {
          academy_seats: number
          access_until: string | null
          ai_doc_allowance: number | null
          created_at: string
          demo_data_cleared_at: string | null
          environment: string
          files_purge_at: string | null
          files_purged_at: string | null
          launchpad_started_at: string | null
          plan_id: string | null
          price_id: string | null
          property_limit: number | null
          status: string
          subscribed_at: string | null
          trial_started_at: string | null
          unit_limit: number | null
          updated_at: string
          user_id: string
          welcome_sent_at: string | null
        }
        Insert: {
          academy_seats?: number
          access_until?: string | null
          ai_doc_allowance?: number | null
          created_at?: string
          demo_data_cleared_at?: string | null
          environment?: string
          files_purge_at?: string | null
          files_purged_at?: string | null
          launchpad_started_at?: string | null
          plan_id?: string | null
          price_id?: string | null
          property_limit?: number | null
          status?: string
          subscribed_at?: string | null
          trial_started_at?: string | null
          unit_limit?: number | null
          updated_at?: string
          user_id: string
          welcome_sent_at?: string | null
        }
        Update: {
          academy_seats?: number
          access_until?: string | null
          ai_doc_allowance?: number | null
          created_at?: string
          demo_data_cleared_at?: string | null
          environment?: string
          files_purge_at?: string | null
          files_purged_at?: string | null
          launchpad_started_at?: string | null
          plan_id?: string | null
          price_id?: string | null
          property_limit?: number | null
          status?: string
          subscribed_at?: string | null
          trial_started_at?: string | null
          unit_limit?: number | null
          updated_at?: string
          user_id?: string
          welcome_sent_at?: string | null
        }
        Relationships: []
      }
      authority_submissions: {
        Row: {
          approval_required: boolean
          approved_at: string | null
          approved_by: string | null
          authority_name: string
          authority_type: string
          certification_id: string | null
          created_at: string
          delivery_method: string | null
          external_reference: string | null
          id: string
          property_id: string | null
          receipt_path: string | null
          response_notes: string | null
          status: string
          submission_package: Json
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          authority_name: string
          authority_type?: string
          certification_id?: string | null
          created_at?: string
          delivery_method?: string | null
          external_reference?: string | null
          id?: string
          property_id?: string | null
          receipt_path?: string | null
          response_notes?: string | null
          status?: string
          submission_package?: Json
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          authority_name?: string
          authority_type?: string
          certification_id?: string | null
          created_at?: string
          delivery_method?: string | null
          external_reference?: string | null
          id?: string
          property_id?: string | null
          receipt_path?: string | null
          response_notes?: string | null
          status?: string
          submission_package?: Json
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      certification_facts: {
        Row: {
          confidence: number
          created_at: string
          extraction_provider: string
          field_name: string
          field_value: Json | null
          human_verified: boolean
          id: string
          item_id: string
          organization_id: string
          required_for_decision: boolean
          source_document_ref: string
          source_page: number | null
          source_snippet: string | null
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          extraction_provider: string
          field_name: string
          field_value?: Json | null
          human_verified?: boolean
          id?: string
          item_id: string
          organization_id: string
          required_for_decision?: boolean
          source_document_ref: string
          source_page?: number | null
          source_snippet?: string | null
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          extraction_provider?: string
          field_name?: string
          field_value?: Json | null
          human_verified?: boolean
          id?: string
          item_id?: string
          organization_id?: string
          required_for_decision?: boolean
          source_document_ref?: string
          source_page?: number | null
          source_snippet?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certification_facts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "certification_import_items"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_import_items: {
        Row: {
          confidence: number | null
          created_at: string
          error_message: string | null
          extracted_data: Json
          findings: Json
          historical_changes: Json
          id: string
          job_id: string
          matched_certification_id: string | null
          mime_type: string
          original_file_name: string
          processed_at: string | null
          sha256: string | null
          size_bytes: number
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          extracted_data?: Json
          findings?: Json
          historical_changes?: Json
          id?: string
          job_id: string
          matched_certification_id?: string | null
          mime_type: string
          original_file_name: string
          processed_at?: string | null
          sha256?: string | null
          size_bytes: number
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          extracted_data?: Json
          findings?: Json
          historical_changes?: Json
          id?: string
          job_id?: string
          matched_certification_id?: string | null
          mime_type?: string
          original_file_name?: string
          processed_at?: string | null
          sha256?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certification_import_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "certification_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          duplicate_files: number
          error_count: number
          finding_count: number
          id: string
          processed_files: number
          source_name: string
          status: string
          total_files: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          duplicate_files?: number
          error_count?: number
          finding_count?: number
          id?: string
          processed_files?: number
          source_name: string
          status?: string
          total_files?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          duplicate_files?: number
          error_count?: number
          finding_count?: number
          id?: string
          processed_files?: number
          source_name?: string
          status?: string
          total_files?: number
          user_id?: string
        }
        Relationships: []
      }
      compliance_assurance_cases: {
        Row: {
          applicable_program_codes: string[]
          assurance_status: string
          audit_status: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          engine_build: string
          escalation_accuracy_status: string
          event_date: string
          household_key: string | null
          human_decision: string | null
          human_decision_reason: string | null
          id: string
          layered_result: Json
          manifest_sha256: string
          organization_id: string
          production_security_status: string
          property_key: string
          regulatory_status: string
          sustained_performance_status: string
          unit_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          applicable_program_codes: string[]
          assurance_status?: string
          audit_status?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          engine_build: string
          escalation_accuracy_status?: string
          event_date: string
          household_key?: string | null
          human_decision?: string | null
          human_decision_reason?: string | null
          id?: string
          layered_result?: Json
          manifest_sha256: string
          organization_id: string
          production_security_status?: string
          property_key: string
          regulatory_status?: string
          sustained_performance_status?: string
          unit_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          applicable_program_codes?: string[]
          assurance_status?: string
          audit_status?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          engine_build?: string
          escalation_accuracy_status?: string
          event_date?: string
          household_key?: string | null
          human_decision?: string | null
          human_decision_reason?: string | null
          id?: string
          layered_result?: Json
          manifest_sha256?: string
          organization_id?: string
          production_security_status?: string
          property_key?: string
          regulatory_status?: string
          sustained_performance_status?: string
          unit_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compliance_assurance_events: {
        Row: {
          actor_id: string | null
          assurance_case_id: string
          correlation_id: string
          created_at: string
          event_type: string
          evidence_refs: Json
          id: string
          next_status: string
          previous_status: string | null
          reason_code: string
        }
        Insert: {
          actor_id?: string | null
          assurance_case_id: string
          correlation_id: string
          created_at?: string
          event_type: string
          evidence_refs?: Json
          id?: string
          next_status: string
          previous_status?: string | null
          reason_code: string
        }
        Update: {
          actor_id?: string | null
          assurance_case_id?: string
          correlation_id?: string
          created_at?: string
          event_type?: string
          evidence_refs?: Json
          id?: string
          next_status?: string
          previous_status?: string | null
          reason_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_assurance_events_assurance_case_id_fkey"
            columns: ["assurance_case_id"]
            isOneToOne: false
            referencedRelation: "compliance_assurance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_customer_file_observations: {
        Row: {
          actual_customer_file: boolean
          assurance_case_id: string
          audit_trail_complete: boolean
          created_at: string
          cross_tenant_access_denied: boolean
          customer_key: string
          engine_build: string
          environment: string
          file_key: string
          human_result: string
          human_review_complete: boolean
          id: string
          latency_ms: number | null
          manifest_sha256: string
          observed_on: string
          reviewer_id: string
          severity: string
          system_result: string
          unresolved_evidence_blocked: boolean
          workflow_success: boolean
        }
        Insert: {
          actual_customer_file: boolean
          assurance_case_id: string
          audit_trail_complete: boolean
          created_at?: string
          cross_tenant_access_denied: boolean
          customer_key: string
          engine_build: string
          environment: string
          file_key: string
          human_result: string
          human_review_complete: boolean
          id?: string
          latency_ms?: number | null
          manifest_sha256: string
          observed_on: string
          reviewer_id: string
          severity: string
          system_result: string
          unresolved_evidence_blocked: boolean
          workflow_success: boolean
        }
        Update: {
          actual_customer_file?: boolean
          assurance_case_id?: string
          audit_trail_complete?: boolean
          created_at?: string
          cross_tenant_access_denied?: boolean
          customer_key?: string
          engine_build?: string
          environment?: string
          file_key?: string
          human_result?: string
          human_review_complete?: boolean
          id?: string
          latency_ms?: number | null
          manifest_sha256?: string
          observed_on?: string
          reviewer_id?: string
          severity?: string
          system_result?: string
          unresolved_evidence_blocked?: boolean
          workflow_success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "compliance_customer_file_observations_assurance_case_id_fkey"
            columns: ["assurance_case_id"]
            isOneToOne: false
            referencedRelation: "compliance_assurance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_escalation_outcomes: {
        Row: {
          assurance_case_id: string
          created_at: string
          event_key: string
          human_decision: string
          human_destination: string | null
          human_reason: string
          id: string
          reviewed_at: string
          reviewer_id: string
          severity: string
          system_decision: string
          system_destination: string
          system_reason_code: string
        }
        Insert: {
          assurance_case_id: string
          created_at?: string
          event_key: string
          human_decision: string
          human_destination?: string | null
          human_reason: string
          id?: string
          reviewed_at: string
          reviewer_id: string
          severity: string
          system_decision: string
          system_destination: string
          system_reason_code: string
        }
        Update: {
          assurance_case_id?: string
          created_at?: string
          event_key?: string
          human_decision?: string
          human_destination?: string | null
          human_reason?: string
          id?: string
          reviewed_at?: string
          reviewer_id?: string
          severity?: string
          system_decision?: string
          system_destination?: string
          system_reason_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_escalation_outcomes_assurance_case_id_fkey"
            columns: ["assurance_case_id"]
            isOneToOne: false
            referencedRelation: "compliance_assurance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_findings: {
        Row: {
          blocking_reasons: Json
          created_at: string
          engine_build: string
          evidence_refs: Json
          explanation: string
          id: string
          item_id: string
          jurisdiction: string
          organization_id: string
          review_state: string
          rule_id: string
          rule_pack_id: string
          rule_pack_version: string
          rule_version: string
          severity: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blocking_reasons?: Json
          created_at?: string
          engine_build: string
          evidence_refs?: Json
          explanation: string
          id?: string
          item_id: string
          jurisdiction: string
          organization_id: string
          review_state?: string
          rule_id: string
          rule_pack_id: string
          rule_pack_version: string
          rule_version: string
          severity?: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blocking_reasons?: Json
          created_at?: string
          engine_build?: string
          evidence_refs?: Json
          explanation?: string
          id?: string
          item_id?: string
          jurisdiction?: string
          organization_id?: string
          review_state?: string
          rule_id?: string
          rule_pack_id?: string
          rule_pack_version?: string
          rule_version?: string
          severity?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_findings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "certification_import_items"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_regulatory_reviews: {
        Row: {
          assurance_case_id: string
          authority_records: Json
          created_at: string
          decision_reason: string | null
          escalation_destination: string
          human_decision: string | null
          id: string
          issue_type: string
          reviewed_at: string | null
          reviewer_id: string | null
          rule_key: string
          source_hashes: string[]
          system_status: string
        }
        Insert: {
          assurance_case_id: string
          authority_records: Json
          created_at?: string
          decision_reason?: string | null
          escalation_destination: string
          human_decision?: string | null
          id?: string
          issue_type: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          rule_key: string
          source_hashes: string[]
          system_status: string
        }
        Update: {
          assurance_case_id?: string
          authority_records?: Json
          created_at?: string
          decision_reason?: string | null
          escalation_destination?: string
          human_decision?: string | null
          id?: string
          issue_type?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          rule_key?: string
          source_hashes?: string[]
          system_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_regulatory_reviews_assurance_case_id_fkey"
            columns: ["assurance_case_id"]
            isOneToOne: false
            referencedRelation: "compliance_assurance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_remediation_actions: {
        Row: {
          assigned_to: string | null
          assurance_case_id: string
          citation: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          due_at: string | null
          evidence_refs: Json
          finding_id: string | null
          finding_ref: string
          id: string
          remediation_plan: string
          remediation_summary: string | null
          rule_id: string
          severity: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          assurance_case_id: string
          citation: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          due_at?: string | null
          evidence_refs?: Json
          finding_id?: string | null
          finding_ref: string
          id?: string
          remediation_plan: string
          remediation_summary?: string | null
          rule_id: string
          severity: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          assurance_case_id?: string
          citation?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          due_at?: string | null
          evidence_refs?: Json
          finding_id?: string | null
          finding_ref?: string
          id?: string
          remediation_plan?: string
          remediation_summary?: string | null
          rule_id?: string
          severity?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_remediation_actions_assurance_case_id_fkey"
            columns: ["assurance_case_id"]
            isOneToOne: false
            referencedRelation: "compliance_assurance_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_remediation_actions_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "compliance_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_cases: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string
          detail: string | null
          disposition: string | null
          due_at: string
          finding_ref: string
          id: string
          owner_responded_at: string | null
          owner_response: string | null
          quarantine_ack_at: string | null
          quarantine_ack_by: string | null
          status: Database["public"]["Enums"]["correction_case_status"]
          submission_id: string
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by: string
          detail?: string | null
          disposition?: string | null
          due_at: string
          finding_ref: string
          id?: string
          owner_responded_at?: string | null
          owner_response?: string | null
          quarantine_ack_at?: string | null
          quarantine_ack_by?: string | null
          status?: Database["public"]["Enums"]["correction_case_status"]
          submission_id: string
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          detail?: string | null
          disposition?: string | null
          due_at?: string
          finding_ref?: string
          id?: string
          owner_responded_at?: string | null
          owner_response?: string | null
          quarantine_ack_at?: string | null
          quarantine_ack_by?: string | null
          status?: Database["public"]["Enums"]["correction_case_status"]
          submission_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_cases_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "hfa_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_evidence: {
        Row: {
          byte_size: number | null
          correction_case_id: string
          document_label: string | null
          document_ref: string
          id: string
          mime_type: string | null
          scan_status: string
          sha256: string
          storage_bucket: string | null
          storage_path: string | null
          storage_version: string | null
          submitted_at: string
          submitted_by: string
        }
        Insert: {
          byte_size?: number | null
          correction_case_id: string
          document_label?: string | null
          document_ref: string
          id?: string
          mime_type?: string | null
          scan_status?: string
          sha256: string
          storage_bucket?: string | null
          storage_path?: string | null
          storage_version?: string | null
          submitted_at?: string
          submitted_by: string
        }
        Update: {
          byte_size?: number | null
          correction_case_id?: string
          document_label?: string | null
          document_ref?: string
          id?: string
          mime_type?: string | null
          scan_status?: string
          sha256?: string
          storage_bucket?: string | null
          storage_path?: string | null
          storage_version?: string | null
          submitted_at?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_evidence_correction_case_id_fkey"
            columns: ["correction_case_id"]
            isOneToOne: false
            referencedRelation: "correction_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["crm_account_type"]
          arr: number
          corporate_email: string | null
          created_at: string
          created_by: string | null
          hq: string | null
          id: string
          last_contact_on: string | null
          last_touch: string | null
          lead_score: number
          linkedin_url: string | null
          management_company_name: string | null
          name: string
          next_followup_on: string | null
          notes: string | null
          owner: string | null
          owner_manager_website: string | null
          ownership_confidence: number | null
          ownership_sources: string[]
          ownership_verification_status: string
          ownership_verified_at: string | null
          phone: string | null
          plan: string | null
          programs: string[]
          properties: number
          property_owner_name: string | null
          reminders_sent: number
          responded: boolean
          role: string | null
          source: string | null
          stage: Database["public"]["Enums"]["crm_stage"]
          states: string[]
          territory: string | null
          trial_ended_on: string | null
          units: number
          updated_at: string
          website: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["crm_account_type"]
          arr?: number
          corporate_email?: string | null
          created_at?: string
          created_by?: string | null
          hq?: string | null
          id?: string
          last_contact_on?: string | null
          last_touch?: string | null
          lead_score?: number
          linkedin_url?: string | null
          management_company_name?: string | null
          name: string
          next_followup_on?: string | null
          notes?: string | null
          owner?: string | null
          owner_manager_website?: string | null
          ownership_confidence?: number | null
          ownership_sources?: string[]
          ownership_verification_status?: string
          ownership_verified_at?: string | null
          phone?: string | null
          plan?: string | null
          programs?: string[]
          properties?: number
          property_owner_name?: string | null
          reminders_sent?: number
          responded?: boolean
          role?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          states?: string[]
          territory?: string | null
          trial_ended_on?: string | null
          units?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["crm_account_type"]
          arr?: number
          corporate_email?: string | null
          created_at?: string
          created_by?: string | null
          hq?: string | null
          id?: string
          last_contact_on?: string | null
          last_touch?: string | null
          lead_score?: number
          linkedin_url?: string | null
          management_company_name?: string | null
          name?: string
          next_followup_on?: string | null
          notes?: string | null
          owner?: string | null
          owner_manager_website?: string | null
          ownership_confidence?: number | null
          ownership_sources?: string[]
          ownership_verification_status?: string
          ownership_verified_at?: string | null
          phone?: string | null
          plan?: string | null
          programs?: string[]
          properties?: number
          property_owner_name?: string | null
          reminders_sent?: number
          responded?: boolean
          role?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          states?: string[]
          territory?: string | null
          trial_ended_on?: string | null
          units?: number
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          account_id: string
          actor_email: string | null
          body: string | null
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          outcome: string | null
          subject: string | null
        }
        Insert: {
          account_id: string
          actor_email?: string | null
          body?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          outcome?: string | null
          subject?: string | null
        }
        Update: {
          account_id?: string
          actor_email?: string | null
          body?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          outcome?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          audience: string | null
          automated: boolean
          body: string | null
          channel: string
          clicked: number
          compliance_event: string | null
          converted: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          opened: number
          scheduled_for: string | null
          sent: number
          status: string
          subject: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          audience?: string | null
          automated?: boolean
          body?: string | null
          channel?: string
          clicked?: number
          compliance_event?: string | null
          converted?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          opened?: number
          scheduled_for?: string | null
          sent?: number
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string | null
          automated?: boolean
          body?: string | null
          channel?: string
          clicked?: number
          compliance_event?: string | null
          converted?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          opened?: number
          scheduled_for?: string | null
          sent?: number
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          account_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          linkedin_url: string | null
          name: string
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          linkedin_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_documents: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          file_name: string
          id: string
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          file_name: string
          id?: string
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          name?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_news: {
        Row: {
          detail: string | null
          headline: string
          id: string
          kind: string
          published_at: string
          source: string | null
          url: string | null
        }
        Insert: {
          detail?: string | null
          headline: string
          id?: string
          kind?: string
          published_at?: string
          source?: string | null
          url?: string | null
        }
        Update: {
          detail?: string | null
          headline?: string
          id?: string
          kind?: string
          published_at?: string
          source?: string | null
          url?: string | null
        }
        Relationships: []
      }
      crm_staff_access: {
        Row: {
          access_level: string
          disabled_at: string | null
          disabled_by: string | null
          granted_at: string
          granted_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level: string
          disabled_at?: string | null
          disabled_by?: string | null
          granted_at?: string
          granted_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          disabled_at?: string | null
          disabled_by?: string | null
          granted_at?: string
          granted_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_staff_access_events: {
        Row: {
          access_level: string | null
          actor_id: string | null
          detail: Json
          event_type: string
          id: number
          invitation_id: string | null
          occurred_at: string
          target_user_id: string | null
        }
        Insert: {
          access_level?: string | null
          actor_id?: string | null
          detail?: Json
          event_type: string
          id?: never
          invitation_id?: string | null
          occurred_at?: string
          target_user_id?: string | null
        }
        Update: {
          access_level?: string | null
          actor_id?: string | null
          detail?: Json
          event_type?: string
          id?: never
          invitation_id?: string | null
          occurred_at?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_staff_access_events_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "crm_staff_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_staff_invitations: {
        Row: {
          accepted_at: string | null
          access_level: string
          auth_user_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_attempt_count: number
          delivery_attempted_at: string | null
          delivery_error: string | null
          delivery_status: string
          expires_at: string
          id: string
          invite_email: string
          invited_by: string
          revoked_at: string | null
          revoked_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          access_level: string
          auth_user_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_attempt_count?: number
          delivery_attempted_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          expires_at?: string
          id?: string
          invite_email: string
          invited_by: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          access_level?: string
          auth_user_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_attempt_count?: number
          delivery_attempted_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          expires_at?: string
          id?: string
          invite_email?: string
          invited_by?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_templates: {
        Row: {
          body: string
          category: string
          compliance_event: string | null
          created_at: string
          cta_label: string | null
          id: string
          name: string
          subject: string
        }
        Insert: {
          body: string
          category: string
          compliance_event?: string | null
          created_at?: string
          cta_label?: string | null
          id?: string
          name: string
          subject: string
        }
        Update: {
          body?: string
          category?: string
          compliance_event?: string | null
          created_at?: string
          cta_label?: string | null
          id?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      customer_workspace_profiles: {
        Row: {
          created_at: string
          derived_overlays: string[]
          hud_50058_reporting_path: string | null
          organization_type: string
          pha_hotma_cohort: string | null
          pha_programs: string[]
          selected_programs: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          derived_overlays?: string[]
          hud_50058_reporting_path?: string | null
          organization_type?: string
          pha_hotma_cohort?: string | null
          pha_programs?: string[]
          selected_programs?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          derived_overlays?: string[]
          hud_50058_reporting_path?: string | null
          organization_type?: string
          pha_hotma_cohort?: string | null
          pha_programs?: string[]
          selected_programs?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evidence_manifests: {
        Row: {
          certification_id: string | null
          created_at: string
          engine_build: string
          id: string
          manifest: Json
          manifest_sha256: string
          organization_id: string
          outcome: string
          property_id: string | null
          review_id: string
          user_id: string
        }
        Insert: {
          certification_id?: string | null
          created_at?: string
          engine_build: string
          id?: string
          manifest: Json
          manifest_sha256: string
          organization_id: string
          outcome: string
          property_id?: string | null
          review_id: string
          user_id: string
        }
        Update: {
          certification_id?: string | null
          created_at?: string
          engine_build?: string
          id?: string
          manifest?: Json
          manifest_sha256?: string
          organization_id?: string
          outcome?: string
          property_id?: string | null
          review_id?: string
          user_id?: string
        }
        Relationships: []
      }
      finding_reviews: {
        Row: {
          created_at: string
          decision: string
          expires_at: string | null
          finding_id: string
          id: string
          manifest_sha256: string | null
          reason: string | null
          reviewer_id: string
          revoked_at: string | null
          revoked_review_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          expires_at?: string | null
          finding_id: string
          id?: string
          manifest_sha256?: string | null
          reason?: string | null
          reviewer_id: string
          revoked_at?: string | null
          revoked_review_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          expires_at?: string | null
          finding_id?: string
          id?: string
          manifest_sha256?: string | null
          reason?: string | null
          reviewer_id?: string
          revoked_at?: string | null
          revoked_review_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finding_reviews_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "compliance_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finding_reviews_revoked_review_id_fkey"
            columns: ["revoked_review_id"]
            isOneToOne: false
            referencedRelation: "finding_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      hfa_agencies: {
        Row: {
          authority_scope: Json
          created_at: string
          id: string
          is_demo: boolean
          name: string
          state_code: string
          updated_at: string
        }
        Insert: {
          authority_scope?: Json
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          state_code: string
          updated_at?: string
        }
        Update: {
          authority_scope?: Json
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          state_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      hfa_agency_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          agency_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          is_demo: boolean
          revoked_at: string | null
          revoked_by: string | null
          role: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          is_demo?: boolean
          revoked_at?: string | null
          revoked_by?: string | null
          role: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          is_demo?: boolean
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hfa_agency_invitations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "hfa_agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      hfa_agency_memberships: {
        Row: {
          agency_id: string
          created_at: string
          invited_at: string | null
          invited_by: string | null
          role: string
          suspended_at: string | null
          suspended_by: string | null
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          invited_at?: string | null
          invited_by?: string | null
          role: string
          suspended_at?: string | null
          suspended_by?: string | null
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: string
          suspended_at?: string | null
          suspended_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hfa_agency_memberships_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "hfa_agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      hfa_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: string
          agency_id: string | null
          created_at: string
          detail: Json
          id: string
          submission_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind: string
          agency_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          submission_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: string
          agency_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hfa_audit_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "hfa_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfa_audit_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "hfa_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      hfa_delivery_receipts: {
        Row: {
          adapter: string
          agency_id: string
          created_at: string
          created_by: string
          delivered_at: string | null
          delivery_status: string
          evidence_manifest_id: string
          external_receipt_id: string
          externally_delivered: boolean
          id: string
          manifest_sha256: string
          receipt_payload: Json
          submission_id: string
        }
        Insert: {
          adapter: string
          agency_id: string
          created_at?: string
          created_by: string
          delivered_at?: string | null
          delivery_status: string
          evidence_manifest_id: string
          external_receipt_id: string
          externally_delivered?: boolean
          id?: string
          manifest_sha256: string
          receipt_payload?: Json
          submission_id: string
        }
        Update: {
          adapter?: string
          agency_id?: string
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          delivery_status?: string
          evidence_manifest_id?: string
          external_receipt_id?: string
          externally_delivered?: boolean
          id?: string
          manifest_sha256?: string
          receipt_payload?: Json
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hfa_delivery_receipts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "hfa_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfa_delivery_receipts_evidence_manifest_id_fkey"
            columns: ["evidence_manifest_id"]
            isOneToOne: false
            referencedRelation: "evidence_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfa_delivery_receipts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "hfa_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      hfa_submission_grants: {
        Row: {
          agency_id: string
          granted_at: string
          granted_by: string
          revoked_at: string | null
          submission_id: string
        }
        Insert: {
          agency_id: string
          granted_at?: string
          granted_by: string
          revoked_at?: string | null
          submission_id: string
        }
        Update: {
          agency_id?: string
          granted_at?: string
          granted_by?: string
          revoked_at?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hfa_submission_grants_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "hfa_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfa_submission_grants_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "hfa_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      hfa_submissions: {
        Row: {
          accepted_at: string | null
          agency_id: string
          certification_id: string | null
          created_at: string
          evidence_manifest_id: string | null
          id: string
          organization_id: string
          owner_user_id: string
          preflight: Json
          previous_submission_id: string | null
          program: string
          property_id: string
          property_name: string | null
          readiness_score: number | null
          reporting_period: string
          status: Database["public"]["Enums"]["hfa_submission_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          agency_id: string
          certification_id?: string | null
          created_at?: string
          evidence_manifest_id?: string | null
          id?: string
          organization_id: string
          owner_user_id: string
          preflight?: Json
          previous_submission_id?: string | null
          program: string
          property_id: string
          property_name?: string | null
          readiness_score?: number | null
          reporting_period: string
          status?: Database["public"]["Enums"]["hfa_submission_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          agency_id?: string
          certification_id?: string | null
          created_at?: string
          evidence_manifest_id?: string | null
          id?: string
          organization_id?: string
          owner_user_id?: string
          preflight?: Json
          previous_submission_id?: string | null
          program?: string
          property_id?: string
          property_name?: string | null
          readiness_score?: number | null
          reporting_period?: string
          status?: Database["public"]["Enums"]["hfa_submission_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hfa_submissions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "hfa_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfa_submissions_evidence_manifest_id_fkey"
            columns: ["evidence_manifest_id"]
            isOneToOne: false
            referencedRelation: "evidence_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfa_submissions_previous_submission_id_fkey"
            columns: ["previous_submission_id"]
            isOneToOne: false
            referencedRelation: "hfa_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      hfa_transmission_tokens: {
        Row: {
          agency_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          issued_at: string
          issued_by: string
          manifest_sha256: string
          revoked_at: string | null
          submission_id: string
        }
        Insert: {
          agency_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          issued_at?: string
          issued_by: string
          manifest_sha256: string
          revoked_at?: string | null
          submission_id: string
        }
        Update: {
          agency_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          issued_at?: string
          issued_by?: string
          manifest_sha256?: string
          revoked_at?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hfa_transmission_tokens_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "hfa_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfa_transmission_tokens_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "hfa_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_audit_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          critical_count: number
          evidence_manifest: Json
          findings: Json
          framework: string
          id: string
          jurisdiction: string
          major_count: number
          minor_count: number
          property_id: string | null
          readiness_score: number | null
          scope: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          critical_count?: number
          evidence_manifest?: Json
          findings?: Json
          framework: string
          id?: string
          jurisdiction: string
          major_count?: number
          minor_count?: number
          property_id?: string | null
          readiness_score?: number | null
          scope: string
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          critical_count?: number
          evidence_manifest?: Json
          findings?: Json
          framework?: string
          id?: string
          jurisdiction?: string
          major_count?: number
          minor_count?: number
          property_id?: string | null
          readiness_score?: number | null
          scope?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      operations_approvals: {
        Row: {
          action_snapshot: Json
          action_type: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          expires_at: string
          id: string
          job_id: string
          reason: string | null
          requested_at: string
          requested_by: string
          snapshot_sha256: string
          status: Database["public"]["Enums"]["operations_approval_status"]
        }
        Insert: {
          action_snapshot: Json
          action_type: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          expires_at: string
          id?: string
          job_id: string
          reason?: string | null
          requested_at?: string
          requested_by: string
          snapshot_sha256: string
          status?: Database["public"]["Enums"]["operations_approval_status"]
        }
        Update: {
          action_snapshot?: Json
          action_type?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          expires_at?: string
          id?: string
          job_id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string
          snapshot_sha256?: string
          status?: Database["public"]["Enums"]["operations_approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "operations_approvals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "operations_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      operations_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: string
          after_sha256: string | null
          before_sha256: string | null
          correlation_id: string
          created_at: string
          detail: Json
          evidence_refs: Json
          id: number
          severity: string
          source_refs: Json
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind: string
          after_sha256?: string | null
          before_sha256?: string | null
          correlation_id: string
          created_at?: string
          detail?: Json
          evidence_refs?: Json
          id?: never
          severity?: string
          source_refs?: Json
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: string
          after_sha256?: string | null
          before_sha256?: string | null
          correlation_id?: string
          created_at?: string
          detail?: Json
          evidence_refs?: Json
          id?: never
          severity?: string
          source_refs?: Json
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      operations_budget_limits: {
        Row: {
          amount_limit: number
          created_at: string
          created_by: string | null
          enabled: boolean
          hard_stop: boolean
          id: string
          period: string
          scope: string
          updated_at: string
        }
        Insert: {
          amount_limit: number
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          hard_stop?: boolean
          id?: string
          period: string
          scope: string
          updated_at?: string
        }
        Update: {
          amount_limit?: number
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          hard_stop?: boolean
          id?: string
          period?: string
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      operations_communications: {
        Row: {
          approval_id: string | null
          approved_at: string | null
          audience_snapshot: Json
          body: Json
          channel: string
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string
          official_source_refs: Json
          recipient_count: number | null
          release_key: string
          requires_approval: boolean
          sent_at: string | null
          status: Database["public"]["Enums"]["operations_communication_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          approval_id?: string | null
          approved_at?: string | null
          audience_snapshot?: Json
          body: Json
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key: string
          official_source_refs?: Json
          recipient_count?: number | null
          release_key: string
          requires_approval?: boolean
          sent_at?: string | null
          status?: Database["public"]["Enums"]["operations_communication_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          approval_id?: string | null
          approved_at?: string | null
          audience_snapshot?: Json
          body?: Json
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string
          official_source_refs?: Json
          recipient_count?: number | null
          release_key?: string
          requires_approval?: boolean
          sent_at?: string | null
          status?: Database["public"]["Enums"]["operations_communication_status"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operations_communications_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "operations_approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      operations_cost_events: {
        Row: {
          amount: number
          correlation_id: string
          currency: string
          detail: Json
          id: number
          job_id: string | null
          occurred_at: string
          provider: string
          service: string
          units: number | null
        }
        Insert: {
          amount: number
          correlation_id: string
          currency?: string
          detail?: Json
          id?: never
          job_id?: string | null
          occurred_at?: string
          provider: string
          service: string
          units?: number | null
        }
        Update: {
          amount?: number
          correlation_id?: string
          currency?: string
          detail?: Json
          id?: never
          job_id?: string | null
          occurred_at?: string
          provider?: string
          service?: string
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operations_cost_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "operations_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      operations_incidents: {
        Row: {
          correlation_id: string
          detail: Json
          first_seen_at: string
          id: string
          job_id: string | null
          last_seen_at: string
          resolution: Json | null
          resolved_at: string | null
          resolved_by: string | null
          retry_count: number
          rollback_data: Json | null
          severity: string
          status: Database["public"]["Enums"]["operations_incident_status"]
          summary: string
        }
        Insert: {
          correlation_id: string
          detail?: Json
          first_seen_at?: string
          id?: string
          job_id?: string | null
          last_seen_at?: string
          resolution?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number
          rollback_data?: Json | null
          severity: string
          status?: Database["public"]["Enums"]["operations_incident_status"]
          summary: string
        }
        Update: {
          correlation_id?: string
          detail?: Json
          first_seen_at?: string
          id?: string
          job_id?: string | null
          last_seen_at?: string
          resolution?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number
          rollback_data?: Json | null
          severity?: string
          status?: Database["public"]["Enums"]["operations_incident_status"]
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "operations_incidents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "operations_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      operations_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          correlation_id: string
          created_at: string
          created_by: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          last_error: Json | null
          lease_expires_at: string | null
          lease_owner: string | null
          max_attempts: number
          payload: Json
          result: Json | null
          risk_tier: Database["public"]["Enums"]["operations_risk_tier"]
          scheduled_at: string
          source: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["operations_job_status"]
          updated_at: string
          worker: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          correlation_id?: string
          created_at?: string
          created_by?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key: string
          job_type: string
          last_error?: Json | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          max_attempts?: number
          payload?: Json
          result?: Json | null
          risk_tier: Database["public"]["Enums"]["operations_risk_tier"]
          scheduled_at?: string
          source?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["operations_job_status"]
          updated_at?: string
          worker: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          correlation_id?: string
          created_at?: string
          created_by?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string
          job_type?: string
          last_error?: Json | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          max_attempts?: number
          payload?: Json
          result?: Json | null
          risk_tier?: Database["public"]["Enums"]["operations_risk_tier"]
          scheduled_at?: string
          source?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["operations_job_status"]
          updated_at?: string
          worker?: string
        }
        Relationships: []
      }
      operations_notification_preferences: {
        Row: {
          compliance_product_updates: boolean
          marketing_updates: boolean
          regulatory_updates: boolean
          unsubscribed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compliance_product_updates?: boolean
          marketing_updates?: boolean
          regulatory_updates?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compliance_product_updates?: boolean
          marketing_updates?: boolean
          regulatory_updates?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      operations_source_versions: {
        Row: {
          authority: string
          created_at: string
          effective_date: string | null
          evidence_manifest: Json
          id: string
          jurisdiction: string | null
          official_url: string
          parsing_status: string
          program: string | null
          publication_date: string | null
          retrieved_at: string
          sha256: string
          storage_bucket: string | null
          storage_path: string | null
          supersedes_id: string | null
          validation_status: string
        }
        Insert: {
          authority: string
          created_at?: string
          effective_date?: string | null
          evidence_manifest?: Json
          id?: string
          jurisdiction?: string | null
          official_url: string
          parsing_status?: string
          program?: string | null
          publication_date?: string | null
          retrieved_at?: string
          sha256: string
          storage_bucket?: string | null
          storage_path?: string | null
          supersedes_id?: string | null
          validation_status?: string
        }
        Update: {
          authority?: string
          created_at?: string
          effective_date?: string | null
          evidence_manifest?: Json
          id?: string
          jurisdiction?: string | null
          official_url?: string
          parsing_status?: string
          program?: string | null
          publication_date?: string | null
          retrieved_at?: string
          sha256?: string
          storage_bucket?: string | null
          storage_path?: string | null
          supersedes_id?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "operations_source_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "operations_source_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_50058_submission_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          created_by: string
          external_submission_reference: string | null
          id: string
          payload_snapshot: Json
          responded_at: string | null
          response_code: string | null
          response_message: string | null
          status: string
          transaction_id: string
          transmitted_at: string | null
          transport_mode: string
          workspace_user_id: string
        }
        Insert: {
          attempt_number: number
          created_at?: string
          created_by?: string
          external_submission_reference?: string | null
          id?: string
          payload_snapshot: Json
          responded_at?: string | null
          response_code?: string | null
          response_message?: string | null
          status: string
          transaction_id: string
          transmitted_at?: string | null
          transport_mode: string
          workspace_user_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          created_by?: string
          external_submission_reference?: string | null
          id?: string
          payload_snapshot?: Json
          responded_at?: string | null
          response_code?: string | null
          response_message?: string | null
          status?: string
          transaction_id?: string
          transmitted_at?: string | null
          transport_mode?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_50058_submission_attempts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "pha_50058_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_50058_submission_events: {
        Row: {
          actor_user_id: string
          event_snapshot: Json
          event_type: string
          id: string
          occurred_at: string
          submission_attempt_id: string | null
          transaction_id: string
        }
        Insert: {
          actor_user_id?: string
          event_snapshot: Json
          event_type: string
          id?: string
          occurred_at?: string
          submission_attempt_id?: string | null
          transaction_id: string
        }
        Update: {
          actor_user_id?: string
          event_snapshot?: Json
          event_type?: string
          id?: string
          occurred_at?: string
          submission_attempt_id?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_50058_submission_events_submission_attempt_id_fkey"
            columns: ["submission_attempt_id"]
            isOneToOne: false
            referencedRelation: "pha_50058_submission_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_50058_submission_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "pha_50058_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_50058_transactions: {
        Row: {
          controlled_source_release_approved: boolean
          created_at: string
          created_by: string
          current_rule_version_validated: boolean
          effective_date: string
          family_reference: string
          full_hotma_policy_set_validated: boolean
          id: string
          last_response_at: string | null
          last_submission_at: string | null
          program_applicability_validated: boolean
          program_code: string
          reporting_path_validated: boolean
          routing_status: string
          software_compatibility_validated: boolean
          source_family_action_id: string | null
          source_status_conflict: boolean
          submission_status: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          controlled_source_release_approved?: boolean
          created_at?: string
          created_by?: string
          current_rule_version_validated?: boolean
          effective_date: string
          family_reference: string
          full_hotma_policy_set_validated?: boolean
          id?: string
          last_response_at?: string | null
          last_submission_at?: string | null
          program_applicability_validated?: boolean
          program_code: string
          reporting_path_validated?: boolean
          routing_status?: string
          software_compatibility_validated?: boolean
          source_family_action_id?: string | null
          source_status_conflict?: boolean
          submission_status?: string
          transaction_type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          controlled_source_release_approved?: boolean
          created_at?: string
          created_by?: string
          current_rule_version_validated?: boolean
          effective_date?: string
          family_reference?: string
          full_hotma_policy_set_validated?: boolean
          id?: string
          last_response_at?: string | null
          last_submission_at?: string | null
          program_applicability_validated?: boolean
          program_code?: string
          reporting_path_validated?: boolean
          routing_status?: string
          software_compatibility_validated?: boolean
          source_family_action_id?: string | null
          source_status_conflict?: boolean
          submission_status?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_50058_transactions_source_family_action_id_fkey"
            columns: ["source_family_action_id"]
            isOneToOne: false
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_50058_transport_profiles: {
        Row: {
          created_at: string
          credential_reference: string | null
          endpoint_label: string | null
          id: string
          reporting_path: string
          status: string
          transport_mode: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          workspace_user_id: string
        }
        Insert: {
          created_at?: string
          credential_reference?: string | null
          endpoint_label?: string | null
          id?: string
          reporting_path: string
          status?: string
          transport_mode: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          workspace_user_id: string
        }
        Update: {
          created_at?: string
          credential_reference?: string | null
          endpoint_label?: string | null
          id?: string
          reporting_path?: string
          status?: string
          transport_mode?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          workspace_user_id?: string
        }
        Relationships: []
      }
      pha_agency_settings: {
        Row: {
          agency_code: string | null
          agency_name: string | null
          created_at: string
          default_language: string
          escalation_contact_email: string | null
          hud_submission_contact_email: string | null
          id: string
          inspection_contact_email: string | null
          notice_delivery_defaults: Json
          support_mode: string
          timezone: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          agency_code?: string | null
          agency_name?: string | null
          created_at?: string
          default_language?: string
          escalation_contact_email?: string | null
          hud_submission_contact_email?: string | null
          id?: string
          inspection_contact_email?: string | null
          notice_delivery_defaults?: Json
          support_mode?: string
          timezone?: string
          updated_at?: string
          workspace_user_id: string
        }
        Update: {
          agency_code?: string | null
          agency_name?: string | null
          created_at?: string
          default_language?: string
          escalation_contact_email?: string | null
          hud_submission_contact_email?: string | null
          id?: string
          inspection_contact_email?: string | null
          notice_delivery_defaults?: Json
          support_mode?: string
          timezone?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: []
      }
      pha_authoritative_control_state: {
        Row: {
          created_at: string
          hotma_policy_status: string
          id: string
          program_code: string
          reporting_path_status: string
          rule_version: string | null
          rule_version_status: string
          software_compatibility_status: string
          source_authority_key: string | null
          source_release_status: string
          source_status_conflict: boolean
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          hotma_policy_status?: string
          id?: string
          program_code: string
          reporting_path_status?: string
          rule_version?: string | null
          rule_version_status?: string
          software_compatibility_status?: string
          source_authority_key?: string | null
          source_release_status?: string
          source_status_conflict?: boolean
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          hotma_policy_status?: string
          id?: string
          program_code?: string
          reporting_path_status?: string
          rule_version?: string | null
          rule_version_status?: string
          software_compatibility_status?: string
          source_authority_key?: string | null
          source_release_status?: string
          source_status_conflict?: boolean
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: []
      }
      pha_controlled_templates: {
        Row: {
          body_schema: Json
          created_at: string
          id: string
          policy_overlay_id: string | null
          program_code: string
          required_fields: string[]
          source_library_id: string
          status: string
          template_key: string
          template_type: string
          title: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          version_label: string
          workspace_user_id: string
        }
        Insert: {
          body_schema?: Json
          created_at?: string
          id?: string
          policy_overlay_id?: string | null
          program_code: string
          required_fields?: string[]
          source_library_id: string
          status?: string
          template_key: string
          template_type: string
          title: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          version_label: string
          workspace_user_id?: string
        }
        Update: {
          body_schema?: Json
          created_at?: string
          id?: string
          policy_overlay_id?: string | null
          program_code?: string
          required_fields?: string[]
          source_library_id?: string
          status?: string
          template_key?: string
          template_type?: string
          title?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          version_label?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_controlled_templates_policy_overlay_id_fkey"
            columns: ["policy_overlay_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_policy_overlays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_controlled_templates_source_library_id_fkey"
            columns: ["source_library_id"]
            isOneToOne: false
            referencedRelation: "pha_source_library"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_family_actions: {
        Row: {
          action_type: string
          calculation_complete: boolean
          controlled_source_release_approved: boolean
          created_at: string
          current_rule_version_validated: boolean
          due_date: string | null
          effective_date: string
          eiv_review_complete: boolean
          family_reference: string
          full_hotma_policy_set_validated: boolean
          id: string
          notice_complete: boolean
          program_applicability_validated: boolean
          program_code: string
          reporting_path_validated: boolean
          software_compatibility_validated: boolean
          source_status_conflict: boolean
          updated_at: string
          user_id: string
          verification_complete: boolean
          workflow_status: string
        }
        Insert: {
          action_type: string
          calculation_complete?: boolean
          controlled_source_release_approved?: boolean
          created_at?: string
          current_rule_version_validated?: boolean
          due_date?: string | null
          effective_date: string
          eiv_review_complete?: boolean
          family_reference: string
          full_hotma_policy_set_validated?: boolean
          id?: string
          notice_complete?: boolean
          program_applicability_validated?: boolean
          program_code: string
          reporting_path_validated?: boolean
          software_compatibility_validated?: boolean
          source_status_conflict?: boolean
          updated_at?: string
          user_id?: string
          verification_complete?: boolean
          workflow_status?: string
        }
        Update: {
          action_type?: string
          calculation_complete?: boolean
          controlled_source_release_approved?: boolean
          created_at?: string
          current_rule_version_validated?: boolean
          due_date?: string | null
          effective_date?: string
          eiv_review_complete?: boolean
          family_reference?: string
          full_hotma_policy_set_validated?: boolean
          id?: string
          notice_complete?: boolean
          program_applicability_validated?: boolean
          program_code?: string
          reporting_path_validated?: boolean
          software_compatibility_validated?: boolean
          source_status_conflict?: boolean
          updated_at?: string
          user_id?: string
          verification_complete?: boolean
          workflow_status?: string
        }
        Relationships: []
      }
      pha_family_calculations: {
        Row: {
          adjusted_income: number | null
          alternative_non_public_housing_rent: number | null
          alternative_non_public_housing_rent_applicable: boolean
          annual_income: number
          calculated_at: string | null
          calculation_status: string
          contract_rent_to_owner: number | null
          created_at: string
          current_base_rent: number | null
          deductions: number
          eligible_family_members: number | null
          engine_build: string
          family_action_id: string
          family_share: number | null
          flat_rent_amount: number | null
          gross_rent: number | null
          housing_assistance_payment: number | null
          id: string
          minimum_rent: number
          mixed_family_proration_applicable: boolean
          mixed_family_total_tenant_payment: number | null
          mod_rehab_source_validated: boolean
          monthly_adjusted_income: number | null
          monthly_income: number | null
          normal_total_hap: number | null
          payment_standard: number | null
          program_code: string
          prorated_total_hap: number | null
          proration_percentage: number | null
          public_housing_rent_choice: string | null
          reason: string | null
          reason_code: string | null
          rehab_debt_service: number | null
          rent_to_owner: number | null
          tenant_rent: number | null
          total_family_members: number | null
          total_tenant_payment: number | null
          ttp_basis: string | null
          updated_at: string
          user_id: string
          utility_allowance: number
          utility_reimbursement: number | null
          welfare_housing_amount: number | null
        }
        Insert: {
          adjusted_income?: number | null
          alternative_non_public_housing_rent?: number | null
          alternative_non_public_housing_rent_applicable?: boolean
          annual_income: number
          calculated_at?: string | null
          calculation_status?: string
          contract_rent_to_owner?: number | null
          created_at?: string
          current_base_rent?: number | null
          deductions?: number
          eligible_family_members?: number | null
          engine_build?: string
          family_action_id: string
          family_share?: number | null
          flat_rent_amount?: number | null
          gross_rent?: number | null
          housing_assistance_payment?: number | null
          id?: string
          minimum_rent?: number
          mixed_family_proration_applicable?: boolean
          mixed_family_total_tenant_payment?: number | null
          mod_rehab_source_validated?: boolean
          monthly_adjusted_income?: number | null
          monthly_income?: number | null
          normal_total_hap?: number | null
          payment_standard?: number | null
          program_code: string
          prorated_total_hap?: number | null
          proration_percentage?: number | null
          public_housing_rent_choice?: string | null
          reason?: string | null
          reason_code?: string | null
          rehab_debt_service?: number | null
          rent_to_owner?: number | null
          tenant_rent?: number | null
          total_family_members?: number | null
          total_tenant_payment?: number | null
          ttp_basis?: string | null
          updated_at?: string
          user_id?: string
          utility_allowance?: number
          utility_reimbursement?: number | null
          welfare_housing_amount?: number | null
        }
        Update: {
          adjusted_income?: number | null
          alternative_non_public_housing_rent?: number | null
          alternative_non_public_housing_rent_applicable?: boolean
          annual_income?: number
          calculated_at?: string | null
          calculation_status?: string
          contract_rent_to_owner?: number | null
          created_at?: string
          current_base_rent?: number | null
          deductions?: number
          eligible_family_members?: number | null
          engine_build?: string
          family_action_id?: string
          family_share?: number | null
          flat_rent_amount?: number | null
          gross_rent?: number | null
          housing_assistance_payment?: number | null
          id?: string
          minimum_rent?: number
          mixed_family_proration_applicable?: boolean
          mixed_family_total_tenant_payment?: number | null
          mod_rehab_source_validated?: boolean
          monthly_adjusted_income?: number | null
          monthly_income?: number | null
          normal_total_hap?: number | null
          payment_standard?: number | null
          program_code?: string
          prorated_total_hap?: number | null
          proration_percentage?: number | null
          public_housing_rent_choice?: string | null
          reason?: string | null
          reason_code?: string | null
          rehab_debt_service?: number | null
          rent_to_owner?: number | null
          tenant_rent?: number | null
          total_family_members?: number | null
          total_tenant_payment?: number | null
          ttp_basis?: string | null
          updated_at?: string
          user_id?: string
          utility_allowance?: number
          utility_reimbursement?: number | null
          welfare_housing_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pha_family_calculations_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: true
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_family_eiv_exceptions: {
        Row: {
          created_at: string
          exception_reason: string
          family_action_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exception_reason: string
          family_action_id: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          exception_reason?: string
          family_action_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_family_eiv_exceptions_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: true
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_family_evidence: {
        Row: {
          conflict_detected: boolean
          created_at: string
          evidence_type: string
          family_action_id: string
          id: string
          notes: string | null
          source_label: string
          user_id: string
          verified: boolean
        }
        Insert: {
          conflict_detected?: boolean
          created_at?: string
          evidence_type: string
          family_action_id: string
          id?: string
          notes?: string | null
          source_label: string
          user_id?: string
          verified?: boolean
        }
        Update: {
          conflict_detected?: boolean
          created_at?: string
          evidence_type?: string
          family_action_id?: string
          id?: string
          notes?: string | null
          source_label?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pha_family_evidence_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: false
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_family_notices: {
        Row: {
          created_at: string
          delivery_method: string | null
          determination_outcome: string | null
          determination_snapshot: Json
          family_action_id: string
          id: string
          issued_at: string | null
          legal_notice_snapshot: Json
          legal_profile_id: string | null
          legal_requirements_validated: boolean
          local_policy_overlay_status: string
          notice_summary: string | null
          notice_type: string
          response_deadline_at: string | null
          source_validated: boolean
          specific_reasons: string | null
          status: string
          template_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_method?: string | null
          determination_outcome?: string | null
          determination_snapshot?: Json
          family_action_id: string
          id?: string
          issued_at?: string | null
          legal_notice_snapshot?: Json
          legal_profile_id?: string | null
          legal_requirements_validated?: boolean
          local_policy_overlay_status?: string
          notice_summary?: string | null
          notice_type: string
          response_deadline_at?: string | null
          source_validated?: boolean
          specific_reasons?: string | null
          status?: string
          template_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          delivery_method?: string | null
          determination_outcome?: string | null
          determination_snapshot?: Json
          family_action_id?: string
          id?: string
          issued_at?: string | null
          legal_notice_snapshot?: Json
          legal_profile_id?: string | null
          legal_requirements_validated?: boolean
          local_policy_overlay_status?: string
          notice_summary?: string | null
          notice_type?: string
          response_deadline_at?: string | null
          source_validated?: boolean
          specific_reasons?: string | null
          status?: string
          template_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_family_notices_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: false
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_family_notices_legal_profile_id_fkey"
            columns: ["legal_profile_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_requirement_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_hcv_hap_contracts: {
        Row: {
          created_at: string
          executed_at: string | null
          execution_deadline: string
          hud_extension_approval_reference: string | null
          hud_extension_approved: boolean
          hud_extension_request_reference: string | null
          hud_extension_requested_at: string | null
          id: string
          lease_start: string
          payment_authorized: boolean
          rfta_request_id: string
          source_snapshot: Json
          status: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          created_at?: string
          executed_at?: string | null
          execution_deadline: string
          hud_extension_approval_reference?: string | null
          hud_extension_approved?: boolean
          hud_extension_request_reference?: string | null
          hud_extension_requested_at?: string | null
          id?: string
          lease_start: string
          payment_authorized?: boolean
          rfta_request_id: string
          source_snapshot?: Json
          status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Update: {
          created_at?: string
          executed_at?: string | null
          execution_deadline?: string
          hud_extension_approval_reference?: string | null
          hud_extension_approved?: boolean
          hud_extension_request_reference?: string | null
          hud_extension_requested_at?: string | null
          id?: string
          lease_start?: string
          payment_authorized?: boolean
          rfta_request_id?: string
          source_snapshot?: Json
          status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_hcv_hap_contracts_rfta_request_id_fkey"
            columns: ["rfta_request_id"]
            isOneToOne: true
            referencedRelation: "pha_hcv_rfta_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_hcv_rfta_requests: {
        Row: {
          block_reason: string | null
          created_at: string
          decided_at: string | null
          decision_status: string
          family_share: number
          family_share_40_percent_clear: boolean
          gross_rent: number
          id: string
          initial_assistance: boolean
          inspection_clearance: string
          inspection_id: string | null
          lease_copy_received: boolean
          lease_executed: boolean
          monthly_adjusted_income: number
          owner_reference: string
          payment_standard: number
          proposed_lease_start: string
          rent_reasonable: boolean
          rent_to_owner: number
          source_snapshot: Json
          submitted_at: string
          tenancy_addendum_included: boolean
          unit_eligible: boolean
          unit_reference: string
          updated_at: string
          voucher_id: string
          workspace_user_id: string
        }
        Insert: {
          block_reason?: string | null
          created_at?: string
          decided_at?: string | null
          decision_status?: string
          family_share: number
          family_share_40_percent_clear?: boolean
          gross_rent: number
          id?: string
          initial_assistance?: boolean
          inspection_clearance?: string
          inspection_id?: string | null
          lease_copy_received?: boolean
          lease_executed?: boolean
          monthly_adjusted_income: number
          owner_reference: string
          payment_standard: number
          proposed_lease_start: string
          rent_reasonable?: boolean
          rent_to_owner: number
          source_snapshot?: Json
          submitted_at?: string
          tenancy_addendum_included?: boolean
          unit_eligible?: boolean
          unit_reference: string
          updated_at?: string
          voucher_id: string
          workspace_user_id?: string
        }
        Update: {
          block_reason?: string | null
          created_at?: string
          decided_at?: string | null
          decision_status?: string
          family_share?: number
          family_share_40_percent_clear?: boolean
          gross_rent?: number
          id?: string
          initial_assistance?: boolean
          inspection_clearance?: string
          inspection_id?: string | null
          lease_copy_received?: boolean
          lease_executed?: boolean
          monthly_adjusted_income?: number
          owner_reference?: string
          payment_standard?: number
          proposed_lease_start?: string
          rent_reasonable?: boolean
          rent_to_owner?: number
          source_snapshot?: Json
          submitted_at?: string
          tenancy_addendum_included?: boolean
          unit_eligible?: boolean
          unit_reference?: string
          updated_at?: string
          voucher_id?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_hcv_rfta_requests_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "pha_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_hcv_rfta_requests_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "pha_hcv_vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_hcv_vouchers: {
        Row: {
          administrative_plan_overlay_id: string
          created_at: string
          expires_at: string
          extension_expires_at: string | null
          family_action_id: string
          id: string
          issued_at: string
          source_snapshot: Json
          status: string
          updated_at: string
          voucher_number: string
          workspace_user_id: string
        }
        Insert: {
          administrative_plan_overlay_id: string
          created_at?: string
          expires_at: string
          extension_expires_at?: string | null
          family_action_id: string
          id?: string
          issued_at: string
          source_snapshot?: Json
          status?: string
          updated_at?: string
          voucher_number: string
          workspace_user_id?: string
        }
        Update: {
          administrative_plan_overlay_id?: string
          created_at?: string
          expires_at?: string
          extension_expires_at?: string | null
          family_action_id?: string
          id?: string
          issued_at?: string
          source_snapshot?: Json
          status?: string
          updated_at?: string
          voucher_number?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_hcv_vouchers_administrative_plan_overlay_id_fkey"
            columns: ["administrative_plan_overlay_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_policy_overlays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_hcv_vouchers_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: false
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_inspection_deficiencies: {
        Row: {
          corrected_at: string | null
          correction_due_at: string | null
          correction_verified: boolean
          created_at: string
          deficiency_reference: string | null
          evidence_reference: string | null
          failed: boolean
          id: string
          inspectable_area: string
          inspection_id: string
          notes: string | null
          severity: string | null
          standard_name: string
          updated_at: string
        }
        Insert: {
          corrected_at?: string | null
          correction_due_at?: string | null
          correction_verified?: boolean
          created_at?: string
          deficiency_reference?: string | null
          evidence_reference?: string | null
          failed?: boolean
          id?: string
          inspectable_area: string
          inspection_id: string
          notes?: string | null
          severity?: string | null
          standard_name: string
          updated_at?: string
        }
        Update: {
          corrected_at?: string | null
          correction_due_at?: string | null
          correction_verified?: boolean
          created_at?: string
          deficiency_reference?: string | null
          evidence_reference?: string | null
          failed?: boolean
          id?: string
          inspectable_area?: string
          inspection_id?: string
          notes?: string | null
          severity?: string | null
          standard_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_inspection_deficiencies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "pha_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_inspection_transition_profiles: {
        Row: {
          created_at: string
          current_standard: string
          hud_confirmation_reference: string | null
          hud_notification_status: string
          hud_notified_at: string | null
          id: string
          inspector_training_complete: boolean
          owner_family_notification_complete: boolean
          planned_nspire_date: string | null
          program_code: string
          source_authority: string
          source_status: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          created_at?: string
          current_standard: string
          hud_confirmation_reference?: string | null
          hud_notification_status?: string
          hud_notified_at?: string | null
          id?: string
          inspector_training_complete?: boolean
          owner_family_notification_complete?: boolean
          planned_nspire_date?: string | null
          program_code: string
          source_authority?: string
          source_status?: string
          updated_at?: string
          workspace_user_id: string
        }
        Update: {
          created_at?: string
          current_standard?: string
          hud_confirmation_reference?: string | null
          hud_notification_status?: string
          hud_notified_at?: string | null
          id?: string
          inspector_training_complete?: boolean
          owner_family_notification_complete?: boolean
          planned_nspire_date?: string | null
          program_code?: string
          source_authority?: string
          source_status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: []
      }
      pha_inspections: {
        Row: {
          created_at: string
          family_action_id: string | null
          id: string
          inspected_at: string | null
          inspection_type: string
          inspector_name: string | null
          parent_inspection_id: string | null
          program_code: string
          result: string
          scheduled_for: string | null
          standard_used: string
          transition_snapshot: Json
          unit_reference: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          created_at?: string
          family_action_id?: string | null
          id?: string
          inspected_at?: string | null
          inspection_type: string
          inspector_name?: string | null
          parent_inspection_id?: string | null
          program_code: string
          result?: string
          scheduled_for?: string | null
          standard_used: string
          transition_snapshot?: Json
          unit_reference: string
          updated_at?: string
          workspace_user_id?: string
        }
        Update: {
          created_at?: string
          family_action_id?: string | null
          id?: string
          inspected_at?: string | null
          inspection_type?: string
          inspector_name?: string | null
          parent_inspection_id?: string | null
          program_code?: string
          result?: string
          scheduled_for?: string | null
          standard_used?: string
          transition_snapshot?: Json
          unit_reference?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_inspections_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: false
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_inspections_parent_inspection_id_fkey"
            columns: ["parent_inspection_id"]
            isOneToOne: false
            referencedRelation: "pha_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_integration_profiles: {
        Row: {
          connection_reference: string | null
          created_at: string
          id: string
          integration_type: string
          last_health_check_at: string | null
          provider_name: string
          status: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_snapshot: Json
          workspace_user_id: string
        }
        Insert: {
          connection_reference?: string | null
          created_at?: string
          id?: string
          integration_type: string
          last_health_check_at?: string | null
          provider_name: string
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_snapshot?: Json
          workspace_user_id: string
        }
        Update: {
          connection_reference?: string | null
          created_at?: string
          id?: string
          integration_type?: string
          last_health_check_at?: string | null
          provider_name?: string
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_snapshot?: Json
          workspace_user_id?: string
        }
        Relationships: []
      }
      pha_mod_rehab_contracts: {
        Row: {
          contract_effective_date: string
          contract_end_date: string | null
          contract_reference: string
          created_at: string
          current_base_rent: number
          current_contract_rent: number
          id: string
          monthly_rehab_debt_service: number
          owner_reference: string
          policy_overlay_id: string
          project_reference: string
          source_status: string
          status: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          contract_effective_date: string
          contract_end_date?: string | null
          contract_reference: string
          created_at?: string
          current_base_rent: number
          current_contract_rent: number
          id?: string
          monthly_rehab_debt_service: number
          owner_reference: string
          policy_overlay_id: string
          project_reference: string
          source_status?: string
          status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Update: {
          contract_effective_date?: string
          contract_end_date?: string | null
          contract_reference?: string
          created_at?: string
          current_base_rent?: number
          current_contract_rent?: number
          id?: string
          monthly_rehab_debt_service?: number
          owner_reference?: string
          policy_overlay_id?: string
          project_reference?: string
          source_status?: string
          status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_mod_rehab_contracts_policy_overlay_id_fkey"
            columns: ["policy_overlay_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_policy_overlays"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_mod_rehab_hap_actions: {
        Row: {
          action_type: string
          approved_adjustment: number | null
          audited_financial_support: boolean
          block_reason: string | null
          contract_id: string
          created_at: string
          effective_date: string
          family_action_id: string | null
          hap_to_owner: number | null
          hud_field_office_approval: boolean
          id: string
          inspection_compliant: boolean
          requested_adjustment: number | null
          source_snapshot: Json
          status: string
          tenant_rent: number | null
          updated_at: string
          utility_reimbursement: number | null
        }
        Insert: {
          action_type: string
          approved_adjustment?: number | null
          audited_financial_support?: boolean
          block_reason?: string | null
          contract_id: string
          created_at?: string
          effective_date: string
          family_action_id?: string | null
          hap_to_owner?: number | null
          hud_field_office_approval?: boolean
          id?: string
          inspection_compliant?: boolean
          requested_adjustment?: number | null
          source_snapshot?: Json
          status?: string
          tenant_rent?: number | null
          updated_at?: string
          utility_reimbursement?: number | null
        }
        Update: {
          action_type?: string
          approved_adjustment?: number | null
          audited_financial_support?: boolean
          block_reason?: string | null
          contract_id?: string
          created_at?: string
          effective_date?: string
          family_action_id?: string | null
          hap_to_owner?: number | null
          hud_field_office_approval?: boolean
          id?: string
          inspection_compliant?: boolean
          requested_adjustment?: number | null
          source_snapshot?: Json
          status?: string
          tenant_rent?: number | null
          updated_at?: string
          utility_reimbursement?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pha_mod_rehab_hap_actions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "pha_mod_rehab_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_mod_rehab_hap_actions_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: false
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_notice_policy_overlays: {
        Row: {
          accessibility_requirements: Json
          active: boolean
          created_at: string
          delivery_requirements: Json
          effective_date: string
          hearing_request_deadline_rule: Json
          id: string
          language_access_requirements: Json
          policy_type: string
          policy_version: string
          program_code: string
          source_reference: string
          updated_at: string
          validated: boolean
          validated_at: string | null
          validated_by: string | null
          workspace_user_id: string
        }
        Insert: {
          accessibility_requirements?: Json
          active?: boolean
          created_at?: string
          delivery_requirements?: Json
          effective_date: string
          hearing_request_deadline_rule?: Json
          id?: string
          language_access_requirements?: Json
          policy_type: string
          policy_version: string
          program_code: string
          source_reference: string
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
          workspace_user_id: string
        }
        Update: {
          accessibility_requirements?: Json
          active?: boolean
          created_at?: string
          delivery_requirements?: Json
          effective_date?: string
          hearing_request_deadline_rule?: Json
          id?: string
          language_access_requirements?: Json
          policy_type?: string
          policy_version?: string
          program_code?: string
          source_reference?: string
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
          workspace_user_id?: string
        }
        Relationships: []
      }
      pha_notice_requirement_profiles: {
        Row: {
          action_type: string
          active: boolean
          authority_code: string
          authority_url: string
          created_at: string
          determination_outcome: string
          effective_from: string
          effective_to: string | null
          federal_timing_rule: Json
          id: string
          program_code: string
          required_elements: Json
          requires_local_policy_overlay: boolean
          rights_snapshot: Json
          source_status: string
          updated_at: string
        }
        Insert: {
          action_type: string
          active?: boolean
          authority_code: string
          authority_url: string
          created_at?: string
          determination_outcome: string
          effective_from?: string
          effective_to?: string | null
          federal_timing_rule?: Json
          id?: string
          program_code: string
          required_elements?: Json
          requires_local_policy_overlay?: boolean
          rights_snapshot?: Json
          source_status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          active?: boolean
          authority_code?: string
          authority_url?: string
          created_at?: string
          determination_outcome?: string
          effective_from?: string
          effective_to?: string | null
          federal_timing_rule?: Json
          id?: string
          program_code?: string
          required_elements?: Json
          requires_local_policy_overlay?: boolean
          rights_snapshot?: Json
          source_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pha_nspire_deficiency_standards: {
        Row: {
          active: boolean
          correction_hours: number
          created_at: string
          deficiency_description: string
          deficiency_reference: string
          effective_from: string
          effective_to: string | null
          hcv_correction_hours: number | null
          hcv_pass_fail: string
          id: string
          inspectable_area: string
          release_id: string | null
          severity: string
          source_checksum: string | null
          source_status: string
          source_url: string
          source_version: string
          standard_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          correction_hours: number
          created_at?: string
          deficiency_description: string
          deficiency_reference: string
          effective_from: string
          effective_to?: string | null
          hcv_correction_hours?: number | null
          hcv_pass_fail: string
          id?: string
          inspectable_area: string
          release_id?: string | null
          severity: string
          source_checksum?: string | null
          source_status?: string
          source_url: string
          source_version: string
          standard_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          correction_hours?: number
          created_at?: string
          deficiency_description?: string
          deficiency_reference?: string
          effective_from?: string
          effective_to?: string | null
          hcv_correction_hours?: number | null
          hcv_pass_fail?: string
          id?: string
          inspectable_area?: string
          release_id?: string | null
          severity?: string
          source_checksum?: string | null
          source_status?: string
          source_url?: string
          source_version?: string
          standard_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pha_nspire_release_attestations: {
        Row: {
          attested_at: string
          attested_sha256: string
          id: string
          release_id: string
          verifier_id: string
        }
        Insert: {
          attested_at?: string
          attested_sha256: string
          id?: string
          release_id: string
          verifier_id: string
        }
        Update: {
          attested_at?: string
          attested_sha256?: string
          id?: string
          release_id?: string
          verifier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_nspire_release_attestations_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "pha_nspire_standard_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_nspire_source_artifacts: {
        Row: {
          artifact_name: string
          artifact_type: string
          byte_size: number | null
          created_at: string
          id: string
          import_status: string
          parsed_row_count: number
          release_id: string
          sha256: string | null
          source_url: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          artifact_name: string
          artifact_type: string
          byte_size?: number | null
          created_at?: string
          id?: string
          import_status?: string
          parsed_row_count?: number
          release_id: string
          sha256?: string | null
          source_url: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          artifact_name?: string
          artifact_type?: string
          byte_size?: number | null
          created_at?: string
          id?: string
          import_status?: string
          parsed_row_count?: number
          release_id?: string
          sha256?: string | null
          source_url?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pha_nspire_source_artifacts_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "pha_nspire_standard_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_nspire_standard_releases: {
        Row: {
          activated_at: string | null
          bundle_url: string | null
          created_at: string
          expected_deficiency_count: number | null
          expected_standard_count: number | null
          id: string
          import_completed_at: string | null
          imported_deficiency_count: number
          imported_standard_count: number
          notes: string | null
          published_date: string | null
          release_key: string
          source_checksum: string | null
          source_url: string
          source_version: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          activated_at?: string | null
          bundle_url?: string | null
          created_at?: string
          expected_deficiency_count?: number | null
          expected_standard_count?: number | null
          id?: string
          import_completed_at?: string | null
          imported_deficiency_count?: number
          imported_standard_count?: number
          notes?: string | null
          published_date?: string | null
          release_key: string
          source_checksum?: string | null
          source_url: string
          source_version: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          activated_at?: string | null
          bundle_url?: string | null
          created_at?: string
          expected_deficiency_count?: number | null
          expected_standard_count?: number | null
          id?: string
          import_completed_at?: string | null
          imported_deficiency_count?: number
          imported_standard_count?: number
          notes?: string | null
          published_date?: string | null
          release_key?: string
          source_checksum?: string | null
          source_url?: string
          source_version?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      pha_pbv_hap_contracts: {
        Row: {
          administrative_plan_overlay_id: string
          annual_anniversary: string
          contract_reference: string
          created_at: string
          effective_date: string
          id: string
          owner_reference: string
          project_reference: string
          rent_adjustment_method: string
          status: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          administrative_plan_overlay_id: string
          annual_anniversary: string
          contract_reference: string
          created_at?: string
          effective_date: string
          id?: string
          owner_reference: string
          project_reference: string
          rent_adjustment_method: string
          status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Update: {
          administrative_plan_overlay_id?: string
          annual_anniversary?: string
          contract_reference?: string
          created_at?: string
          effective_date?: string
          id?: string
          owner_reference?: string
          project_reference?: string
          rent_adjustment_method?: string
          status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_pbv_hap_contracts_administrative_plan_overlay_id_fkey"
            columns: ["administrative_plan_overlay_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_policy_overlays"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_pbv_move_requests: {
        Row: {
          assistance_offer_type: string | null
          assisted_lease_start: string
          created_at: string
          family_action_id: string
          id: string
          offer_status: string
          one_year_requirement_satisfied: boolean
          owner_notice_documented: boolean
          request_received_at: string
          updated_at: string
          vawa_emergency_transfer: boolean
          workspace_user_id: string
        }
        Insert: {
          assistance_offer_type?: string | null
          assisted_lease_start: string
          created_at?: string
          family_action_id: string
          id?: string
          offer_status?: string
          one_year_requirement_satisfied?: boolean
          owner_notice_documented?: boolean
          request_received_at?: string
          updated_at?: string
          vawa_emergency_transfer?: boolean
          workspace_user_id?: string
        }
        Update: {
          assistance_offer_type?: string | null
          assisted_lease_start?: string
          created_at?: string
          family_action_id?: string
          id?: string
          offer_status?: string
          one_year_requirement_satisfied?: boolean
          owner_notice_documented?: boolean
          request_received_at?: string
          updated_at?: string
          vawa_emergency_transfer?: boolean
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_pbv_move_requests_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: false
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_pbv_rent_actions: {
        Row: {
          action_type: string
          applicable_cap: number | null
          approved_rent: number | null
          block_reason: string | null
          created_at: string
          determination_status: string
          effective_date: string | null
          hap_contract_id: string
          hqs_compliant: boolean
          id: string
          owner_request_received_at: string | null
          reasonable_rent: number | null
          requested_rent: number | null
          updated_at: string
          written_notice_issued: boolean
        }
        Insert: {
          action_type: string
          applicable_cap?: number | null
          approved_rent?: number | null
          block_reason?: string | null
          created_at?: string
          determination_status?: string
          effective_date?: string | null
          hap_contract_id: string
          hqs_compliant?: boolean
          id?: string
          owner_request_received_at?: string | null
          reasonable_rent?: number | null
          requested_rent?: number | null
          updated_at?: string
          written_notice_issued?: boolean
        }
        Update: {
          action_type?: string
          applicable_cap?: number | null
          approved_rent?: number | null
          block_reason?: string | null
          created_at?: string
          determination_status?: string
          effective_date?: string | null
          hap_contract_id?: string
          hqs_compliant?: boolean
          id?: string
          owner_request_received_at?: string | null
          reasonable_rent?: number | null
          requested_rent?: number | null
          updated_at?: string
          written_notice_issued?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pha_pbv_rent_actions_hap_contract_id_fkey"
            columns: ["hap_contract_id"]
            isOneToOne: false
            referencedRelation: "pha_pbv_hap_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_pbv_waiting_list_applicants: {
        Row: {
          absolute_preference: boolean
          accessibility_features: string[]
          applied_at: string
          created_at: string
          family_reference: string
          final_eligibility_determined_at: string | null
          final_pha_eligibility_status: string
          id: string
          in_place_family: boolean
          preference_priority: number
          preference_verified: boolean
          preliminary_eligibility_status: string
          removal_reason: string | null
          selected_at: string | null
          status: string
          ttp_less_than_gross_rent: boolean | null
          unit_offer_allowed: boolean
          updated_at: string
          waiting_list_id: string
        }
        Insert: {
          absolute_preference?: boolean
          accessibility_features?: string[]
          applied_at?: string
          created_at?: string
          family_reference: string
          final_eligibility_determined_at?: string | null
          final_pha_eligibility_status?: string
          id?: string
          in_place_family?: boolean
          preference_priority?: number
          preference_verified?: boolean
          preliminary_eligibility_status?: string
          removal_reason?: string | null
          selected_at?: string | null
          status?: string
          ttp_less_than_gross_rent?: boolean | null
          unit_offer_allowed?: boolean
          updated_at?: string
          waiting_list_id: string
        }
        Update: {
          absolute_preference?: boolean
          accessibility_features?: string[]
          applied_at?: string
          created_at?: string
          family_reference?: string
          final_eligibility_determined_at?: string | null
          final_pha_eligibility_status?: string
          id?: string
          in_place_family?: boolean
          preference_priority?: number
          preference_verified?: boolean
          preliminary_eligibility_status?: string
          removal_reason?: string | null
          selected_at?: string | null
          status?: string
          ttp_less_than_gross_rent?: boolean | null
          unit_offer_allowed?: boolean
          updated_at?: string
          waiting_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_pbv_waiting_list_applicants_waiting_list_id_fkey"
            columns: ["waiting_list_id"]
            isOneToOne: false
            referencedRelation: "pha_pbv_waiting_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_pbv_waiting_list_decisions: {
        Row: {
          applicant_id: string
          created_at: string
          created_by: string
          decision_reason: string | null
          decision_type: string
          good_cause_claimed: boolean
          id: string
          informal_review_required: boolean
          informal_review_status: string
          notice_issued_at: string | null
          notice_required: boolean
          pbv_list_effect: string
          snapshot: Json
          tenant_based_list_protected: boolean
        }
        Insert: {
          applicant_id: string
          created_at?: string
          created_by?: string
          decision_reason?: string | null
          decision_type: string
          good_cause_claimed?: boolean
          id?: string
          informal_review_required?: boolean
          informal_review_status?: string
          notice_issued_at?: string | null
          notice_required?: boolean
          pbv_list_effect?: string
          snapshot?: Json
          tenant_based_list_protected?: boolean
        }
        Update: {
          applicant_id?: string
          created_at?: string
          created_by?: string
          decision_reason?: string | null
          decision_type?: string
          good_cause_claimed?: boolean
          id?: string
          informal_review_required?: boolean
          informal_review_status?: string
          notice_issued_at?: string | null
          notice_required?: boolean
          pbv_list_effect?: string
          snapshot?: Json
          tenant_based_list_protected?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pha_pbv_waiting_list_decisions_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "pha_pbv_waiting_list_applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_pbv_waiting_lists: {
        Row: {
          administrative_plan_overlay_id: string
          created_at: string
          good_cause_policy: string
          id: string
          list_name: string
          list_structure: string
          oversight_procedures: string | null
          owner_maintained: boolean
          owner_reference: string | null
          owner_waiting_list_policy_source_id: string | null
          preliminary_eligibility_actor: string
          project_reference: string | null
          public_notice_reference: string | null
          selection_method: string
          status: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          administrative_plan_overlay_id: string
          created_at?: string
          good_cause_policy: string
          id?: string
          list_name: string
          list_structure: string
          oversight_procedures?: string | null
          owner_maintained?: boolean
          owner_reference?: string | null
          owner_waiting_list_policy_source_id?: string | null
          preliminary_eligibility_actor?: string
          project_reference?: string | null
          public_notice_reference?: string | null
          selection_method?: string
          status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Update: {
          administrative_plan_overlay_id?: string
          created_at?: string
          good_cause_policy?: string
          id?: string
          list_name?: string
          list_structure?: string
          oversight_procedures?: string | null
          owner_maintained?: boolean
          owner_reference?: string | null
          owner_waiting_list_policy_source_id?: string | null
          preliminary_eligibility_actor?: string
          project_reference?: string | null
          public_notice_reference?: string | null
          selection_method?: string
          status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_pbv_waiting_lists_administrative_plan_overlay_id_fkey"
            columns: ["administrative_plan_overlay_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_policy_overlays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_pbv_waiting_lists_owner_waiting_list_policy_source_id_fkey"
            columns: ["owner_waiting_list_policy_source_id"]
            isOneToOne: false
            referencedRelation: "pha_source_library"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_portability_billing: {
        Row: {
          agreed_admin_fee: number | null
          billing_snapshot: Json
          billing_start_date: string | null
          calculated_admin_fee: number | null
          created_at: string
          financial_procedure_source_status: string
          id: string
          initial_billing_due_date: string | null
          initial_pha_admin_fee: number | null
          monthly_hap: number | null
          portability_case_id: string
          receiving_pha_admin_fee: number | null
          reimbursement_status: string
          updated_at: string
        }
        Insert: {
          agreed_admin_fee?: number | null
          billing_snapshot?: Json
          billing_start_date?: string | null
          calculated_admin_fee?: number | null
          created_at?: string
          financial_procedure_source_status?: string
          id?: string
          initial_billing_due_date?: string | null
          initial_pha_admin_fee?: number | null
          monthly_hap?: number | null
          portability_case_id: string
          receiving_pha_admin_fee?: number | null
          reimbursement_status?: string
          updated_at?: string
        }
        Update: {
          agreed_admin_fee?: number | null
          billing_snapshot?: Json
          billing_start_date?: string | null
          calculated_admin_fee?: number | null
          created_at?: string
          financial_procedure_source_status?: string
          id?: string
          initial_billing_due_date?: string | null
          initial_pha_admin_fee?: number | null
          monthly_hap?: number | null
          portability_case_id?: string
          receiving_pha_admin_fee?: number | null
          reimbursement_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_portability_billing_portability_case_id_fkey"
            columns: ["portability_case_id"]
            isOneToOne: true
            referencedRelation: "pha_portability_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_portability_cases: {
        Row: {
          absorption_decision: string
          absorption_decision_received_at: string | null
          absorption_decision_reference: string | null
          absorption_reversal_consent_reference: string | null
          authority_snapshot: Json
          created_at: string
          direction: string
          family_action_id: string
          family_request_date: string
          family_status: string
          hud_50058_reference: string | null
          hud_52665_part_i_complete: boolean
          hud_52665_reference: string | null
          id: string
          income_redetermination_required: boolean
          initial_pha_contact: string | null
          initial_pha_early_portability_approval: boolean
          initial_pha_name: string | null
          move_eligibility_status: string
          nonresident_first_12_months: boolean
          packet_delivery_reference: string | null
          packet_sent_at: string | null
          receiving_pha_contact: string | null
          receiving_pha_contact_delivery_reference: string | null
          receiving_pha_contacted_at: string | null
          receiving_pha_name: string | null
          receiving_pha_selected_by: string | null
          requested_destination: string
          special_purpose_voucher_code: string | null
          status: string
          updated_at: string
          vawa_portability_exception: boolean
          verification_packet_reference: string | null
          voucher_issued_for_move: boolean
          workspace_user_id: string
        }
        Insert: {
          absorption_decision?: string
          absorption_decision_received_at?: string | null
          absorption_decision_reference?: string | null
          absorption_reversal_consent_reference?: string | null
          authority_snapshot?: Json
          created_at?: string
          direction?: string
          family_action_id: string
          family_request_date: string
          family_status?: string
          hud_50058_reference?: string | null
          hud_52665_part_i_complete?: boolean
          hud_52665_reference?: string | null
          id?: string
          income_redetermination_required?: boolean
          initial_pha_contact?: string | null
          initial_pha_early_portability_approval?: boolean
          initial_pha_name?: string | null
          move_eligibility_status?: string
          nonresident_first_12_months?: boolean
          packet_delivery_reference?: string | null
          packet_sent_at?: string | null
          receiving_pha_contact?: string | null
          receiving_pha_contact_delivery_reference?: string | null
          receiving_pha_contacted_at?: string | null
          receiving_pha_name?: string | null
          receiving_pha_selected_by?: string | null
          requested_destination: string
          special_purpose_voucher_code?: string | null
          status?: string
          updated_at?: string
          vawa_portability_exception?: boolean
          verification_packet_reference?: string | null
          voucher_issued_for_move?: boolean
          workspace_user_id?: string
        }
        Update: {
          absorption_decision?: string
          absorption_decision_received_at?: string | null
          absorption_decision_reference?: string | null
          absorption_reversal_consent_reference?: string | null
          authority_snapshot?: Json
          created_at?: string
          direction?: string
          family_action_id?: string
          family_request_date?: string
          family_status?: string
          hud_50058_reference?: string | null
          hud_52665_part_i_complete?: boolean
          hud_52665_reference?: string | null
          id?: string
          income_redetermination_required?: boolean
          initial_pha_contact?: string | null
          initial_pha_early_portability_approval?: boolean
          initial_pha_name?: string | null
          move_eligibility_status?: string
          nonresident_first_12_months?: boolean
          packet_delivery_reference?: string | null
          packet_sent_at?: string | null
          receiving_pha_contact?: string | null
          receiving_pha_contact_delivery_reference?: string | null
          receiving_pha_contacted_at?: string | null
          receiving_pha_name?: string | null
          receiving_pha_selected_by?: string | null
          requested_destination?: string
          special_purpose_voucher_code?: string | null
          status?: string
          updated_at?: string
          vawa_portability_exception?: boolean
          verification_packet_reference?: string | null
          voucher_issued_for_move?: boolean
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_portability_cases_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: true
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_public_housing_admission_year_controls: {
        Row: {
          acop_overlay_id: string
          annual_plan_source_id: string | null
          created_at: string
          deconcentration_policy_reference: string | null
          fiscal_year: number
          hcv_eli_admissions: number
          hcv_excess_eli_admissions: number
          hcv_waiting_list_admissions: number
          id: string
          public_housing_eli_admissions: number
          public_housing_waiting_list_admissions: number
          qualifying_high_poverty_low_income_occupancies: number
          targeting_strategy_reference: string | null
          updated_at: string
          validated: boolean
          validated_at: string | null
          validated_by: string | null
          workspace_user_id: string
        }
        Insert: {
          acop_overlay_id: string
          annual_plan_source_id?: string | null
          created_at?: string
          deconcentration_policy_reference?: string | null
          fiscal_year: number
          hcv_eli_admissions?: number
          hcv_excess_eli_admissions?: number
          hcv_waiting_list_admissions?: number
          id?: string
          public_housing_eli_admissions?: number
          public_housing_waiting_list_admissions?: number
          qualifying_high_poverty_low_income_occupancies?: number
          targeting_strategy_reference?: string | null
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
          workspace_user_id?: string
        }
        Update: {
          acop_overlay_id?: string
          annual_plan_source_id?: string | null
          created_at?: string
          deconcentration_policy_reference?: string | null
          fiscal_year?: number
          hcv_eli_admissions?: number
          hcv_excess_eli_admissions?: number
          hcv_waiting_list_admissions?: number
          id?: string
          public_housing_eli_admissions?: number
          public_housing_waiting_list_admissions?: number
          qualifying_high_poverty_low_income_occupancies?: number
          targeting_strategy_reference?: string | null
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_public_housing_admission_year_co_annual_plan_source_id_fkey"
            columns: ["annual_plan_source_id"]
            isOneToOne: false
            referencedRelation: "pha_source_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_public_housing_admission_year_controls_acop_overlay_id_fkey"
            columns: ["acop_overlay_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_policy_overlays"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_public_housing_development_profiles: {
        Row: {
          active: boolean
          average_family_income: number | null
          covered_by_deconcentration: boolean
          created_at: string
          deconcentration_strategy: string | null
          designation_authority_reference: string | null
          development_reference: string
          established_income_range_status: string
          fiscal_year: number
          id: string
          occupancy_type: string
          special_accessibility_features: string[]
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          active?: boolean
          average_family_income?: number | null
          covered_by_deconcentration?: boolean
          created_at?: string
          deconcentration_strategy?: string | null
          designation_authority_reference?: string | null
          development_reference: string
          established_income_range_status?: string
          fiscal_year: number
          id?: string
          occupancy_type?: string
          special_accessibility_features?: string[]
          updated_at?: string
          workspace_user_id?: string
        }
        Update: {
          active?: boolean
          average_family_income?: number | null
          covered_by_deconcentration?: boolean
          created_at?: string
          deconcentration_strategy?: string | null
          designation_authority_reference?: string | null
          development_reference?: string
          established_income_range_status?: string
          fiscal_year?: number
          id?: string
          occupancy_type?: string
          special_accessibility_features?: string[]
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: []
      }
      pha_public_housing_leases: {
        Row: {
          acop_overlay_id: string
          created_at: string
          family_action_id: string
          grievance_procedure_included: boolean
          grievance_procedure_version: string | null
          id: string
          lease_document_reference: string | null
          lease_end: string | null
          lease_provisions_snapshot: Json
          lease_start: string
          pha_signed_at: string | null
          required_lease_provisions_confirmed: boolean
          signature_complete: boolean
          source_snapshot: Json
          status: string
          tenant_signed_at: string | null
          unit_offer_id: string | null
          unit_reference: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          acop_overlay_id: string
          created_at?: string
          family_action_id: string
          grievance_procedure_included?: boolean
          grievance_procedure_version?: string | null
          id?: string
          lease_document_reference?: string | null
          lease_end?: string | null
          lease_provisions_snapshot?: Json
          lease_start: string
          pha_signed_at?: string | null
          required_lease_provisions_confirmed?: boolean
          signature_complete?: boolean
          source_snapshot?: Json
          status?: string
          tenant_signed_at?: string | null
          unit_offer_id?: string | null
          unit_reference: string
          updated_at?: string
          workspace_user_id?: string
        }
        Update: {
          acop_overlay_id?: string
          created_at?: string
          family_action_id?: string
          grievance_procedure_included?: boolean
          grievance_procedure_version?: string | null
          id?: string
          lease_document_reference?: string | null
          lease_end?: string | null
          lease_provisions_snapshot?: Json
          lease_start?: string
          pha_signed_at?: string | null
          required_lease_provisions_confirmed?: boolean
          signature_complete?: boolean
          source_snapshot?: Json
          status?: string
          tenant_signed_at?: string | null
          unit_offer_id?: string | null
          unit_reference?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_public_housing_leases_acop_overlay_id_fkey"
            columns: ["acop_overlay_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_policy_overlays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_public_housing_leases_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: false
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_public_housing_leases_unit_offer_id_fkey"
            columns: ["unit_offer_id"]
            isOneToOne: false
            referencedRelation: "pha_public_housing_unit_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_public_housing_non_public_leases: {
        Row: {
          alternative_non_public_housing_rent: number
          created_at: string
          executed_at: string | null
          execution_due_date: string
          id: string
          late_execution_allowed_by_policy: boolean
          lease_presented_at: string
          next_lease_renewal_date: string | null
          over_income_case_id: string
          prior_public_housing_rent: number
          required_provisions_confirmed: boolean
          retroactive_difference_due: number
          source_snapshot: Json
          status: string
          tenancy_termination_deadline: string | null
          twenty_four_month_notice_id: string
          updated_at: string
        }
        Insert: {
          alternative_non_public_housing_rent: number
          created_at?: string
          executed_at?: string | null
          execution_due_date: string
          id?: string
          late_execution_allowed_by_policy?: boolean
          lease_presented_at: string
          next_lease_renewal_date?: string | null
          over_income_case_id: string
          prior_public_housing_rent: number
          required_provisions_confirmed?: boolean
          retroactive_difference_due?: number
          source_snapshot?: Json
          status?: string
          tenancy_termination_deadline?: string | null
          twenty_four_month_notice_id: string
          updated_at?: string
        }
        Update: {
          alternative_non_public_housing_rent?: number
          created_at?: string
          executed_at?: string | null
          execution_due_date?: string
          id?: string
          late_execution_allowed_by_policy?: boolean
          lease_presented_at?: string
          next_lease_renewal_date?: string | null
          over_income_case_id?: string
          prior_public_housing_rent?: number
          required_provisions_confirmed?: boolean
          retroactive_difference_due?: number
          source_snapshot?: Json
          status?: string
          tenancy_termination_deadline?: string | null
          twenty_four_month_notice_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_public_housing_non_public__twenty_four_month_notice_id_fkey"
            columns: ["twenty_four_month_notice_id"]
            isOneToOne: true
            referencedRelation: "pha_public_housing_over_income_notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_public_housing_non_public_leases_over_income_case_id_fkey"
            columns: ["over_income_case_id"]
            isOneToOne: true
            referencedRelation: "pha_public_housing_over_income_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_public_housing_over_income_cases: {
        Row: {
          acop_overlay_id: string
          alternative_rent: number | null
          consecutive_months: number
          created_at: string
          family_action_id: string
          first_over_income_determination: string
          id: string
          non_public_housing_lease_executed_at: string | null
          notice_stage: string
          over_income_limit: number
          pha_post_24_policy: string | null
          status: string
          termination_deadline: string | null
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          acop_overlay_id: string
          alternative_rent?: number | null
          consecutive_months?: number
          created_at?: string
          family_action_id: string
          first_over_income_determination: string
          id?: string
          non_public_housing_lease_executed_at?: string | null
          notice_stage?: string
          over_income_limit: number
          pha_post_24_policy?: string | null
          status?: string
          termination_deadline?: string | null
          updated_at?: string
          workspace_user_id?: string
        }
        Update: {
          acop_overlay_id?: string
          alternative_rent?: number | null
          consecutive_months?: number
          created_at?: string
          family_action_id?: string
          first_over_income_determination?: string
          id?: string
          non_public_housing_lease_executed_at?: string | null
          notice_stage?: string
          over_income_limit?: number
          pha_post_24_policy?: string | null
          status?: string
          termination_deadline?: string | null
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_public_housing_over_income_cases_acop_overlay_id_fkey"
            columns: ["acop_overlay_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_policy_overlays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_public_housing_over_income_cases_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: true
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_public_housing_over_income_notices: {
        Row: {
          alternative_rent_estimate: number | null
          created_at: string
          hearing_right_included: boolean
          id: string
          income_examination_date: string
          lease_presented: boolean
          notice_due_date: string
          notice_issued_at: string | null
          notice_stage: string
          over_income_case_id: string
          planned_termination_date: string | null
          post_24_action: string | null
          source_snapshot: Json
          state_local_termination_notice_reference: string | null
          updated_at: string
        }
        Insert: {
          alternative_rent_estimate?: number | null
          created_at?: string
          hearing_right_included?: boolean
          id?: string
          income_examination_date: string
          lease_presented?: boolean
          notice_due_date: string
          notice_issued_at?: string | null
          notice_stage: string
          over_income_case_id: string
          planned_termination_date?: string | null
          post_24_action?: string | null
          source_snapshot?: Json
          state_local_termination_notice_reference?: string | null
          updated_at?: string
        }
        Update: {
          alternative_rent_estimate?: number | null
          created_at?: string
          hearing_right_included?: boolean
          id?: string
          income_examination_date?: string
          lease_presented?: boolean
          notice_due_date?: string
          notice_issued_at?: string | null
          notice_stage?: string
          over_income_case_id?: string
          planned_termination_date?: string | null
          post_24_action?: string | null
          source_snapshot?: Json
          state_local_termination_notice_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_public_housing_over_income_notices_over_income_case_id_fkey"
            columns: ["over_income_case_id"]
            isOneToOne: false
            referencedRelation: "pha_public_housing_over_income_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_public_housing_rent_elections: {
        Row: {
          acop_overlay_id: string
          elected_at: string
          election_year: number
          family_action_id: string
          flat_rent: number
          hardship_review_required: boolean
          id: string
          income_based_rent: number
          notice_issued: boolean
          rent_option: string
          selected_rent: number
          workspace_user_id: string
        }
        Insert: {
          acop_overlay_id: string
          elected_at?: string
          election_year: number
          family_action_id: string
          flat_rent: number
          hardship_review_required?: boolean
          id?: string
          income_based_rent: number
          notice_issued?: boolean
          rent_option: string
          selected_rent: number
          workspace_user_id?: string
        }
        Update: {
          acop_overlay_id?: string
          elected_at?: string
          election_year?: number
          family_action_id?: string
          flat_rent?: number
          hardship_review_required?: boolean
          id?: string
          income_based_rent?: number
          notice_issued?: boolean
          rent_option?: string
          selected_rent?: number
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_public_housing_rent_elections_acop_overlay_id_fkey"
            columns: ["acop_overlay_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_policy_overlays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_public_housing_rent_elections_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: false
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_public_housing_transfers: {
        Row: {
          accommodation_request_id: string | null
          acop_overlay_id: string
          adverse_action_ground: string | null
          adverse_action_notice_id: string | null
          adverse_action_notice_issued_at: string | null
          appropriate_size_confirmed: boolean
          block_reason: string | null
          created_at: string
          current_unit_reference: string
          effective_date: string | null
          explanation_right_included: boolean
          grievance_request_deadline: string | null
          grievance_right_included: boolean
          grievance_status: string
          id: string
          is_adverse_action: boolean
          lease_id: string
          offered_unit_reference: string | null
          requested_at: string
          source_snapshot: Json
          status: string
          transfer_reason: string
          unit_available_confirmed: boolean
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          accommodation_request_id?: string | null
          acop_overlay_id: string
          adverse_action_ground?: string | null
          adverse_action_notice_id?: string | null
          adverse_action_notice_issued_at?: string | null
          appropriate_size_confirmed?: boolean
          block_reason?: string | null
          created_at?: string
          current_unit_reference: string
          effective_date?: string | null
          explanation_right_included?: boolean
          grievance_request_deadline?: string | null
          grievance_right_included?: boolean
          grievance_status?: string
          id?: string
          is_adverse_action?: boolean
          lease_id: string
          offered_unit_reference?: string | null
          requested_at?: string
          source_snapshot?: Json
          status?: string
          transfer_reason: string
          unit_available_confirmed?: boolean
          updated_at?: string
          workspace_user_id?: string
        }
        Update: {
          accommodation_request_id?: string | null
          acop_overlay_id?: string
          adverse_action_ground?: string | null
          adverse_action_notice_id?: string | null
          adverse_action_notice_issued_at?: string | null
          appropriate_size_confirmed?: boolean
          block_reason?: string | null
          created_at?: string
          current_unit_reference?: string
          effective_date?: string | null
          explanation_right_included?: boolean
          grievance_request_deadline?: string | null
          grievance_right_included?: boolean
          grievance_status?: string
          id?: string
          is_adverse_action?: boolean
          lease_id?: string
          offered_unit_reference?: string | null
          requested_at?: string
          source_snapshot?: Json
          status?: string
          transfer_reason?: string
          unit_available_confirmed?: boolean
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_public_housing_transfers_accommodation_request_id_fkey"
            columns: ["accommodation_request_id"]
            isOneToOne: false
            referencedRelation: "pha_reasonable_accommodation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_public_housing_transfers_acop_overlay_id_fkey"
            columns: ["acop_overlay_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_policy_overlays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_public_housing_transfers_adverse_action_notice_id_fkey"
            columns: ["adverse_action_notice_id"]
            isOneToOne: false
            referencedRelation: "pha_family_notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_public_housing_transfers_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "pha_public_housing_leases"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_public_housing_unit_offers: {
        Row: {
          admission_control_id: string
          applicant_id: string
          applicant_is_eli: boolean
          bedroom_count: number
          block_reason: string | null
          created_at: string
          deconcentration_status: string
          development_profile_id: string
          family_annual_income: number | null
          family_type: string
          final_selection_status: string
          id: string
          mixed_population_priority_satisfied: boolean
          no_higher_priority_accessibility_match_confirmed: boolean
          offer_date: string
          required_accessibility_features: string[]
          single_person: boolean
          source_snapshot: Json
          targeting_sequence_rationale: string | null
          targeting_status: string
          unit_accessibility_features: string[]
          unit_reference: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          admission_control_id: string
          applicant_id: string
          applicant_is_eli?: boolean
          bedroom_count: number
          block_reason?: string | null
          created_at?: string
          deconcentration_status?: string
          development_profile_id: string
          family_annual_income?: number | null
          family_type?: string
          final_selection_status?: string
          id?: string
          mixed_population_priority_satisfied?: boolean
          no_higher_priority_accessibility_match_confirmed?: boolean
          offer_date?: string
          required_accessibility_features?: string[]
          single_person?: boolean
          source_snapshot?: Json
          targeting_sequence_rationale?: string | null
          targeting_status?: string
          unit_accessibility_features?: string[]
          unit_reference: string
          updated_at?: string
          workspace_user_id?: string
        }
        Update: {
          admission_control_id?: string
          applicant_id?: string
          applicant_is_eli?: boolean
          bedroom_count?: number
          block_reason?: string | null
          created_at?: string
          deconcentration_status?: string
          development_profile_id?: string
          family_annual_income?: number | null
          family_type?: string
          final_selection_status?: string
          id?: string
          mixed_population_priority_satisfied?: boolean
          no_higher_priority_accessibility_match_confirmed?: boolean
          offer_date?: string
          required_accessibility_features?: string[]
          single_person?: boolean
          source_snapshot?: Json
          targeting_sequence_rationale?: string | null
          targeting_status?: string
          unit_accessibility_features?: string[]
          unit_reference?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_public_housing_unit_offers_admission_control_id_fkey"
            columns: ["admission_control_id"]
            isOneToOne: false
            referencedRelation: "pha_public_housing_admission_year_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_public_housing_unit_offers_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "pha_waiting_list_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_public_housing_unit_offers_development_profile_id_fkey"
            columns: ["development_profile_id"]
            isOneToOne: false
            referencedRelation: "pha_public_housing_development_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_reasonable_accommodation_requests: {
        Row: {
          alternative_accommodation: string | null
          communication_format: string | null
          completed_at: string | null
          created_at: string
          decision_at: string | null
          decision_by: string | null
          decision_reason: string | null
          disability_verification_required: boolean
          disability_verification_status: string
          effective_communication_required: boolean
          family_action_id: string | null
          id: string
          inspection_id: string | null
          interactive_process_notes: string | null
          nexus_verification_required: boolean
          nexus_verification_status: string
          program_code: string
          request_context: string
          requested_accommodation: string
          requested_at: string
          requester_reference: string
          source_authority: string
          source_status: string
          status: string
          undue_burden_or_fundamental_alteration: boolean
          updated_at: string
          waiting_list_applicant_id: string | null
          workspace_user_id: string
        }
        Insert: {
          alternative_accommodation?: string | null
          communication_format?: string | null
          completed_at?: string | null
          created_at?: string
          decision_at?: string | null
          decision_by?: string | null
          decision_reason?: string | null
          disability_verification_required?: boolean
          disability_verification_status?: string
          effective_communication_required?: boolean
          family_action_id?: string | null
          id?: string
          inspection_id?: string | null
          interactive_process_notes?: string | null
          nexus_verification_required?: boolean
          nexus_verification_status?: string
          program_code: string
          request_context: string
          requested_accommodation: string
          requested_at?: string
          requester_reference: string
          source_authority?: string
          source_status?: string
          status?: string
          undue_burden_or_fundamental_alteration?: boolean
          updated_at?: string
          waiting_list_applicant_id?: string | null
          workspace_user_id?: string
        }
        Update: {
          alternative_accommodation?: string | null
          communication_format?: string | null
          completed_at?: string | null
          created_at?: string
          decision_at?: string | null
          decision_by?: string | null
          decision_reason?: string | null
          disability_verification_required?: boolean
          disability_verification_status?: string
          effective_communication_required?: boolean
          family_action_id?: string | null
          id?: string
          inspection_id?: string | null
          interactive_process_notes?: string | null
          nexus_verification_required?: boolean
          nexus_verification_status?: string
          program_code?: string
          request_context?: string
          requested_accommodation?: string
          requested_at?: string
          requester_reference?: string
          source_authority?: string
          source_status?: string
          status?: string
          undue_burden_or_fundamental_alteration?: boolean
          updated_at?: string
          waiting_list_applicant_id?: string | null
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_reasonable_accommodation_req_waiting_list_applicant_id_fkey"
            columns: ["waiting_list_applicant_id"]
            isOneToOne: false
            referencedRelation: "pha_waiting_list_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_reasonable_accommodation_requests_family_action_id_fkey"
            columns: ["family_action_id"]
            isOneToOne: false
            referencedRelation: "pha_family_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_reasonable_accommodation_requests_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "pha_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_source_library: {
        Row: {
          authority_key: string
          checksum: string | null
          created_at: string
          effective_date: string | null
          id: string
          issuing_authority: string
          metadata: Json
          program_code: string | null
          source_reference: string
          source_scope: string
          source_type: string
          status: string
          title: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          version_label: string | null
          workspace_user_id: string | null
        }
        Insert: {
          authority_key: string
          checksum?: string | null
          created_at?: string
          effective_date?: string | null
          id?: string
          issuing_authority: string
          metadata?: Json
          program_code?: string | null
          source_reference: string
          source_scope: string
          source_type: string
          status?: string
          title: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          version_label?: string | null
          workspace_user_id?: string | null
        }
        Update: {
          authority_key?: string
          checksum?: string | null
          created_at?: string
          effective_date?: string | null
          id?: string
          issuing_authority?: string
          metadata?: Json
          program_code?: string | null
          source_reference?: string
          source_scope?: string
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          version_label?: string | null
          workspace_user_id?: string | null
        }
        Relationships: []
      }
      pha_verification_requirement_matrix: {
        Row: {
          action_type: string
          active: boolean
          created_at: string
          id: string
          program_code: string
          requirement_key: string
          satisfaction_mode: string
          source_authority_key: string
          updated_at: string
        }
        Insert: {
          action_type: string
          active?: boolean
          created_at?: string
          id?: string
          program_code: string
          requirement_key: string
          satisfaction_mode: string
          source_authority_key?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          active?: boolean
          created_at?: string
          id?: string
          program_code?: string
          requirement_key?: string
          satisfaction_mode?: string
          source_authority_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      pha_waiting_list_applicants: {
        Row: {
          accessibility_features_required: string | null
          applicant_name: string
          applicant_reference: string
          application_received_at: string
          created_at: string
          family_unit_size: number
          id: string
          preference_codes: string[]
          preference_priority: number
          preference_verified: boolean
          racial_ethnic_designation: string | null
          reasonable_accommodation_review_required: boolean
          reinstated_from_applicant_id: string | null
          removal_reason: string | null
          status: string
          updated_at: string
          waiting_list_id: string
        }
        Insert: {
          accessibility_features_required?: string | null
          applicant_name: string
          applicant_reference: string
          application_received_at: string
          created_at?: string
          family_unit_size: number
          id?: string
          preference_codes?: string[]
          preference_priority?: number
          preference_verified?: boolean
          racial_ethnic_designation?: string | null
          reasonable_accommodation_review_required?: boolean
          reinstated_from_applicant_id?: string | null
          removal_reason?: string | null
          status?: string
          updated_at?: string
          waiting_list_id: string
        }
        Update: {
          accessibility_features_required?: string | null
          applicant_name?: string
          applicant_reference?: string
          application_received_at?: string
          created_at?: string
          family_unit_size?: number
          id?: string
          preference_codes?: string[]
          preference_priority?: number
          preference_verified?: boolean
          racial_ethnic_designation?: string | null
          reasonable_accommodation_review_required?: boolean
          reinstated_from_applicant_id?: string | null
          removal_reason?: string | null
          status?: string
          updated_at?: string
          waiting_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_waiting_list_applicants_reinstated_from_applicant_id_fkey"
            columns: ["reinstated_from_applicant_id"]
            isOneToOne: false
            referencedRelation: "pha_waiting_list_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_waiting_list_applicants_waiting_list_id_fkey"
            columns: ["waiting_list_id"]
            isOneToOne: false
            referencedRelation: "pha_waiting_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_waiting_list_preferences: {
        Row: {
          active: boolean
          created_at: string
          id: string
          policy_rule_reference: string
          preference_code: string
          preference_label: string
          priority: number
          waiting_list_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          policy_rule_reference: string
          preference_code: string
          preference_label: string
          priority: number
          waiting_list_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          policy_rule_reference?: string
          preference_code?: string
          preference_label?: string
          priority?: number
          waiting_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_waiting_list_preferences_waiting_list_id_fkey"
            columns: ["waiting_list_id"]
            isOneToOne: false
            referencedRelation: "pha_waiting_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_waiting_list_selection_events: {
        Row: {
          applicant_id: string
          candidate_count: number
          candidate_snapshot: Json
          id: string
          policy_snapshot: Json
          preference_priority: number
          selected_at: string
          selected_by: string
          selection_method: string
          waiting_list_id: string
        }
        Insert: {
          applicant_id: string
          candidate_count: number
          candidate_snapshot: Json
          id?: string
          policy_snapshot: Json
          preference_priority: number
          selected_at?: string
          selected_by: string
          selection_method: string
          waiting_list_id: string
        }
        Update: {
          applicant_id?: string
          candidate_count?: number
          candidate_snapshot?: Json
          id?: string
          policy_snapshot?: Json
          preference_priority?: number
          selected_at?: string
          selected_by?: string
          selection_method?: string
          waiting_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_waiting_list_selection_events_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "pha_waiting_list_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pha_waiting_list_selection_events_waiting_list_id_fkey"
            columns: ["waiting_list_id"]
            isOneToOne: false
            referencedRelation: "pha_waiting_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_waiting_lists: {
        Row: {
          closed_at: string | null
          created_at: string
          geographic_scope: string
          id: string
          list_name: string
          opened_at: string | null
          policy_overlay_id: string
          program_code: string
          selection_method: string
          source_status: string
          status: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          geographic_scope?: string
          id?: string
          list_name: string
          opened_at?: string | null
          policy_overlay_id: string
          program_code: string
          selection_method: string
          source_status?: string
          status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          geographic_scope?: string
          id?: string
          list_name?: string
          opened_at?: string | null
          policy_overlay_id?: string
          program_code?: string
          selection_method?: string
          source_status?: string
          status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pha_waiting_lists_policy_overlay_id_fkey"
            columns: ["policy_overlay_id"]
            isOneToOne: false
            referencedRelation: "pha_notice_policy_overlays"
            referencedColumns: ["id"]
          },
        ]
      }
      pha_workspace_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          agency_role: string
          created_at: string
          created_by: string
          delivered_at: string | null
          delivery_attempt_count: number
          delivery_attempted_at: string | null
          delivery_error: string | null
          delivery_status: string
          expires_at: string
          id: string
          invite_email: string
          status: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_role: string
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          delivery_attempt_count?: number
          delivery_attempted_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          expires_at?: string
          id?: string
          invite_email: string
          status?: string
          updated_at?: string
          workspace_user_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_role?: string
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          delivery_attempt_count?: number
          delivery_attempted_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          expires_at?: string
          id?: string
          invite_email?: string
          status?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: []
      }
      pha_workspace_memberships: {
        Row: {
          active: boolean
          agency_role: string
          created_at: string
          created_by: string
          id: string
          member_user_id: string
          updated_at: string
          workspace_user_id: string
        }
        Insert: {
          active?: boolean
          agency_role: string
          created_at?: string
          created_by?: string
          id?: string
          member_user_id: string
          updated_at?: string
          workspace_user_id: string
        }
        Update: {
          active?: boolean
          agency_role?: string
          created_at?: string
          created_by?: string
          id?: string
          member_user_id?: string
          updated_at?: string
          workspace_user_id?: string
        }
        Relationships: []
      }
      pms_connections: {
        Row: {
          created_at: string
          credential_secret_name: string | null
          entity_mappings: Json
          id: string
          last_error: string | null
          last_successful_sync_at: string | null
          provider: string
          records_failed: number
          records_imported: number
          records_reconciled: number
          status: string
          sync_cursor: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_secret_name?: string | null
          entity_mappings?: Json
          id?: string
          last_error?: string | null
          last_successful_sync_at?: string | null
          provider: string
          records_failed?: number
          records_imported?: number
          records_reconciled?: number
          status?: string
          sync_cursor?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_secret_name?: string | null
          entity_mappings?: Json
          id?: string
          last_error?: string | null
          last_successful_sync_at?: string | null
          provider?: string
          records_failed?: number
          records_imported?: number
          records_reconciled?: number
          status?: string
          sync_cursor?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pms_sync_connections: {
        Row: {
          created_at: string
          credentials_secret_name: string | null
          cursor: string | null
          id: string
          last_error: string | null
          last_successful_sync_at: string | null
          provider: string
          records_failed: number
          records_imported: number
          records_reconciled: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials_secret_name?: string | null
          cursor?: string | null
          id?: string
          last_error?: string | null
          last_successful_sync_at?: string | null
          provider: string
          records_failed?: number
          records_imported?: number
          records_reconciled?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials_secret_name?: string | null
          cursor?: string | null
          id?: string
          last_error?: string | null
          last_successful_sync_at?: string | null
          provider?: string
          records_failed?: number
          records_imported?: number
          records_reconciled?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_readiness_snapshots: {
        Row: {
          at_risk_count: number
          audit_ready_count: number
          calculated_at: string
          critical_findings: number
          id: string
          metrics: Json
          open_corrective_actions: number
          portfolio_name: string | null
          property_count: number
          readiness_score: number
          user_id: string
        }
        Insert: {
          at_risk_count?: number
          audit_ready_count?: number
          calculated_at?: string
          critical_findings?: number
          id?: string
          metrics?: Json
          open_corrective_actions?: number
          portfolio_name?: string | null
          property_count?: number
          readiness_score?: number
          user_id: string
        }
        Update: {
          at_risk_count?: number
          audit_ready_count?: number
          calculated_at?: string
          critical_findings?: number
          id?: string
          metrics?: Json
          open_corrective_actions?: number
          portfolio_name?: string | null
          property_count?: number
          readiness_score?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      property_program_applicability: {
        Row: {
          building_id: string | null
          coverage_level: string
          created_at: string
          created_by: string
          effective_from: string | null
          effective_to: string | null
          id: string
          program_code: string
          property_id: string
          source_note: string | null
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          building_id?: string | null
          coverage_level?: string
          created_at?: string
          created_by?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          program_code: string
          property_id: string
          source_note?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          building_id?: string | null
          coverage_level?: string
          created_at?: string
          created_by?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          program_code?: string
          property_id?: string
          source_note?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      state_rule_pack_candidates: {
        Row: {
          agent_verification_required: boolean
          blocked_source_count: number
          candidate_manifest: Json
          compliance_activation_allowed: boolean
          created_at: string
          id: string
          inventory_generated_at: string
          source_candidate_count: number
          state_code: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_verification_required?: boolean
          blocked_source_count?: number
          candidate_manifest: Json
          compliance_activation_allowed?: boolean
          created_at?: string
          id?: string
          inventory_generated_at: string
          source_candidate_count: number
          state_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_verification_required?: boolean
          blocked_source_count?: number
          candidate_manifest?: Json
          compliance_activation_allowed?: boolean
          created_at?: string
          id?: string
          inventory_generated_at?: string
          source_candidate_count?: number
          state_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      state_rule_pack_releases: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          effective_from: string
          id: string
          limitations: string | null
          state_code: string
          status: Database["public"]["Enums"]["coverage_status"]
          updated_at: string
          validated_rule_count: number
          validation_report_id: string | null
          version: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          effective_from: string
          id?: string
          limitations?: string | null
          state_code: string
          status?: Database["public"]["Enums"]["coverage_status"]
          updated_at?: string
          validated_rule_count?: number
          validation_report_id?: string | null
          version: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          effective_from?: string
          id?: string
          limitations?: string | null
          state_code?: string
          status?: Database["public"]["Enums"]["coverage_status"]
          updated_at?: string
          validated_rule_count?: number
          validation_report_id?: string | null
          version?: string
        }
        Relationships: []
      }
      state_rule_source_candidates: {
        Row: {
          agent_verification_status: string
          authority_name: string
          candidate_status: string
          compliance_activation_allowed: boolean
          created_at: string
          exact_bytes_captured: boolean
          id: string
          inventory_generated_at: string
          official_domain: string
          origin_file: string
          program: string
          retrieved_at: string | null
          scope: string
          source_sha256: string | null
          source_type: string
          source_url: string
          state_code: string
          updated_at: string
          verification_evidence: Json
        }
        Insert: {
          agent_verification_status?: string
          authority_name: string
          candidate_status: string
          compliance_activation_allowed?: boolean
          created_at?: string
          exact_bytes_captured?: boolean
          id?: string
          inventory_generated_at: string
          official_domain: string
          origin_file: string
          program: string
          retrieved_at?: string | null
          scope: string
          source_sha256?: string | null
          source_type: string
          source_url: string
          state_code: string
          updated_at?: string
          verification_evidence?: Json
        }
        Update: {
          agent_verification_status?: string
          authority_name?: string
          candidate_status?: string
          compliance_activation_allowed?: boolean
          created_at?: string
          exact_bytes_captured?: boolean
          id?: string
          inventory_generated_at?: string
          official_domain?: string
          origin_file?: string
          program?: string
          retrieved_at?: string | null
          scope?: string
          source_sha256?: string | null
          source_type?: string
          source_url?: string
          state_code?: string
          updated_at?: string
          verification_evidence?: Json
        }
        Relationships: [
          {
            foreignKeyName: "state_rule_source_candidates_state_code_inventory_generate_fkey"
            columns: ["state_code", "inventory_generated_at"]
            isOneToOne: false
            referencedRelation: "state_rule_pack_candidates"
            referencedColumns: ["state_code", "inventory_generated_at"]
          },
        ]
      }
      state_rule_source_creation_events: {
        Row: {
          created_at: string
          creator_id: string
          evidence: Json
          id: string
          source_candidate_id: string
          source_type: string
          source_url: string
          state_code: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          evidence?: Json
          id?: string
          source_candidate_id: string
          source_type: string
          source_url: string
          state_code: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          evidence?: Json
          id?: string
          source_candidate_id?: string
          source_type?: string
          source_url?: string
          state_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_rule_source_creation_events_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "state_rule_source_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      state_rule_source_verification_events: {
        Row: {
          created_at: string
          decision: string
          evidence: Json
          id: string
          notes: string
          prior_status: string
          retrieved_at: string | null
          reviewer_id: string
          source_candidate_id: string
          source_sha256: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          evidence?: Json
          id?: string
          notes: string
          prior_status: string
          retrieved_at?: string | null
          reviewer_id: string
          source_candidate_id: string
          source_sha256?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          evidence?: Json
          id?: string
          notes?: string
          prior_status?: string
          retrieved_at?: string | null
          reviewer_id?: string
          source_candidate_id?: string
          source_sha256?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "state_rule_source_verification_events_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "state_rule_source_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      state_rule_sources: {
        Row: {
          authority_name: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          program: string
          published_at: string | null
          retrieved_at: string
          source_sha256: string
          source_url: string
          state_code: string
          updated_at: string
        }
        Insert: {
          authority_name: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          program: string
          published_at?: string | null
          retrieved_at?: string
          source_sha256: string
          source_url: string
          state_code: string
          updated_at?: string
        }
        Update: {
          authority_name?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          program?: string
          published_at?: string | null
          retrieved_at?: string
          source_sha256?: string
          source_url?: string
          state_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_processed_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_case_notes: {
        Row: {
          author_id: string | null
          author_name: string | null
          case_id: string
          created_at: string
          id: string
          internal: boolean
          note: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          case_id: string
          created_at?: string
          id?: string
          internal?: boolean
          note: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          case_id?: string
          created_at?: string
          id?: string
          internal?: boolean
          note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          account_id: string | null
          agent_confidence: number | null
          assigned_to: string | null
          case_number: string
          channel: string
          contact_id: string | null
          created_at: string
          description: string | null
          human_required: boolean
          id: string
          last_response_at: string | null
          priority: string
          source_email: string | null
          status: string
          subject: string
          supportiq_metadata: Json
          tags: string[] | null
          triage_category: string | null
          triage_disposition: string | null
          triage_priority: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          agent_confidence?: number | null
          assigned_to?: string | null
          case_number?: string
          channel?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          human_required?: boolean
          id?: string
          last_response_at?: string | null
          priority?: string
          source_email?: string | null
          status?: string
          subject: string
          supportiq_metadata?: Json
          tags?: string[] | null
          triage_category?: string | null
          triage_disposition?: string | null
          triage_priority?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          agent_confidence?: number | null
          assigned_to?: string | null
          case_number?: string
          channel?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          human_required?: boolean
          id?: string
          last_response_at?: string | null
          priority?: string
          source_email?: string | null
          status?: string
          subject?: string
          supportiq_metadata?: Json
          tags?: string[] | null
          triage_category?: string | null
          triage_disposition?: string | null
          triage_priority?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          ai_docs_billed: number
          ai_docs_used: number
          created_at: string
          environment: string
          id: string
          period_end: string | null
          period_start: string
          properties_used: number
          units_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_docs_billed?: number
          ai_docs_used?: number
          created_at?: string
          environment?: string
          id?: string
          period_end?: string | null
          period_start?: string
          properties_used?: number
          units_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_docs_billed?: number
          ai_docs_used?: number
          created_at?: string
          environment?: string
          id?: string
          period_end?: string | null
          period_start?: string
          properties_used?: number
          units_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      operations_health: {
        Row: {
          awaiting_approval: number | null
          checked_at: string | null
          healthy_running: number | null
          oldest_ready_job: string | null
          quarantined: number | null
          stale_running: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_pha_workspace_invitation: {
        Args: { target_invitation_id: string }
        Returns: string
      }
      activate_pha_nspire_standard_release: {
        Args: { target_release_id: string }
        Returns: undefined
      }
      assert_pha_policy_overlay: {
        Args: {
          target_overlay_id: string
          target_policy_type: string
          target_program: string
          target_workspace: string
        }
        Returns: undefined
      }
      attest_and_activate_pha_nspire_release: {
        Args: { expected_sha256: string; target_release_id: string }
        Returns: Json
      }
      build_pha_family_evidence_manifest: {
        Args: { target_family_action_id: string }
        Returns: Json
      }
      claim_certivoiq_founder_admin: { Args: never; Returns: Json }
      claim_crm_staff_invitation: { Args: never; Returns: Json }
      create_state_rule_source_candidate: {
        Args: {
          p_authority_name: string
          p_candidate_status?: string
          p_official_domain: string
          p_program: string
          p_scope: string
          p_source_type: string
          p_source_url: string
          p_state_code: string
        }
        Returns: Json
      }
      crm_staff_can_manage: { Args: { _user_id: string }; Returns: boolean }
      crm_staff_is_admin: { Args: { _user_id: string }; Returns: boolean }
      current_pha_workspace_user_id: { Args: never; Returns: string }
      derive_workspace_overlays: {
        Args: { pha_programs?: string[]; programs: string[] }
        Returns: string[]
      }
      generate_support_case_number: { Args: never; Returns: string }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pha_workspace_owner: {
        Args: { target_workspace_user_id: string }
        Returns: boolean
      }
      operations_approve: {
        Args: { _approval_id: string; _reason: string }
        Returns: {
          action_snapshot: Json
          action_type: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          expires_at: string
          id: string
          job_id: string
          reason: string | null
          requested_at: string
          requested_by: string
          snapshot_sha256: string
          status: Database["public"]["Enums"]["operations_approval_status"]
        }
        SetofOptions: {
          from: "*"
          to: "operations_approvals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      operations_claim_job: {
        Args: { _lease_seconds?: number; _worker: string }
        Returns: {
          attempts: number
          completed_at: string | null
          correlation_id: string
          created_at: string
          created_by: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          last_error: Json | null
          lease_expires_at: string | null
          lease_owner: string | null
          max_attempts: number
          payload: Json
          result: Json | null
          risk_tier: Database["public"]["Enums"]["operations_risk_tier"]
          scheduled_at: string
          source: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["operations_job_status"]
          updated_at: string
          worker: string
        }
        SetofOptions: {
          from: "*"
          to: "operations_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      operations_complete_job: {
        Args: { _job_id: string; _result?: Json; _worker: string }
        Returns: boolean
      }
      operations_fail_job: {
        Args: { _error: Json; _job_id: string; _worker: string }
        Returns: {
          attempts: number
          completed_at: string | null
          correlation_id: string
          created_at: string
          created_by: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          last_error: Json | null
          lease_expires_at: string | null
          lease_owner: string | null
          max_attempts: number
          payload: Json
          result: Json | null
          risk_tier: Database["public"]["Enums"]["operations_risk_tier"]
          scheduled_at: string
          source: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["operations_job_status"]
          updated_at: string
          worker: string
        }
        SetofOptions: {
          from: "*"
          to: "operations_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      operations_heartbeat: {
        Args: { _job_id: string; _lease_seconds?: number; _worker: string }
        Returns: boolean
      }
      operations_reap_stale_leases: { Args: never; Returns: number }
      operations_reject: {
        Args: { _approval_id: string; _reason: string }
        Returns: {
          action_snapshot: Json
          action_type: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          expires_at: string
          id: string
          job_id: string
          reason: string | null
          requested_at: string
          requested_by: string
          snapshot_sha256: string
          status: Database["public"]["Enums"]["operations_approval_status"]
        }
        SetofOptions: {
          from: "*"
          to: "operations_approvals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pha_family_access: {
        Args: { target_family_action_id: string; write_access?: boolean }
        Returns: boolean
      }
      pha_program_access: {
        Args: {
          target_program_code: string
          target_workspace_user_id: string
          write_access?: boolean
        }
        Returns: boolean
      }
      pha_workspace_admin_access: {
        Args: { target_workspace_user_id: string }
        Returns: boolean
      }
      prepare_pha_50058_submission: {
        Args: {
          requested_transport_mode?: string
          target_transaction_id: string
        }
        Returns: string
      }
      record_pha_50058_submission_event: {
        Args: {
          external_reference?: string
          new_response_code?: string
          new_response_message?: string
          new_status: string
          target_attempt_id: string
        }
        Returns: undefined
      }
      refresh_pha_authoritative_control_snapshots: {
        Args: { target_program_code?: string; target_user_id: string }
        Returns: undefined
      }
      refresh_pha_family_verification_state: {
        Args: { target_action_id: string; target_user_id: string }
        Returns: undefined
      }
      refresh_pha_nspire_release_counts: {
        Args: { target_release_id: string }
        Returns: undefined
      }
      review_state_rule_source_candidate: {
        Args: {
          p_candidate_id: string
          p_decision: string
          p_effective_date?: string
          p_notes?: string
          p_retrieved_at?: string
          p_source_sha256?: string
          p_supersession_notes?: string
        }
        Returns: Json
      }
      select_next_pha_waiting_list_applicant: {
        Args: { target_waiting_list_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "staff" | "user"
      correction_case_status:
        | "open"
        | "owner_responded"
        | "agency_review"
        | "accepted"
        | "reopened"
      coverage_status:
        | "federal_baseline"
        | "in_review"
        | "validated"
        | "suspended"
      crm_account_type: "enterprise" | "company"
      crm_stage:
        | "new"
        | "trialing"
        | "trial ended"
        | "negotiation"
        | "won"
        | "lost"
      hfa_submission_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "correction_required"
        | "accepted"
        | "withdrawn"
      operations_approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "expired"
        | "revoked"
      operations_communication_status:
        | "draft"
        | "approved"
        | "sending"
        | "sent"
        | "failed"
        | "cancelled"
      operations_incident_status:
        | "open"
        | "acknowledged"
        | "resolved"
        | "rolled_back"
      operations_job_status:
        | "queued"
        | "running"
        | "awaiting_approval"
        | "retry_wait"
        | "completed"
        | "failed"
        | "quarantined"
        | "cancelled"
      operations_risk_tier:
        | "tier_1_observe"
        | "tier_2_prepare"
        | "tier_3_reversible"
        | "tier_4_human_approval"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["staff", "user"],
      correction_case_status: [
        "open",
        "owner_responded",
        "agency_review",
        "accepted",
        "reopened",
      ],
      coverage_status: [
        "federal_baseline",
        "in_review",
        "validated",
        "suspended",
      ],
      crm_account_type: ["enterprise", "company"],
      crm_stage: [
        "new",
        "trialing",
        "trial ended",
        "negotiation",
        "won",
        "lost",
      ],
      hfa_submission_status: [
        "draft",
        "submitted",
        "in_review",
        "correction_required",
        "accepted",
        "withdrawn",
      ],
      operations_approval_status: [
        "pending",
        "approved",
        "rejected",
        "expired",
        "revoked",
      ],
      operations_communication_status: [
        "draft",
        "approved",
        "sending",
        "sent",
        "failed",
        "cancelled",
      ],
      operations_incident_status: [
        "open",
        "acknowledged",
        "resolved",
        "rolled_back",
      ],
      operations_job_status: [
        "queued",
        "running",
        "awaiting_approval",
        "retry_wait",
        "completed",
        "failed",
        "quarantined",
        "cancelled",
      ],
      operations_risk_tier: [
        "tier_1_observe",
        "tier_2_prepare",
        "tier_3_reversible",
        "tier_4_human_approval",
      ],
    },
  },
} as const
