import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchListingsWithCoordinates } from '@/core/api/listings';
import { mapQueryError } from '@/core/errors/mapSupabaseError';
import { formatPriceSom } from '@/core/format/price';
import { tryGetSupabase } from '@/core/supabase/client';
import type { Listing } from '@/core/types/database';

/**
 * Вкладка «Карта» без нативных модулей: веб и резолвер по умолчанию.
 * На iOS/Android подставляется `MapTabContent.native.tsx`.
 */
export default function MapTabContent() {
  const router = useRouter();
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb) {
      setErrorText('Добавьте ключи Supabase в .env и перезапустите приложение.');
      setRows([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setErrorText(null);
    const { rows: data, error } = await fetchListingsWithCoordinates(sb);
    setLoading(false);
    setRefreshing(false);
    if (error) {
      setErrorText(mapQueryError(error));
      setRows([]);
      return;
    }
    setRows(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  if (loading && rows.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
        <Text style={styles.loadingText}>Загружаем объявления с координатами…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Объявления на карте</Text>
          <Text style={styles.headerBody}>
            Интерактивная карта — в приложении для iOS и Android. Здесь список лотов с заданными
            координатами (удобно в браузере).
          </Text>
          {errorText ? <Text style={styles.banner}>{errorText}</Text> : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => router.push(`/listing/${item.id}` as Href)}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {item.district} · {formatPriceSom(Number(item.price))}
          </Text>
          <Text style={styles.cardCoords}>
            {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Пока нет объявлений с координатами</Text>
            <Text style={styles.emptyHint}>
              Укажите широту и долготу при создании или редактировании объявления — они появятся и в
              мобильной карте.
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#6b7280' },
  listContent: { paddingBottom: 32 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f0fdfa',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f766e' },
  headerBody: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#374151' },
  banner: {
    marginTop: 12,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  cardPressed: { opacity: 0.92 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  cardMeta: { marginTop: 6, fontSize: 15, color: '#0d9488', fontWeight: '700' },
  cardCoords: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#111', textAlign: 'center' },
  emptyHint: { marginTop: 10, fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
});
