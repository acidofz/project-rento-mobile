/** Типы под supabase_schema.sql — при изменении схемы обновите вручную или сгенерируйте через Supabase CLI. */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      listings: {
        Row: {
          id: number;
          title: string;
          district: string;
          rooms: number;
          price: number;
          created_at: string;
          owner_id: string | null;
          image_url: string | null;
          latitude: number | null;
          longitude: number | null;
        };
        Insert: {
          id?: number;
          title: string;
          district: string;
          rooms: number;
          price: number;
          created_at?: string;
          owner_id?: string | null;
          image_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
        };
        Update: Partial<Database['public']['Tables']['listings']['Insert']>;
      };
      favorites: {
        Row: {
          id: number;
          user_id: string;
          listing_id: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          listing_id: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['favorites']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          username: string | null;
          created_at: string;
          is_blocked: boolean;
        };
        Insert: {
          id: string;
          email?: string | null;
          username?: string | null;
          created_at?: string;
          is_blocked?: boolean;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      chats: {
        Row: {
          id: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['chats']['Insert']>;
      };
      chat_members: {
        Row: {
          id: number;
          chat_id: number;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          chat_id: number;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['chat_members']['Insert']>;
      };
      messages: {
        Row: {
          id: number;
          chat_id: number;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          chat_id: number;
          sender_id: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
    };
  };
}

export type Listing = Database['public']['Tables']['listings']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type Chat = Database['public']['Tables']['chats']['Row'];
