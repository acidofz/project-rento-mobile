import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { supabaseAnonKey, supabaseUrl } from '@/core/config/env';
import { getSupabase, tryGetSupabase } from '@/core/supabase/client';
import type { Profile } from '@/core/types/database';

type AuthContextValue = {
  initialized: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const sb = tryGetSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('id,email,username,created_at,is_blocked')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next);
    const uid = next?.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(uid);
    if (p?.is_blocked) {
      Alert.alert(
        'RENTO',
        'Доступ ограничен. Если это ошибка, напишите в поддержку.'
      );
      const sb = tryGetSupabase();
      await sb?.auth.signOut();
      setSession(null);
      setProfile(null);
      return;
    }
    setProfile(p);
  }, []);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      setInitialized(true);
      setSession(null);
      setProfile(null);
      return;
    }

    const sb = getSupabase();
    let cancelled = false;

    sb.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        return applySession(data.session ?? null);
      })
      .finally(() => {
        if (!cancelled) setInitialized(true);
      });

    const { data: sub } = sb.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!tryGetSupabase()) {
      return { error: 'Не настроен Supabase. Проверьте переменные окружения.' };
    }
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.message };
    if (data.user) {
      const p = await fetchProfile(data.user.id);
      if (p?.is_blocked) {
        await sb.auth.signOut();
        return { error: 'Доступ ограничен. Если это ошибка, напишите в поддержку.' };
      }
    }
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    if (!tryGetSupabase()) {
      return { error: 'Не настроен Supabase. Проверьте переменные окружения.' };
    }
    const sb = getSupabase();
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) return { error: error.message };
    const uid = data.user?.id;
    if (uid) {
      const { error: pe } = await sb.from('profiles').upsert(
        {
          id: uid,
          email: email.trim(),
          username: username.trim() || null,
          is_blocked: false,
        },
        { onConflict: 'id' }
      );
      if (pe) return { error: pe.message };
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    const sb = tryGetSupabase();
    await sb?.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    const p = await fetchProfile(uid);
    setProfile(p);
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      session,
      user: session?.user ?? null,
      profile,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [initialized, session, profile, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен быть внутри AuthProvider');
  return ctx;
}
