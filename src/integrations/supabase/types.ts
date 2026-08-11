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
      active_timers: {
        Row: {
          calendar_id: string
          created_at: string
          id: string
          note: string | null
          paused_at: string | null
          paused_ms: number
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          id?: string
          note?: string | null
          paused_at?: string | null
          paused_ms?: number
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          id?: string
          note?: string | null
          paused_at?: string | null
          paused_ms?: number
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_timers_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_actions: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          event_id: string | null
          id: string
          tool_name: string
          user_id: string
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          event_id?: string | null
          id?: string
          tool_name: string
          user_id: string
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          event_id?: string | null
          id?: string
          tool_name?: string
          user_id?: string
        }
        Relationships: []
      }
      calendars: {
        Row: {
          aliases: string[]
          archived: boolean
          color: string
          created_at: string
          email_reminder: string
          hourly_rate: number | null
          ics_url: string | null
          id: string
          kind: string
          log_reminder_minutes: number | null
          name: string
          reminder_minutes: number | null
          source: string
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          aliases?: string[]
          archived?: boolean
          color?: string
          created_at?: string
          email_reminder?: string
          hourly_rate?: number | null
          ics_url?: string | null
          id?: string
          kind?: string
          log_reminder_minutes?: number | null
          name: string
          reminder_minutes?: number | null
          source?: string
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          aliases?: string[]
          archived?: boolean
          color?: string
          created_at?: string
          email_reminder?: string
          hourly_rate?: number | null
          ics_url?: string | null
          id?: string
          kind?: string
          log_reminder_minutes?: number | null
          name?: string
          reminder_minutes?: number | null
          source?: string
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          tool_call_id: string | null
          tool_calls: Json | null
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role: string
          tool_call_id?: string | null
          tool_calls?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          tool_call_id?: string | null
          tool_calls?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      dj_sets: {
        Row: {
          amount_sek: number
          created_at: string
          duration_hours: number | null
          event_id: string | null
          id: string
          notes: string | null
          set_date: string
          updated_at: string
          user_id: string
          venue: string
        }
        Insert: {
          amount_sek?: number
          created_at?: string
          duration_hours?: number | null
          event_id?: string | null
          id?: string
          notes?: string | null
          set_date: string
          updated_at?: string
          user_id: string
          venue: string
        }
        Update: {
          amount_sek?: number
          created_at?: string
          duration_hours?: number | null
          event_id?: string | null
          id?: string
          notes?: string | null
          set_date?: string
          updated_at?: string
          user_id?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "dj_sets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_overrides: {
        Row: {
          created_at: string
          event_id: string
          id: string
          occurrence_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          occurrence_date: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          occurrence_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          event_id: string
          id: string
          occurrence_date: string
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          event_id: string
          id?: string
          occurrence_date: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          event_id?: string
          id?: string
          occurrence_date?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          calendar_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          email_reminder: string | null
          end_at: string
          external_id: string | null
          id: string
          location: string | null
          reminder_minutes: number | null
          rrule: string | null
          start_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          calendar_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          email_reminder?: string | null
          end_at: string
          external_id?: string | null
          id?: string
          location?: string | null
          reminder_minutes?: number | null
          rrule?: string | null
          start_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          calendar_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          email_reminder?: string | null
          end_at?: string
          external_id?: string | null
          id?: string
          location?: string | null
          reminder_minutes?: number | null
          rrule?: string | null
          start_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_actions: {
        Row: {
          action_type: string
          confirmation_token: string
          confirmed_at: string | null
          created_at: string
          expires_at: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          action_type: string
          confirmation_token: string
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          payload: Json
          user_id: string
        }
        Update: {
          action_type?: string
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      work_logs: {
        Row: {
          calendar_id: string
          created_at: string
          hours: number
          id: string
          note: string | null
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          hours: number
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          hours?: number
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
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
