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
          environment: string
          files_purge_at: string | null
          files_purged_at: string | null
          launchpad_started_at: string | null
          plan_id: string | null
          price_id: string | null
          property_limit: number | null
          status: string
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
          environment?: string
          files_purge_at?: string | null
          files_purged_at?: string | null
          launchpad_started_at?: string | null
          plan_id?: string | null
          price_id?: string | null
          property_limit?: number | null
          status?: string
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
          environment?: string
          files_purge_at?: string | null
          files_purged_at?: string | null
          launchpad_started_at?: string | null
          plan_id?: string | null
          price_id?: string | null
          property_limit?: number | null
          status?: string
          trial_started_at?: string | null
          unit_limit?: number | null
          updated_at?: string
          user_id?: string
          welcome_sent_at?: string | null
        }
        Relationships: []
      }
      crm_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["crm_account_type"]
          arr: number
          created_at: string
          created_by: string | null
          hq: string | null
          id: string
          last_touch: string | null
          linkedin_url: string | null
          name: string
          notes: string | null
          owner: string | null
          plan: string | null
          reminders_sent: number
          source: string | null
          stage: Database["public"]["Enums"]["crm_stage"]
          trial_ended_on: string | null
          units: number
          updated_at: string
          website: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["crm_account_type"]
          arr?: number
          created_at?: string
          created_by?: string | null
          hq?: string | null
          id?: string
          last_touch?: string | null
          linkedin_url?: string | null
          name: string
          notes?: string | null
          owner?: string | null
          plan?: string | null
          reminders_sent?: number
          source?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          trial_ended_on?: string | null
          units?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["crm_account_type"]
          arr?: number
          created_at?: string
          created_by?: string | null
          hq?: string | null
          id?: string
          last_touch?: string | null
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          owner?: string | null
          plan?: string | null
          reminders_sent?: number
          source?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          trial_ended_on?: string | null
          units?: number
          updated_at?: string
          website?: string | null
        }
        Relationships: []
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
      crm_account_type: "enterprise" | "company"
      crm_stage:
        | "new"
        | "trialing"
        | "trial ended"
        | "negotiation"
        | "won"
        | "lost"
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
      crm_account_type: ["enterprise", "company"],
      crm_stage: [
        "new",
        "trialing",
        "trial ended",
        "negotiation",
        "won",
        "lost",
      ],
    },
  },
} as const
