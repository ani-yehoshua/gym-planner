export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bodyweight_logs: {
        Row: {
          date: string
          id: string
          note: string | null
          user_id: string
          weight: number
        }
        Insert: {
          date: string
          id?: string
          note?: string | null
          user_id: string
          weight: number
        }
        Update: {
          date?: string
          id?: string
          note?: string | null
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "bodyweight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_exercise_notes: {
        Row: {
          note: string
          planned_day_exercise_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          note?: string
          planned_day_exercise_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          note?: string
          planned_day_exercise_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category: Database["public"]["Enums"]["muscle_category"]
          created_at: string
          created_by: string | null
          default_rep_max: number | null
          default_rep_min: number | null
          default_sets: number | null
          howto_text: string | null
          id: string
          is_public: boolean
          media_url: string | null
          name: string
          primary_muscles: Database["public"]["Enums"]["muscle_group"][]
          secondary_muscles: Database["public"]["Enums"]["muscle_group"][]
        }
        Insert: {
          category: Database["public"]["Enums"]["muscle_category"]
          created_at?: string
          created_by?: string | null
          default_rep_max?: number | null
          default_rep_min?: number | null
          default_sets?: number | null
          howto_text?: string | null
          id?: string
          is_public?: boolean
          media_url?: string | null
          name: string
          primary_muscles?: Database["public"]["Enums"]["muscle_group"][]
          secondary_muscles?: Database["public"]["Enums"]["muscle_group"][]
        }
        Update: {
          category?: Database["public"]["Enums"]["muscle_category"]
          created_at?: string
          created_by?: string | null
          default_rep_max?: number | null
          default_rep_min?: number | null
          default_sets?: number | null
          howto_text?: string | null
          id?: string
          is_public?: boolean
          media_url?: string | null
          name?: string
          primary_muscles?: Database["public"]["Enums"]["muscle_group"][]
          secondary_muscles?: Database["public"]["Enums"]["muscle_group"][]
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invite_type: Database["public"]["Enums"]["party_invite_type"]
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_type?: Database["public"]["Enums"]["party_invite_type"]
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_type?: Database["public"]["Enums"]["party_invite_type"]
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      party_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          party_id: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          party_id: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          party_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "party_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_invites_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_members: {
        Row: {
          joined_at: string
          party_id: string
          role: Database["public"]["Enums"]["party_role"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          party_id: string
          role?: Database["public"]["Enums"]["party_role"]
          user_id: string
        }
        Update: {
          joined_at?: string
          party_id?: string
          role?: Database["public"]["Enums"]["party_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_members_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_day_exercises: {
        Row: {
          added_by: string | null
          created_at: string
          exercise_id: string
          id: string
          planned_day_id: string
          sort: number
          target_rep_max: number | null
          target_rep_min: number | null
          target_sets: number | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          exercise_id: string
          id?: string
          planned_day_id: string
          sort?: number
          target_rep_max?: number | null
          target_rep_min?: number | null
          target_sets?: number | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          exercise_id?: string
          id?: string
          planned_day_id?: string
          sort?: number
          target_rep_max?: number | null
          target_rep_min?: number | null
          target_sets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planned_day_exercises_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_day_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_day_exercises_planned_day_id_fkey"
            columns: ["planned_day_id"]
            isOneToOne: false
            referencedRelation: "planned_days"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_days: {
        Row: {
          category: Database["public"]["Enums"]["muscle_category"] | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          label: string | null
          owner_user: string | null
          party_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["muscle_category"] | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          label?: string | null
          owner_user?: string | null
          party_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["muscle_category"] | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          label?: string | null
          owner_user?: string | null
          party_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planned_days_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_days_owner_user_fkey"
            columns: ["owner_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_days_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarded_at: string | null
          timezone: string
          units: Database["public"]["Enums"]["unit_system"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          timezone?: string
          units?: Database["public"]["Enums"]["unit_system"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          timezone?: string
          units?: Database["public"]["Enums"]["unit_system"]
        }
        Relationships: []
      }
      schedule_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_weeks: number
          description: string | null
          id: string
          is_global: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_weeks?: number
          description?: string | null
          id?: string
          is_global?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_weeks?: number
          description?: string | null
          id?: string
          is_global?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      set_logs: {
        Row: {
          id: string
          logged_at: string
          notes: string | null
          planned_day_exercise_id: string
          reps: number | null
          rpe: number | null
          set_no: number
          user_id: string
          volume: number | null
          weight: number | null
        }
        Insert: {
          id?: string
          logged_at?: string
          notes?: string | null
          planned_day_exercise_id: string
          reps?: number | null
          rpe?: number | null
          set_no: number
          user_id: string
          volume?: number | null
          weight?: number | null
        }
        Update: {
          id?: string
          logged_at?: string
          notes?: string | null
          planned_day_exercise_id?: string
          reps?: number | null
          rpe?: number | null
          set_no?: number
          user_id?: string
          volume?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_planned_day_exercise_id_fkey"
            columns: ["planned_day_exercise_id"]
            isOneToOne: false
            referencedRelation: "planned_day_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_day_exercises: {
        Row: {
          exercise_id: string
          id: string
          rep_max: number | null
          rep_min: number | null
          sets: number | null
          sort: number
          template_day_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          rep_max?: number | null
          rep_min?: number | null
          sets?: number | null
          sort?: number
          template_day_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          rep_max?: number | null
          rep_min?: number | null
          sets?: number | null
          sort?: number
          template_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_day_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_day_exercises_template_day_id_fkey"
            columns: ["template_day_id"]
            isOneToOne: false
            referencedRelation: "template_days"
            referencedColumns: ["id"]
          },
        ]
      }
      template_days: {
        Row: {
          category: Database["public"]["Enums"]["muscle_category"]
          id: string
          label: string | null
          position: number
          sort: number
          template_id: string
          weekday: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["muscle_category"]
          id?: string
          label?: string | null
          position?: number
          sort?: number
          template_id: string
          weekday?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["muscle_category"]
          id?: string
          label?: string | null
          position?: number
          sort?: number
          template_id?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "template_days_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "schedule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_constants: {
        Row: {
          calorie_target: number | null
          current_bodyweight: number | null
          experience: Database["public"]["Enums"]["experience_level"] | null
          focus_muscles: Database["public"]["Enums"]["muscle_group"][]
          primary_goal: string | null
          protein_target: number | null
          target_bodyweight: number | null
          updated_at: string
          user_id: string
          weekly_gain_target: number | null
          weekly_set_targets: Json
        }
        Insert: {
          calorie_target?: number | null
          current_bodyweight?: number | null
          experience?: Database["public"]["Enums"]["experience_level"] | null
          focus_muscles?: Database["public"]["Enums"]["muscle_group"][]
          primary_goal?: string | null
          protein_target?: number | null
          target_bodyweight?: number | null
          updated_at?: string
          user_id: string
          weekly_gain_target?: number | null
          weekly_set_targets?: Json
        }
        Update: {
          calorie_target?: number | null
          current_bodyweight?: number | null
          experience?: Database["public"]["Enums"]["experience_level"] | null
          focus_muscles?: Database["public"]["Enums"]["muscle_group"][]
          primary_goal?: string | null
          protein_target?: number | null
          target_bodyweight?: number | null
          updated_at?: string
          user_id?: string
          weekly_gain_target?: number | null
          weekly_set_targets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_constants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_exercise_prefs: {
        Row: {
          default_rep_max: number | null
          default_rep_min: number | null
          default_sets: number | null
          exercise_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          default_rep_max?: number | null
          default_rep_min?: number | null
          default_sets?: number | null
          exercise_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          default_rep_max?: number | null
          default_rep_min?: number | null
          default_sets?: number | null
          exercise_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      is_party_member: { Args: { p_party: string }; Returns: boolean }
      is_party_owner: { Args: { p_party: string }; Returns: boolean }
      join_party_with_code: { Args: { p_code: string }; Returns: string }
    }
    Enums: {
      experience_level: "beginner" | "returning" | "intermediate" | "advanced"
      muscle_category:
        | "push"
        | "pull"
        | "legs"
        | "upper"
        | "lower"
        | "full_body"
        | "core"
        | "cardio"
        | "custom"
        | "rest"
        | "chest"
        | "back"
        | "shoulders"
        | "arms"
      muscle_group:
        | "chest"
        | "back"
        | "lats"
        | "traps"
        | "shoulders"
        | "front_delts"
        | "side_delts"
        | "rear_delts"
        | "biceps"
        | "triceps"
        | "forearms"
        | "quads"
        | "hamstrings"
        | "glutes"
        | "calves"
        | "adductors"
        | "abs"
        | "lower_back"
        | "neck"
        | "cardio"
        | "full_body"
        | "other"
      party_invite_type: "open" | "invite_only"
      party_role: "owner" | "member"
      unit_system: "lb" | "kg"
    }
    CompositeTypes: { [_ in never]: never }
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

export const Constants = {
  public: {
    Enums: {
      experience_level: ["beginner", "returning", "intermediate", "advanced"],
      muscle_category: [
        "push",
        "pull",
        "legs",
        "upper",
        "lower",
        "full_body",
        "core",
        "cardio",
        "custom",
        "rest",
      ],
      muscle_group: [
        "chest",
        "back",
        "lats",
        "traps",
        "shoulders",
        "front_delts",
        "side_delts",
        "rear_delts",
        "biceps",
        "triceps",
        "forearms",
        "quads",
        "hamstrings",
        "glutes",
        "calves",
        "adductors",
        "abs",
        "lower_back",
        "neck",
        "cardio",
        "full_body",
        "other",
      ],
      party_invite_type: ["open", "invite_only"],
      party_role: ["owner", "member"],
      unit_system: ["lb", "kg"],
    },
  },
} as const
