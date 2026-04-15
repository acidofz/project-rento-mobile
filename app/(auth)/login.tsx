import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/core/auth/AuthContext';
import { mapAuthError } from '@/core/errors/mapSupabaseError';
import { supabaseAnonKey, supabaseUrl } from '@/core/config/env';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const missingEnv = !supabaseUrl || !supabaseAnonKey;

  async function onSubmit() {
    setFormError(null);
    if (!email.trim() || !password) {
      setFormError('Введите email и пароль.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setFormError(mapAuthError(error));
      return;
    }
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.brand}>RENTO</Text>
        <Text style={styles.sub}>Аренда жилья в Ташкенте</Text>

        {missingEnv ? (
          <Text style={styles.warn}>
            Добавьте в корень проекта файл .env с EXPO_PUBLIC_SUPABASE_URL и
            EXPO_PUBLIC_SUPABASE_ANON_KEY, затем перезапустите Expo.
          </Text>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Пароль"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Вход…' : 'Войти'}</Text>
        </Pressable>

        <Link href="/(auth)/register" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={styles.link}>Нет аккаунта? Зарегистрироваться</Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  brand: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 32 },
  warn: {
    color: '#b45309',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  error: { color: '#b91c1c', marginBottom: 12 },
  button: {
    backgroundColor: '#0d9488',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  linkWrap: { marginTop: 20, alignItems: 'center' },
  link: { color: '#0d9488', fontSize: 16 },
});
