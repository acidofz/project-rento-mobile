import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { assertSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/core/config/env';
import { chunkedSecureStore } from '@/core/supabase/chunkedSecureStore';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  assertSupabaseConfigured();
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: chunkedSecureStore,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

/** For tests or when env is missing — returns null instead of throwing. */
export function tryGetSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return getSupabase();
}
