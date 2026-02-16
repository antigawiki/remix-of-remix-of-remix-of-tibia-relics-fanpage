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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alt_detector_matches: {
        Row: {
          ever_online_together: boolean
          id: string
          last_updated: string
          match_count: number
          player_a: string
          player_b: string
          probability: number
          total_sessions_a: number
          total_sessions_b: number
        }
        Insert: {
          ever_online_together?: boolean
          id?: string
          last_updated?: string
          match_count?: number
          player_a: string
          player_b: string
          probability?: number
          total_sessions_a?: number
          total_sessions_b?: number
        }
        Update: {
          ever_online_together?: boolean
          id?: string
          last_updated?: string
          match_count?: number
          player_a?: string
          player_b?: string
          probability?: number
          total_sessions_a?: number
          total_sessions_b?: number
        }
        Relationships: []
      }
      creatures: {
        Row: {
          abilities: string | null
          convince_mana: number | null
          created_at: string
          creature_type: string | null
          experience: number | null
          hp: number | null
          id: string
          image_url: string | null
          is_boss: boolean | null
          locations: string | null
          loot: string | null
          name: string
          summon_mana: number | null
          updated_at: string
        }
        Insert: {
          abilities?: string | null
          convince_mana?: number | null
          created_at?: string
          creature_type?: string | null
          experience?: number | null
          hp?: number | null
          id?: string
          image_url?: string | null
          is_boss?: boolean | null
          locations?: string | null
          loot?: string | null
          name: string
          summon_mana?: number | null
          updated_at?: string
        }
        Update: {
          abilities?: string | null
          convince_mana?: number | null
          created_at?: string
          creature_type?: string | null
          experience?: number | null
          hp?: number | null
          id?: string
          image_url?: string | null
          is_boss?: boolean | null
          locations?: string | null
          loot?: string | null
          name?: string
          summon_mana?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          armor: number | null
          attack: number | null
          attributes: string | null
          category: string
          created_at: string
          defense: number | null
          id: string
          image_url: string | null
          is_premium: boolean | null
          level_required: number | null
          name: string
          updated_at: string
          vocations: string | null
          weight: number | null
        }
        Insert: {
          armor?: number | null
          attack?: number | null
          attributes?: string | null
          category: string
          created_at?: string
          defense?: number | null
          id?: string
          image_url?: string | null
          is_premium?: boolean | null
          level_required?: number | null
          name: string
          updated_at?: string
          vocations?: string | null
          weight?: number | null
        }
        Update: {
          armor?: number | null
          attack?: number | null
          attributes?: string | null
          category?: string
          created_at?: string
          defense?: number | null
          id?: string
          image_url?: string | null
          is_premium?: boolean | null
          level_required?: number | null
          name?: string
          updated_at?: string
          vocations?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      highscore_snapshots: {
        Row: {
          created_at: string | null
          experience: number | null
          id: string
          level: number | null
          player_name: string
          profession: string | null
          snapshot_date: string
        }
        Insert: {
          created_at?: string | null
          experience?: number | null
          id?: string
          level?: number | null
          player_name: string
          profession?: string | null
          snapshot_date: string
        }
        Update: {
          created_at?: string | null
          experience?: number | null
          id?: string
          level?: number | null
          player_name?: string
          profession?: string | null
          snapshot_date?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          attributes: string | null
          category: string
          charges: number | null
          created_at: string
          description: string | null
          duration: string | null
          id: string
          image_url: string | null
          name: string
          updated_at: string
          weight: number | null
        }
        Insert: {
          attributes?: string | null
          category: string
          charges?: number | null
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
          weight?: number | null
        }
        Update: {
          attributes?: string | null
          category?: string
          charges?: number | null
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
          weight?: number | null
        }
        Relationships: []
      }
      news: {
        Row: {
          author: string | null
          content: string
          created_at: string | null
          date: string | null
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          content: string
          created_at?: string | null
          date?: string | null
          id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string | null
          date?: string | null
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      online_tracker_sessions: {
        Row: {
          created_at: string
          id: string
          login_at: string
          logout_at: string | null
          player_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          login_at?: string
          logout_at?: string | null
          player_name: string
        }
        Update: {
          created_at?: string
          id?: string
          login_at?: string
          logout_at?: string | null
          player_name?: string
        }
        Relationships: []
      }
      online_tracker_state: {
        Row: {
          last_seen_at: string
          player_name: string
        }
        Insert: {
          last_seen_at?: string
          player_name: string
        }
        Update: {
          last_seen_at?: string
          player_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      spells: {
        Row: {
          cooldown: number | null
          created_at: string
          description: string | null
          formula: string | null
          id: string
          image_url: string | null
          is_premium: boolean | null
          level_required: number | null
          mana_cost: number | null
          mlvl_required: number | null
          name: string
          price: number | null
          spell_type: string | null
          updated_at: string
          vocation: string
          words: string
        }
        Insert: {
          cooldown?: number | null
          created_at?: string
          description?: string | null
          formula?: string | null
          id?: string
          image_url?: string | null
          is_premium?: boolean | null
          level_required?: number | null
          mana_cost?: number | null
          mlvl_required?: number | null
          name: string
          price?: number | null
          spell_type?: string | null
          updated_at?: string
          vocation: string
          words: string
        }
        Update: {
          cooldown?: number | null
          created_at?: string
          description?: string | null
          formula?: string | null
          id?: string
          image_url?: string | null
          is_premium?: boolean | null
          level_required?: number | null
          mana_cost?: number | null
          mlvl_required?: number | null
          name?: string
          price?: number | null
          spell_type?: string | null
          updated_at?: string
          vocation?: string
          words?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
