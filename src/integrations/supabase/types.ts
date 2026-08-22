export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      grammar_attempts: {
        Row: {
          correct: boolean;
          created_at: string;
          drill_type: string;
          feedback: Json;
          id: string;
          prompt: string;
          user_answer: string;
          user_id: string;
        };
        Insert: {
          correct: boolean;
          created_at?: string;
          drill_type: string;
          feedback: Json;
          id?: string;
          prompt: string;
          user_answer: string;
          user_id: string;
        };
        Update: {
          correct?: boolean;
          created_at?: string;
          drill_type?: string;
          feedback?: Json;
          id?: string;
          prompt?: string;
          user_answer?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          current_streak: number;
          display_name: string | null;
          id: string;
          last_study_date: string | null;
          longest_streak: number;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          current_streak?: number;
          display_name?: string | null;
          id: string;
          last_study_date?: string | null;
          longest_streak?: number;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          current_streak?: number;
          display_name?: string | null;
          id?: string;
          last_study_date?: string | null;
          longest_streak?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      quiz_sessions: {
        Row: {
          completed_at: string;
          id: string;
          score: number;
          total: number;
          user_id: string;
        };
        Insert: {
          completed_at?: string;
          id?: string;
          score?: number;
          total?: number;
          user_id: string;
        };
        Update: {
          completed_at?: string;
          id?: string;
          score?: number;
          total?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          created_at: string;
          id: string;
          rating: string;
          user_id: string;
          word_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          rating: string;
          user_id: string;
          word_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          rating?: string;
          user_id?: string;
          word_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_word_id_fkey";
            columns: ["word_id"];
            isOneToOne: false;
            referencedRelation: "words";
            referencedColumns: ["id"];
          },
        ];
      };
      words: {
        Row: {
          antonym: string | null;
          collocations: string[];
          created_at: string;
          definition_en: string | null;
          due_at: string;
          ease: number;
          example_en: string | null;
          example_ur: string | null;
          examples: Json;
          id: string;
          interval_days: number;
          last_reviewed_at: string | null;
          mastered: boolean;
          notes: string | null;
          one_word_en: string | null;
          one_word_ur: string | null;
          part_of_speech: string | null;
          repetitions: number;
          synonym: string | null;
          tags: string[];
          translation_ur: string | null;
          type: string;
          updated_at: string;
          user_id: string;
          word: string;
        };
        Insert: {
          antonym?: string | null;
          collocations?: string[];
          created_at?: string;
          definition_en?: string | null;
          due_at?: string;
          ease?: number;
          example_en?: string | null;
          example_ur?: string | null;
          examples?: Json;
          id?: string;
          interval_days?: number;
          last_reviewed_at?: string | null;
          mastered?: boolean;
          notes?: string | null;
          one_word_en?: string | null;
          one_word_ur?: string | null;
          part_of_speech?: string | null;
          repetitions?: number;
          synonym?: string | null;
          tags?: string[];
          translation_ur?: string | null;
          type?: string;
          updated_at?: string;
          user_id: string;
          word: string;
        };
        Update: {
          antonym?: string | null;
          collocations?: string[];
          created_at?: string;
          definition_en?: string | null;
          due_at?: string;
          ease?: number;
          example_en?: string | null;
          example_ur?: string | null;
          examples?: Json;
          id?: string;
          interval_days?: number;
          last_reviewed_at?: string | null;
          mastered?: boolean;
          notes?: string | null;
          one_word_en?: string | null;
          one_word_ur?: string | null;
          part_of_speech?: string | null;
          repetitions?: number;
          synonym?: string | null;
          tags?: string[];
          translation_ur?: string | null;
          type?: string;
          updated_at?: string;
          user_id?: string;
          word?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
