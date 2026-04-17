import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatPriceSom } from '@/core/format/price';
import { fetchMyListings } from '@/core/api/myListings';
import { useAuth } from '@/core/auth/AuthContext';
import { mapQueryError } from '@/core/errors/mapSupabaseError';
import { tryGetSupabase } from '@/core/supabase/client';
import type { Listing } from '@/core/types/database';
import type { Href } from 'expo-router';

export default function MyListingsIndexScreen() {
  const router = useRouter();
  const { session, canCreateContent } = useAuth();
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    const sb = tryGetSupabase();
    if (!sb) {
      setErrorText('Нет настроек Supabase.');
      setRows([]);
      setLoading(false);
      return;
    }
    const { rows: data, error } = await fetchMyListings(sb, session.user.id);
    if (error) {
      setErrorText(mapQueryError(error));
      setRows([]);
    } else {
      setErrorText(null);
      setRows(data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setLoading(false);
        return;
      }
      setLoading(true);
      void load();
    }, [session, load])
  );

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Войдите, чтобы управлять объявлениями.</Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.btnText}>Войти</Text>
        </Pressable>
      </View>
    );
  }

  if (!canCreateContent) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Создание объявлений недоступно для вашего аккаунта.</Text>
      </View>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {errorText ? <Text style={styles.banner}>{errorText}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListEmptyComponent={
          <Text style={styles.empty}>У вас пока нет объявлений. Нажмите «Новое».</Text>
        }
        contentContainerStyle={rows.length === 0 ? styles.emptyWrap : styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/my-listings/${item.id}/edit` as Href)}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.cardMeta}>
              {item.district} · {item.rooms} комн.
            </Text>
            <Text style={styles.cardPrice}>{formatPriceSom(Number(item.price))}</Text>
            <Text style={styles.cardAction}>Изменить →</Text>
          </Pressable>
        )}
      />
      <Pressable style={styles.fab} onPress={() => router.push('/my-listings/new' as Href)}>
        <Text style={styles.fabText}>+ Новое</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hint: { fontSize: 16, color: '#555', textAlign: 'center' },
  btn: { marginTop: 16, backgroundColor: '#0d9488', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  banner: { backgroundColor: '#fef3c7', color: '#92400e', padding: 12, margin: 12, borderRadius: 10 },
  list: { padding: 16, paddingBottom: 100 },
  emptyWrap: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  empty: { fontSize: 16, color: '#666', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardMeta: { marginTop: 6, color: '#6b7280' },
  cardPrice: { marginTop: 8, fontSize: 16, fontWeight: '700', color: '#0d9488' },
  cardAction: { marginTop: 10, color: '#0d9488', fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    backgroundColor: '#0d9488',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
