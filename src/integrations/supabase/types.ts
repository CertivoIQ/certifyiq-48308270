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
    PostgrestVersion: "14.15"
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
          extraction_provider: string | null
          id: string
          job_id: string
          mime_type: string
          original_file_name: string
          processed_at: string | null
          sha256: string | null
          size_bytes: number
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          extracted_data?: Json
          extraction_provider?: string | null
          id?: string
          job_id: string
          mime_type: string
          original_file_name: string
          processed_at?: string | null
          sha256?: string | null
          size_bytes: number
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          extracted_data?: Json
          extraction_provider?: string | null
          id?: string
          job_id?: string
          mime_type?: string
          original_file_name?: string
          processed_at?: string | null
          sha256?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string
          updated_at?: string
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          closed_won_at: string | null
          contract_verified_at: string | null
          corporate_email: string | null
          created_at: string
          created_by: string | null
          hq: string | null
          id: string
          is_demo: boolean
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
          payment_verified_at: string | null
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
          closed_won_at?: string | null
          contract_verified_at?: string | null
          corporate_email?: string | null
          created_at?: string
          created_by?: string | null
          hq?: string | null
          id?: string
          is_demo?: boolean
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
          payment_verified_at?: string | null
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
          closed_won_at?: string | null
          contract_verified_at?: string | null
          corporate_email?: string | null
          created_at?: string
          created_by?: string | null
          hq?: string | null
          id?: string
          is_demo?: boolean
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
          payment_verified_at?: string | null
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
      crm_post_sale_checklists: {
        Row: {
          account_id: string
          acknowledged_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          detected_at: string
          id: string
          status: string
          surfaced_at: string | null
          trigger_reason: string
          updated_at: string
        }
        Insert: {
          account_id: string
          acknowledged_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          detected_at?: string
          id?: string
          status?: string
          surfaced_at?: string | null
          trigger_reason: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          acknowledged_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          detected_at?: string
          id?: string
          status?: string
          surfaced_at?: string | null
          trigger_reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_post_sale_checklists_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "crm_accounts"
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
          revoked_at: string | null
          revoked_review_id: string | null
          reviewer_id: string
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
          revoked_at?: string | null
          revoked_review_id?: string | null
          reviewer_id: string
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
          revoked_at?: string | null
          revoked_review_id?: string | null
          reviewer_id?: string
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
            isOneToOne: true
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
          assigned_to: string | null
          case_number: string
          channel: string
          contact_id: string | null
          created_at: string
          description: string | null
          id: string
          last_response_at: string | null
          priority: string
          source_email: string | null
          status: string
          subject: string
          tags: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          assigned_to?: string | null
          case_number?: string
          channel?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_response_at?: string | null
          priority?: string
          source_email?: string | null
          status?: string
          subject: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          assigned_to?: string | null
          case_number?: string
          channel?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_response_at?: string | null
          priority?: string
          source_email?: string | null
          status?: string
          subject?: string
          tags?: string[] | null
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
      [_ in never]: never
    }
    Functions: {
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
    },
  },
} as const
