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
      activity_log: {
        Row: {
          action: string
          cost_estimate: number | null
          created_at: string
          details: Json | null
          duration_ms: number | null
          entity_id: string | null
          entity_type: string
          id: string
          input_data: Json | null
          output_data: Json | null
          parent_entity_id: string | null
          step_number: number | null
          tokens_used: number | null
        }
        Insert: {
          action: string
          cost_estimate?: number | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          entity_id?: string | null
          entity_type: string
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          parent_entity_id?: string | null
          step_number?: number | null
          tokens_used?: number | null
        }
        Update: {
          action?: string
          cost_estimate?: number | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          parent_entity_id?: string | null
          step_number?: number | null
          tokens_used?: number | null
        }
        Relationships: []
      }
      advisor_photos: {
        Row: {
          advisor_id: string
          created_at: string
          heygen_asset_id: string | null
          id: string
          is_primary: boolean | null
          photo_url: string
        }
        Insert: {
          advisor_id: string
          created_at?: string
          heygen_asset_id?: string | null
          id?: string
          is_primary?: boolean | null
          photo_url: string
        }
        Update: {
          advisor_id?: string
          created_at?: string
          heygen_asset_id?: string | null
          id?: string
          is_primary?: boolean | null
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_photos_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
        ]
      }
      advisors: {
        Row: {
          back_cover_template_url: string | null
          created_at: string
          default_channels: string[] | null
          display_name: string | null
          elevenlabs_voice_id: string | null
          id: string
          is_active: boolean | null
          name: string
          speech_speed: number | null
          updated_at: string
        }
        Insert: {
          back_cover_template_url?: string | null
          created_at?: string
          default_channels?: string[] | null
          display_name?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          speech_speed?: number | null
          updated_at?: string
        }
        Update: {
          back_cover_template_url?: string | null
          created_at?: string
          default_channels?: string[] | null
          display_name?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          speech_speed?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_parsed_at: string | null
          name: string
          posts_count: number
          source: Database["public"]["Enums"]["content_source"]
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_parsed_at?: string | null
          name: string
          posts_count?: number
          source: Database["public"]["Enums"]["content_source"]
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_parsed_at?: string | null
          name?: string
          posts_count?: number
          source?: Database["public"]["Enums"]["content_source"]
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      cover_thumbnails: {
        Row: {
          atmosphere_url: string | null
          back_cover_url: string | null
          created_at: string
          front_cover_url: string | null
          id: string
          is_active: boolean | null
          prompt: string | null
          status: string | null
          updated_at: string
          variant_type: string | null
          video_id: string | null
        }
        Insert: {
          atmosphere_url?: string | null
          back_cover_url?: string | null
          created_at?: string
          front_cover_url?: string | null
          id?: string
          is_active?: boolean | null
          prompt?: string | null
          status?: string | null
          updated_at?: string
          variant_type?: string | null
          video_id?: string | null
        }
        Update: {
          atmosphere_url?: string | null
          back_cover_url?: string | null
          created_at?: string
          front_cover_url?: string | null
          id?: string
          is_active?: boolean | null
          prompt?: string | null
          status?: string | null
          updated_at?: string
          variant_type?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cover_thumbnails_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      heygen_avatars: {
        Row: {
          avatar_id: string
          avatar_name: string
          cached_at: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          preview_image_url: string | null
          preview_video_url: string | null
        }
        Insert: {
          avatar_id: string
          avatar_name: string
          cached_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          preview_image_url?: string | null
          preview_video_url?: string | null
        }
        Update: {
          avatar_id?: string
          avatar_name?: string
          cached_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          preview_image_url?: string | null
          preview_video_url?: string | null
        }
        Relationships: []
      }
      parsed_content: {
        Row: {
          channel_id: string | null
          comments: number | null
          content: string | null
          created_at: string
          engagement_score: number | null
          id: string
          is_manual: boolean | null
          likes: number | null
          matched_keywords: Json | null
          media_urls: Json | null
          original_url: string | null
          parsed_at: string
          published_at: string | null
          relevance_score: number | null
          status: Database["public"]["Enums"]["content_status"]
          thumbnail_url: string | null
          title: string
          views: number | null
        }
        Insert: {
          channel_id?: string | null
          comments?: number | null
          content?: string | null
          created_at?: string
          engagement_score?: number | null
          id?: string
          is_manual?: boolean | null
          likes?: number | null
          matched_keywords?: Json | null
          media_urls?: Json | null
          original_url?: string | null
          parsed_at?: string
          published_at?: string | null
          relevance_score?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title: string
          views?: number | null
        }
        Update: {
          channel_id?: string | null
          comments?: number | null
          content?: string | null
          created_at?: string
          engagement_score?: number | null
          id?: string
          is_manual?: boolean | null
          likes?: number | null
          matched_keywords?: Json | null
          media_urls?: Json | null
          original_url?: string | null
          parsed_at?: string
          published_at?: string | null
          relevance_score?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parsed_content_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_scenes: {
        Row: {
          advisor_id: string | null
          created_at: string
          id: string
          playlist_id: string | null
          review_status: string | null
          scene_prompt: string | null
          scene_url: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          advisor_id?: string | null
          created_at?: string
          id?: string
          playlist_id?: string | null
          review_status?: string | null
          scene_prompt?: string | null
          scene_url?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          advisor_id?: string | null
          created_at?: string
          id?: string
          playlist_id?: string | null
          review_status?: string | null
          scene_prompt?: string | null
          scene_url?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_scenes_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_scenes_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          scene_prompt: string | null
          updated_at: string
          video_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          scene_prompt?: string | null
          updated_at?: string
          video_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          scene_prompt?: string | null
          updated_at?: string
          video_count?: number | null
        }
        Relationships: []
      }
      prompt_history: {
        Row: {
          change_note: string | null
          created_at: string
          id: string
          max_tokens: number
          model: string
          prompt_id: string | null
          system_prompt: string
          temperature: number
          user_template: string
          version: number
        }
        Insert: {
          change_note?: string | null
          created_at?: string
          id?: string
          max_tokens: number
          model: string
          prompt_id?: string | null
          system_prompt: string
          temperature: number
          user_template: string
          version?: number
        }
        Update: {
          change_note?: string | null
          created_at?: string
          id?: string
          max_tokens?: number
          model?: string
          prompt_id?: string | null
          system_prompt?: string
          temperature?: number
          user_template?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_history_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_tokens: number
          model: string
          name: string
          system_prompt: string
          temperature: number
          type: string
          updated_at: string
          user_template: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_tokens?: number
          model?: string
          name: string
          system_prompt: string
          temperature?: number
          type?: string
          updated_at?: string
          user_template: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_tokens?: number
          model?: string
          name?: string
          system_prompt?: string
          temperature?: number
          type?: string
          updated_at?: string
          user_template?: string
        }
        Relationships: []
      }
      publications: {
        Row: {
          channel_id: string | null
          created_at: string
          error_message: string | null
          final_video_url: string | null
          followers: number | null
          generated_text: string | null
          id: string
          likes: number | null
          post_date: string | null
          post_url: string | null
          profile_views: number | null
          publication_status: string | null
          reach: number | null
          updated_at: string
          video_id: string | null
          views: number | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          error_message?: string | null
          final_video_url?: string | null
          followers?: number | null
          generated_text?: string | null
          id?: string
          likes?: number | null
          post_date?: string | null
          post_url?: string | null
          profile_views?: number | null
          publication_status?: string | null
          reach?: number | null
          updated_at?: string
          video_id?: string | null
          views?: number | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          error_message?: string | null
          final_video_url?: string | null
          followers?: number | null
          generated_text?: string | null
          id?: string
          likes?: number | null
          post_date?: string | null
          post_url?: string | null
          profile_views?: number | null
          publication_status?: string | null
          reach?: number | null
          updated_at?: string
          video_id?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "publications_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "publishing_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      publishing_channels: {
        Row: {
          api_credentials: Json | null
          back_cover_url: string | null
          back_cover_video_url: string | null
          created_at: string
          id: string
          is_active: boolean | null
          location: string | null
          name: string
          network_type: string
          post_text_prompt: string | null
          proxy_server: string | null
          updated_at: string
        }
        Insert: {
          api_credentials?: Json | null
          back_cover_url?: string | null
          back_cover_video_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
          network_type: string
          post_text_prompt?: string | null
          proxy_server?: string | null
          updated_at?: string
        }
        Update: {
          api_credentials?: Json | null
          back_cover_url?: string | null
          back_cover_video_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
          network_type?: string
          post_text_prompt?: string | null
          proxy_server?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relevance_keywords: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          keyword: string
          weight: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keyword: string
          weight?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keyword?: string
          weight?: number | null
        }
        Relationships: []
      }
      rewritten_content: {
        Row: {
          created_at: string
          cta: string | null
          hook: string | null
          id: string
          parsed_content_id: string | null
          prompt_id: string | null
          rewritten_text: string
          script: string | null
        }
        Insert: {
          created_at?: string
          cta?: string | null
          hook?: string | null
          id?: string
          parsed_content_id?: string | null
          prompt_id?: string | null
          rewritten_text: string
          script?: string | null
        }
        Update: {
          created_at?: string
          cta?: string | null
          hook?: string | null
          id?: string
          parsed_content_id?: string | null
          prompt_id?: string | null
          rewritten_text?: string
          script?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rewritten_content_parsed_content_id_fkey"
            columns: ["parsed_content_id"]
            isOneToOne: false
            referencedRelation: "parsed_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewritten_content_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      video_projects: {
        Row: {
          audio_source: string | null
          avatar_id: string | null
          created_at: string
          custom_audio_url: string | null
          custom_script_url: string | null
          custom_video_url: string | null
          duration: number | null
          error_message: string | null
          final_video_url: string | null
          heygen_video_id: string | null
          heygen_video_url: string | null
          id: string
          is_edited: boolean | null
          progress: number | null
          rewritten_content_id: string | null
          status: Database["public"]["Enums"]["video_status"]
          submagic_project_id: string | null
          submagic_video_url: string | null
          title: string
          updated_at: string
          video_source: string | null
          voice_id: string | null
          voiceover_url: string | null
        }
        Insert: {
          audio_source?: string | null
          avatar_id?: string | null
          created_at?: string
          custom_audio_url?: string | null
          custom_script_url?: string | null
          custom_video_url?: string | null
          duration?: number | null
          error_message?: string | null
          final_video_url?: string | null
          heygen_video_id?: string | null
          heygen_video_url?: string | null
          id?: string
          is_edited?: boolean | null
          progress?: number | null
          rewritten_content_id?: string | null
          status?: Database["public"]["Enums"]["video_status"]
          submagic_project_id?: string | null
          submagic_video_url?: string | null
          title: string
          updated_at?: string
          video_source?: string | null
          voice_id?: string | null
          voiceover_url?: string | null
        }
        Update: {
          audio_source?: string | null
          avatar_id?: string | null
          created_at?: string
          custom_audio_url?: string | null
          custom_script_url?: string | null
          custom_video_url?: string | null
          duration?: number | null
          error_message?: string | null
          final_video_url?: string | null
          heygen_video_id?: string | null
          heygen_video_url?: string | null
          id?: string
          is_edited?: boolean | null
          progress?: number | null
          rewritten_content_id?: string | null
          status?: Database["public"]["Enums"]["video_status"]
          submagic_project_id?: string | null
          submagic_video_url?: string | null
          title?: string
          updated_at?: string
          video_source?: string | null
          voice_id?: string | null
          voiceover_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_projects_rewritten_content_id_fkey"
            columns: ["rewritten_content_id"]
            isOneToOne: false
            referencedRelation: "rewritten_content"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          advisor_answer: string | null
          advisor_id: string | null
          answer_prompt: string | null
          answer_status: string | null
          atmosphere_prompt: string | null
          atmosphere_url: string | null
          back_cover_url: string | null
          cover_prompt: string | null
          cover_status: string | null
          cover_url: string | null
          created_at: string
          facebook_url: string | null
          front_cover_url: string | null
          generation_status: string | null
          heygen_video_id: string | null
          heygen_video_url: string | null
          hook: string | null
          hook_rus: string | null
          id: string
          instagram_url: string | null
          main_photo_url: string | null
          pinterest_url: string | null
          playlist_id: string | null
          publication_date: string | null
          question: string | null
          question_eng: string | null
          question_id: number | null
          question_rus: string | null
          question_status: string | null
          reddit_url: string | null
          reel_status: string | null
          relevance_score: number | null
          safety_score: string | null
          selected_channels: string[] | null
          tiktok_url: string | null
          updated_at: string
          video_duration: number | null
          video_number: number | null
          video_path: string | null
          video_title: string | null
          voiceover_status: string | null
          voiceover_url: string | null
          youtube_url: string | null
        }
        Insert: {
          advisor_answer?: string | null
          advisor_id?: string | null
          answer_prompt?: string | null
          answer_status?: string | null
          atmosphere_prompt?: string | null
          atmosphere_url?: string | null
          back_cover_url?: string | null
          cover_prompt?: string | null
          cover_status?: string | null
          cover_url?: string | null
          created_at?: string
          facebook_url?: string | null
          front_cover_url?: string | null
          generation_status?: string | null
          heygen_video_id?: string | null
          heygen_video_url?: string | null
          hook?: string | null
          hook_rus?: string | null
          id?: string
          instagram_url?: string | null
          main_photo_url?: string | null
          pinterest_url?: string | null
          playlist_id?: string | null
          publication_date?: string | null
          question?: string | null
          question_eng?: string | null
          question_id?: number | null
          question_rus?: string | null
          question_status?: string | null
          reddit_url?: string | null
          reel_status?: string | null
          relevance_score?: number | null
          safety_score?: string | null
          selected_channels?: string[] | null
          tiktok_url?: string | null
          updated_at?: string
          video_duration?: number | null
          video_number?: number | null
          video_path?: string | null
          video_title?: string | null
          voiceover_status?: string | null
          voiceover_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          advisor_answer?: string | null
          advisor_id?: string | null
          answer_prompt?: string | null
          answer_status?: string | null
          atmosphere_prompt?: string | null
          atmosphere_url?: string | null
          back_cover_url?: string | null
          cover_prompt?: string | null
          cover_status?: string | null
          cover_url?: string | null
          created_at?: string
          facebook_url?: string | null
          front_cover_url?: string | null
          generation_status?: string | null
          heygen_video_id?: string | null
          heygen_video_url?: string | null
          hook?: string | null
          hook_rus?: string | null
          id?: string
          instagram_url?: string | null
          main_photo_url?: string | null
          pinterest_url?: string | null
          playlist_id?: string | null
          publication_date?: string | null
          question?: string | null
          question_eng?: string | null
          question_id?: number | null
          question_rus?: string | null
          question_status?: string | null
          reddit_url?: string | null
          reel_status?: string | null
          relevance_score?: number | null
          safety_score?: string | null
          selected_channels?: string[] | null
          tiktok_url?: string | null
          updated_at?: string
          video_duration?: number | null
          video_number?: number | null
          video_path?: string | null
          video_title?: string | null
          voiceover_status?: string | null
          voiceover_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      voiceovers: {
        Row: {
          audio_source: string | null
          audio_url: string | null
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          rewritten_content_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          audio_source?: string | null
          audio_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          rewritten_content_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          audio_source?: string | null
          audio_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          rewritten_content_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voiceovers_rewritten_content_id_fkey"
            columns: ["rewritten_content_id"]
            isOneToOne: false
            referencedRelation: "rewritten_content"
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
      content_source: "youtube" | "telegram" | "instagram" | "web"
      content_status:
        | "parsed"
        | "selected"
        | "rewriting"
        | "rewritten"
        | "voiceover"
        | "video"
        | "published"
      video_status:
        | "pending"
        | "voiceover"
        | "generating"
        | "editing"
        | "ready"
        | "published"
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
      content_source: ["youtube", "telegram", "instagram", "web"],
      content_status: [
        "parsed",
        "selected",
        "rewriting",
        "rewritten",
        "voiceover",
        "video",
        "published",
      ],
      video_status: [
        "pending",
        "voiceover",
        "generating",
        "editing",
        "ready",
        "published",
      ],
    },
  },
} as const
