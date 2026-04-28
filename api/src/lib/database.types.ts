export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          created_at: string;
          entity: string | null;
          entity_id: string | null;
          id: number;
          meta: Json | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: number;
          meta?: Json | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: number;
          meta?: Json | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      contact_notes: {
        Row: {
          body: string;
          contact_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          contact_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          contact_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      contact_tags: {
        Row: {
          contact_id: string;
          created_at: string;
          tag_id: string;
        };
        Insert: {
          contact_id: string;
          created_at?: string;
          tag_id: string;
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          tag_id?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          avatar_updated_at: string | null;
          avatar_url: string | null;
          created_at: string;
          custom_fields: Json;
          custom_name: string | null;
          id: string;
          instance_id: string;
          is_blocked: boolean;
          jid: string;
          last_seen_at: string | null;
          phone_number: string | null;
          presence: string;
          presence_updated_at: string | null;
          push_name: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_updated_at?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          custom_fields?: Json;
          custom_name?: string | null;
          id?: string;
          instance_id: string;
          is_blocked?: boolean;
          jid: string;
          last_seen_at?: string | null;
          phone_number?: string | null;
          presence?: string;
          presence_updated_at?: string | null;
          push_name?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_updated_at?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          custom_fields?: Json;
          custom_name?: string | null;
          id?: string;
          instance_id?: string;
          is_blocked?: boolean;
          jid?: string;
          last_seen_at?: string | null;
          phone_number?: string | null;
          presence?: string;
          presence_updated_at?: string | null;
          push_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversation_notes: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          archived: boolean;
          assigned_at: string | null;
          assigned_to: string | null;
          contact_id: string;
          created_at: string;
          id: string;
          instance_id: string;
          last_message_at: string | null;
          last_message_preview: string | null;
          pinned: boolean;
          unread_count: number;
          updated_at: string;
        };
        Insert: {
          archived?: boolean;
          assigned_at?: string | null;
          assigned_to?: string | null;
          contact_id: string;
          created_at?: string;
          id?: string;
          instance_id: string;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          pinned?: boolean;
          unread_count?: number;
          updated_at?: string;
        };
        Update: {
          archived?: boolean;
          assigned_at?: string | null;
          assigned_to?: string | null;
          contact_id?: string;
          created_at?: string;
          id?: string;
          instance_id?: string;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          pinned?: boolean;
          unread_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_stats: {
        Row: {
          avg_response_seconds: number | null;
          conversations_handled: number;
          date: string;
          instance_id: string;
          messages_received: number;
          messages_sent: number;
          user_id: string;
        };
        Insert: {
          avg_response_seconds?: number | null;
          conversations_handled?: number;
          date: string;
          instance_id: string;
          messages_received?: number;
          messages_sent?: number;
          user_id: string;
        };
        Update: {
          avg_response_seconds?: number | null;
          conversations_handled?: number;
          date?: string;
          instance_id?: string;
          messages_received?: number;
          messages_sent?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      instance_auth_state: {
        Row: {
          creds: Json;
          instance_id: string;
          keys: Json;
          updated_at: string;
        };
        Insert: {
          creds?: Json;
          instance_id: string;
          keys?: Json;
          updated_at?: string;
        };
        Update: {
          creds?: Json;
          instance_id?: string;
          keys?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      instance_health_events: {
        Row: {
          created_at: string;
          detail: Json | null;
          event_type: string;
          id: number;
          instance_id: string;
        };
        Insert: {
          created_at?: string;
          detail?: Json | null;
          event_type: string;
          id?: number;
          instance_id: string;
        };
        Update: {
          created_at?: string;
          detail?: Json | null;
          event_type?: string;
          id?: number;
          instance_id?: string;
        };
        Relationships: [];
      };
      instances: {
        Row: {
          created_at: string;
          disconnect_reason: string | null;
          id: string;
          last_connected_at: string | null;
          last_disconnected_at: string | null;
          last_qr: string | null;
          last_qr_at: string | null;
          name: string;
          phone_number: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          disconnect_reason?: string | null;
          id?: string;
          last_connected_at?: string | null;
          last_disconnected_at?: string | null;
          last_qr?: string | null;
          last_qr_at?: string | null;
          name: string;
          phone_number?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          disconnect_reason?: string | null;
          id?: string;
          last_connected_at?: string | null;
          last_disconnected_at?: string | null;
          last_qr?: string | null;
          last_qr_at?: string | null;
          name?: string;
          phone_number?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      message_outbox: {
        Row: {
          attempts: number;
          conversation_id: string;
          created_at: string;
          id: string;
          last_error: string | null;
          payload: Json;
          scheduled_at: string;
          sent_message_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          conversation_id: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          payload: Json;
          scheduled_at?: string;
          sent_message_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          scheduled_at?: string;
          sent_message_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          body: string | null;
          conversation_id: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          forwarded: boolean;
          from_me: boolean;
          id: string;
          media_duration_seconds: number | null;
          media_height: number | null;
          media_mime: string | null;
          media_path: string | null;
          media_size_bytes: number | null;
          media_thumbnail_url: string | null;
          media_url: string | null;
          media_width: number | null;
          reactions: Json;
          reply_to_message_id: string | null;
          sender_jid: string | null;
          sent_by_user_id: string | null;
          sent_via: string | null;
          status: string;
          transcript: string | null;
          transcript_at: string | null;
          transcript_language: string | null;
          transcript_provider: string | null;
          transcript_status: string;
          type: string;
          wa_message_id: string;
          wa_timestamp: string;
        };
        Insert: {
          body?: string | null;
          conversation_id: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          forwarded?: boolean;
          from_me: boolean;
          id?: string;
          media_duration_seconds?: number | null;
          media_height?: number | null;
          media_mime?: string | null;
          media_path?: string | null;
          media_size_bytes?: number | null;
          media_thumbnail_url?: string | null;
          media_url?: string | null;
          media_width?: number | null;
          reactions?: Json;
          reply_to_message_id?: string | null;
          sender_jid?: string | null;
          sent_by_user_id?: string | null;
          sent_via?: string | null;
          status?: string;
          transcript?: string | null;
          transcript_at?: string | null;
          transcript_language?: string | null;
          transcript_provider?: string | null;
          transcript_status?: string;
          type: string;
          wa_message_id: string;
          wa_timestamp: string;
        };
        Update: {
          body?: string | null;
          conversation_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          forwarded?: boolean;
          from_me?: boolean;
          id?: string;
          media_duration_seconds?: number | null;
          media_height?: number | null;
          media_mime?: string | null;
          media_path?: string | null;
          media_size_bytes?: number | null;
          media_thumbnail_url?: string | null;
          media_url?: string | null;
          media_width?: number | null;
          reactions?: Json;
          reply_to_message_id?: string | null;
          sender_jid?: string | null;
          sent_by_user_id?: string | null;
          sent_via?: string | null;
          status?: string;
          transcript?: string | null;
          transcript_at?: string | null;
          transcript_language?: string | null;
          transcript_provider?: string | null;
          transcript_status?: string;
          type?: string;
          wa_message_id?: string;
          wa_timestamp?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      quick_replies: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          media_url: string | null;
          shortcut: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          media_url?: string | null;
          shortcut: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          media_url?: string | null;
          shortcut?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          is_online: boolean;
          last_seen_at: string | null;
          role: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          is_online?: boolean;
          last_seen_at?: string | null;
          role?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          is_online?: boolean;
          last_seen_at?: string | null;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
