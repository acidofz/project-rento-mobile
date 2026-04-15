import Constants from 'expo-constants';

function read(key: string): string | undefined {
  return (
    process.env[key] ??
    (Constants.expoConfig?.extra as Record<string, string> | undefined)?.[key]
  );
}

export const supabaseUrl = read('EXPO_PUBLIC_SUPABASE_URL') ?? '';
export const supabaseAnonKey = read('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? '';

export function assertSupabaseConfigured(): void {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Задайте EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY в .env или app.config.js extra.'
    );
  }
}
