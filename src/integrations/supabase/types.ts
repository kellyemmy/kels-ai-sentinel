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
      agent_logs: {
        Row: {
          agent_name: string | null
          id: string
          log_message: string | null
          metadata: Json | null
          step_status: string | null
          target_id: string | null
          timestamp: string | null
        }
        Insert: {
          agent_name?: string | null
          id?: string
          log_message?: string | null
          metadata?: Json | null
          step_status?: string | null
          target_id?: string | null
          timestamp?: string | null
        }
        Update: {
          agent_name?: string | null
          id?: string
          log_message?: string | null
          metadata?: Json | null
          step_status?: string | null
          target_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_logs_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      intercepted_requests: {
        Row: {
          body: string | null
          flag_note: string | null
          flagged: boolean | null
          headers: Json | null
          id: string
          method: string | null
          response_body: string | null
          response_headers: Json | null
          response_status: number | null
          target_id: string | null
          timestamp: string | null
          url: string | null
        }
        Insert: {
          body?: string | null
          flag_note?: string | null
          flagged?: boolean | null
          headers?: Json | null
          id?: string
          method?: string | null
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
          target_id?: string | null
          timestamp?: string | null
          url?: string | null
        }
        Update: {
          body?: string | null
          flag_note?: string | null
          flagged?: boolean | null
          headers?: Json | null
          id?: string
          method?: string | null
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
          target_id?: string | null
          timestamp?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intercepted_requests_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      targets: {
        Row: {
          created_at: string | null
          domain_url: string
          id: string
          notes: string | null
          status: string | null
          testing_profile: string | null
        }
        Insert: {
          created_at?: string | null
          domain_url: string
          id?: string
          notes?: string | null
          status?: string | null
          testing_profile?: string | null
        }
        Update: {
          created_at?: string | null
          domain_url?: string
          id?: string
          notes?: string | null
          status?: string | null
          testing_profile?: string | null
        }
        Relationships: []
      }
      vulnerabilities: {
        Row: {
          cvss_score: number | null
          description: string | null
          discovered_at: string | null
          id: string
          owasp_category: string | null
          proof_of_concept: string | null
          remediation: string | null
          severity: string | null
          status: string | null
          target_id: string | null
          title: string
        }
        Insert: {
          cvss_score?: number | null
          description?: string | null
          discovered_at?: string | null
          id?: string
          owasp_category?: string | null
          proof_of_concept?: string | null
          remediation?: string | null
          severity?: string | null
          status?: string | null
          target_id?: string | null
          title: string
        }
        Update: {
          cvss_score?: number | null
          description?: string | null
          discovered_at?: string | null
          id?: string
          owasp_category?: string | null
          proof_of_concept?: string | null
          remediation?: string | null
          severity?: string | null
          status?: string | null
          target_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "vulnerabilities_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
