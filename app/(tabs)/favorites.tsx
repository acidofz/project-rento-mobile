import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ListingCard } from '@/components/listings/ListingCard';
import { fetchFavoriteListings, removeFavorite } from '@/core/api/favorites';
import { useAuth } from '@/core/auth/AuthContext';
import { mapQueryError } from '@/core/errors/mapSupabaseError';
import { tryGetSupabase } from '@/core/supabase/client';
import type { Listing } from '@/core/types/database';

export default function FavoritesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(!!session);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) {
      setRows([]);
      setLoading(false);
      setErrorText(null);
      return;
    }
    const sb = tryGetSupabase();
    if (!sb) {
      setErrorText('Добавьте ключи Supabase в .env и перезапустите приложение.');
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorText(null);
    const { rows: data, error } = await fetchFavoriteListings(sb);
    setLoading(false);
    setRefreshing(false);
    if (error) {
      setErrorText(mapQueryError(error));
      setRows([]);
      return;
    }
    setRows(data);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    await load();
  }, [load, session]);

  const favoriteIdSet = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);

  const onFavoriteToggle = useCallback(
    async (listingId: number, nextFavorite: boolean) => {
      if (nextFavorite) return;
      const sb = tryGetSupabase();
      if (!sb || !session) return;
      const { error } = await removeFavorite(sb, listingId);
      if (error) {
        Alert.alert('RENTO', error.message);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== listingId));
    },
    [session]
  );

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Избранное</Text>
        <Text style={styles.hint}>
          Войдите, чтобы сохранять объявления и открывать их здесь.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/(auth)/login' as Href)}>
          <Text style={styles.primaryBtnText}>Войти</Text>
        </Pressable>
      </View>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingHint}>Загружаем избранное…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={rows.length === 0 ? styles.listEmptyGrow : styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        errorText ? (
          <View style={styles.bannerWrap}>
            <Text style={styles.banner}>{errorText}</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <ListingCard
          listing={item}
          favoriteListingIds={favoriteIdSet}
          onFavoriteToggle={onFavoriteToggle}
        />
      )}
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Пока пусто</Text>
            <Text style={styles.emptyHint}>
              На вкладке «Лента» нажмите на сердечко у объявления — оно появится здесь.
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  hint: { fontSize: 16, color: '#555', lineHeight: 24, textAlign: 'center', marginBottom: 24 },
  primaryBtn: {
    alignSelf: 'center',
    backgroundColor: '#0d9488',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  loadingHint: { marginTop: 12, fontSize: 15, color: '#6b7280' },
  listContent: { paddingTop: 8, paddingBottom: 24 },
  listEmptyGrow: { flexGrow: 1, paddingTop: 8, paddingBottom: 24 },
  bannerWrap: { paddingHorizontal: 16, marginBottom: 8 },
  banner: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  empty: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  emptyHint: { marginTop: 8, fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
});
