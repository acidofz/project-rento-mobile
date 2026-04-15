import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, user, signOut } = useAuth();

  async function onSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Вы вошли как</Text>
      <Text style={styles.value}>{profile?.username || user?.email || 'Пользователь'}</Text>
      {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}

      <Pressable style={styles.link} onPress={() => router.push('/terms')}>
        <Text style={styles.linkText}>Правила площадки</Text>
      </Pressable>
      <Pressable style={styles.link} onPress={() => router.push('/privacy')}>
        <Text style={styles.linkText}>Персональные данные</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={onSignOut}>
        <Text style={styles.buttonText}>Выйти</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  label: { fontSize: 14, color: '#666' },
  value: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  email: { fontSize: 15, color: '#444', marginTop: 8 },
  link: { marginTop: 20, paddingVertical: 12 },
  linkText: { fontSize: 16, color: '#0d9488' },
  button: {
    marginTop: 32,
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { fontSize: 17, fontWeight: '600', color: '#111' },
});
