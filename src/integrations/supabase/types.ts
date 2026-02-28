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
      cam_map_chunks: {
        Row: {
          chunk_x: number
          chunk_y: number
          tiles_data: Json
          updated_at: string
          z: number
        }
        Insert: {
          chunk_x: number
          chunk_y: number
          tiles_data?: Json
          updated_at?: string
          z: number
        }
        Update: {
          chunk_x?: number
          chunk_y?: number
          tiles_data?: Json
          updated_at?: string
          z?: number
        }
        Relationships: []
      }
      cam_map_creatures: {
        Row: {
          direction: number
          name: string
          outfit_id: number
          updated_at: string
          x: number
          y: number
          z: number
        }
        Insert: {
          direction?: number
          name: string
          outfit_id?: number
          updated_at?: string
          x: number
          y: number
          z: number
        }
        Update: {
          direction?: number
          name?: string
          outfit_id?: number
          updated_at?: string
          x?: number
          y?: number
          z?: number
        }
        Relationships: []
      }
      cam_map_spawns: {
        Row: {
          avg_count: number
          chunk_x: number
          chunk_y: number
          creature_name: string
          outfit_id: number
          positions: Json
          updated_at: string
          visit_count: number
          z: number
        }
        Insert: {
          avg_count?: number
          chunk_x: number
          chunk_y: number
          creature_name: string
          outfit_id?: number
          positions?: Json
          updated_at?: string
          visit_count?: number
          z: number
        }
        Update: {
          avg_count?: number
          chunk_x?: number
          chunk_y?: number
          creature_name?: string
          outfit_id?: number
          positions?: Json
          updated_at?: string
          visit_count?: number
          z?: number
        }
        Relationships: []
      }
      cam_map_tiles: {
        Row: {
          items: Json
          updated_at: string
          x: number
          y: number
          z: number
        }
        Insert: {
          items?: Json
          updated_at?: string
          x: number
          y: number
          z: number
        }
        Update: {
          items?: Json
          updated_at?: string
          x?: number
          y?: number
          z?: number
        }
        Relationships: []
      }
      cam_uploads: {
        Row: {
          file_name: string
          file_size_bytes: number
          id: string
          ip_hint: string | null
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          file_size_bytes: number
          id?: string
          ip_hint?: string | null
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          file_size_bytes?: number
          id?: string
          ip_hint?: string | null
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: []
      }
      character_accounts: {
        Row: {
          account_chars: string[]
          character_name: string
          last_scraped_at: string
          scrape_error: string | null
        }
        Insert: {
          account_chars?: string[]
          character_name: string
          last_scraped_at?: string
          scrape_error?: string | null
        }
        Update: {
          account_chars?: string[]
          character_name?: string
          last_scraped_at?: string
          scrape_error?: string | null
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
      hunt_cities: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      hunt_queue: {
        Row: {
          created_at: string
          id: string
          notified_at: string | null
          player_name: string
          position: number
          session_id: string | null
          spot_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified_at?: string | null
          player_name: string
          position?: number
          session_id?: string | null
          spot_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          notified_at?: string | null
          player_name?: string
          position?: number
          session_id?: string | null
          spot_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hunt_queue_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "hunt_spots"
            referencedColumns: ["id"]
          },
        ]
      }
      hunt_sessions: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          notified_15min: boolean
          notified_1h: boolean
          player_name: string
          spot_id: string
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          notified_15min?: boolean
          notified_1h?: boolean
          player_name: string
          spot_id: string
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          notified_15min?: boolean
          notified_1h?: boolean
          player_name?: string
          spot_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hunt_sessions_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "hunt_spots"
            referencedColumns: ["id"]
          },
        ]
      }
      hunt_spots: {
        Row: {
          city_id: string
          created_at: string
          id: string
          max_duration_minutes: number
          name: string
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          max_duration_minutes?: number
          name: string
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          max_duration_minutes?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hunt_spots_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "hunt_cities"
            referencedColumns: ["id"]
          },
        ]
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
      player_deaths: {
        Row: {
          created_at: string | null
          death_timestamp: string
          id: string
          killers: Json
          level: number
          player_name: string
        }
        Insert: {
          created_at?: string | null
          death_timestamp: string
          id?: string
          killers?: Json
          level: number
          player_name: string
        }
        Update: {
          created_at?: string | null
          death_timestamp?: string
          id?: string
          killers?: Json
          level?: number
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
      xp_snapshots: {
        Row: {
          captured_at: string
          experience: number | null
          id: string
          level: number | null
          player_name: string
          profession: string | null
        }
        Insert: {
          captured_at?: string
          experience?: number | null
          id?: string
          level?: number | null
          player_name: string
          profession?: string | null
        }
        Update: {
          captured_at?: string
          experience?: number | null
          id?: string
          level?: number | null
          player_name?: string
          profession?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_cam_map_data: { Args: never; Returns: undefined }
      compact_tiles_to_chunks: { Args: { p_floor: number }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      merge_cam_chunk: {
        Args: { new_data: Json; px: number; py: number; pz: number }
        Returns: undefined
      }
      merge_cam_chunks_batch: { Args: { chunks: Json }; Returns: undefined }
      merge_cam_spawn: {
        Args: {
          p_avg_count: number
          p_creature_name: string
          p_outfit_id: number
          p_positions: Json
          p_visit_count: number
          px: number
          py: number
          pz: number
        }
        Returns: undefined
      }
      merge_cam_spawns_batch: { Args: { spawns: Json }; Returns: undefined }
      merge_cam_tile: {
        Args: { new_items: Json; px: number; py: number; pz: number }
        Returns: undefined
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
