import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ListingCard } from '@/components/listings/ListingCard';
import { addFavorite, fetchFavoriteListingIds, removeFavorite } from '@/core/api/favorites';
import { fetchListingsPage, LISTINGS_PAGE_SIZE, type ListingsSort, type RoomsFilter } from '@/core/api/listings';
import { useAuth } from '@/core/auth/AuthContext';
import { mapQueryError } from '@/core/errors/mapSupabaseError';
import { tryGetSupabase } from '@/core/supabase/client';
import type { Listing } from '@/core/types/database';

function parseOptionalLong(s: string): number | null {
  const t = s.replace(/\s/g, '');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

const ROOM_CHIPS: { label: string; value: RoomsFilter }[] = [
  { label: 'Любое', value: 'any' },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4+', value: '4plus' },
];

const SORT_OPTIONS: { label: string; value: ListingsSort }[] = [
  { label: 'Новые', value: 'new' },
  { label: 'Дешевле', value: 'price_asc' },
  { label: 'Дороже', value: 'price_desc' },
];

export default function FeedScreen() {
  const { session } = useAuth();
  const [favoriteListingIds, setFavoriteListingIds] = useState<Set<number>>(new Set());

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [minPriceStr, setMinPriceStr] = useState('');
  const [maxPriceStr, setMaxPriceStr] = useState('');
  const [rooms, setRooms] = useState<RoomsFilter>('any');
  const [sort, setSort] = useState<ListingsSort>('new');

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const loadSeq = useRef(0);

  const loadFavoriteIds = useCallback(async () => {
    if (!session) {
      setFavoriteListingIds(new Set());
      return;
    }
    const sb = tryGetSupabase();
    if (!sb) return;
    const { ids, error } = await fetchFavoriteListingIds(sb);
    if (!error) setFavoriteListingIds(ids);
  }, [session]);

  useEffect(() => {
    void loadFavoriteIds();
  }, [loadFavoriteIds]);

  useFocusEffect(
    useCallback(() => {
      void loadFavoriteIds();
    }, [loadFavoriteIds])
  );

  const onFavoriteToggle = useCallback(
    async (listingId: number, nextFavorite: boolean) => {
      const sb = tryGetSupabase();
      if (!sb || !session) return;
      setFavoriteListingIds((prev) => {
        const next = new Set(prev);
        if (nextFavorite) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
      const { error } = nextFavorite ? await addFavorite(sb, listingId) : await removeFavorite(sb, listingId);
      if (error) {
        setFavoriteListingIds((prev) => {
          const next = new Set(prev);
          if (nextFavorite) next.delete(listingId);
          else next.add(listingId);
          return next;
        });
        Alert.alert('RENTO', error.message);
      }
    },
    [session]
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 450);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryArgs = useMemo(
    () => ({
      search: debouncedSearch,
      district: district.trim(),
      minPrice: parseOptionalLong(minPriceStr),
      maxPrice: parseOptionalLong(maxPriceStr),
      rooms,
      sort,
    }),
    [debouncedSearch, district, minPriceStr, maxPriceStr, rooms, sort]
  );

  const loadFromStart = useCallback(async () => {
    const sb = tryGetSupabase();
    const seq = ++loadSeq.current;
    if (!sb) {
      setErrorText('Добавьте ключи Supabase в .env и перезапустите приложение.');
      setListings([]);
      setLoading(false);
      setRefreshing(false);
      setHasMore(false);
      return;
    }
    setLoading(true);
    setErrorText(null);
    const { rows, error } = await fetchListingsPage(sb, {
      ...queryArgs,
      offset: 0,
    });
    if (seq !== loadSeq.current) return;
    setLoading(false);
    setRefreshing(false);
    if (error) {
      setErrorText(mapQueryError(error));
      setListings([]);
      setHasMore(false);
      return;
    }
    setListings(rows);
    setHasMore(rows.length >= LISTINGS_PAGE_SIZE);
  }, [queryArgs]);

  useEffect(() => {
    void loadFromStart();
  }, [loadFromStart]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFromStart();
  }, [loadFromStart]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    const sb = tryGetSupabase();
    if (!sb) return;
    setLoadingMore(true);
    const { rows, error } = await fetchListingsPage(sb, {
      ...queryArgs,
      offset: listings.length,
    });
    setLoadingMore(false);
    if (error) {
      setErrorText(mapQueryError(error));
      return;
    }
    if (rows.length < LISTINGS_PAGE_SIZE) setHasMore(false);
    if (rows.length) setListings((prev) => [...prev, ...rows]);
  }, [hasMore, loadingMore, loading, listings.length, queryArgs]);

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setDebouncedSearch('');
    setDistrict('');
    setMinPriceStr('');
    setMaxPriceStr('');
    setRooms('any');
    setSort('new');
  }, []);

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <TextInput
          style={styles.input}
          placeholder="Поиск по названию или району"
          placeholderTextColor="#9ca3af"
          value={searchInput}
          onChangeText={setSearchInput}
          returnKeyType="search"
        />
        <TextInput
          style={styles.input}
          placeholder="Район (точнее)"
          placeholderTextColor="#9ca3af"
          value={district}
          onChangeText={setDistrict}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.inputHalf]}
            placeholder="Цена от"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            value={minPriceStr}
            onChangeText={setMinPriceStr}
          />
          <TextInput
            style={[styles.input, styles.inputHalf]}
            placeholder="Цена до"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            value={maxPriceStr}
            onChangeText={setMaxPriceStr}
          />
        </View>

        <Text style={styles.sectionLabel}>Комнаты</Text>
        <View style={styles.chipsRow}>
          {ROOM_CHIPS.map((c) => {
            const active = rooms === c.value;
            return (
              <Pressable
                key={String(c.value)}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setRooms(c.value)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Сортировка</Text>
        <View style={styles.chipsRow}>
          {SORT_OPTIONS.map((c) => {
            const active = sort === c.value;
            return (
              <Pressable
                key={c.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSort(c.value)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.resetBtn} onPress={resetFilters}>
          <Text style={styles.resetBtnText}>Сбросить фильтры</Text>
        </Pressable>

        {errorText ? <Text style={styles.banner}>{errorText}</Text> : null}
      </View>
    ),
    [searchInput, district, minPriceStr, maxPriceStr, rooms, sort, errorText, resetFilters]
  );

  if (loading && listings.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingHint}>Загружаем объявления…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <ListingCard
          listing={item}
          favoriteListingIds={session ? favoriteListingIds : null}
          onFavoriteToggle={session ? onFavoriteToggle : undefined}
        />
      )}
      ListHeaderComponent={header}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onEndReachedThreshold={0.35}
      onEndReached={() => {
        void loadMore();
      }}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator style={styles.footer} color="#0d9488" />
        ) : (
          <View style={styles.footerSpacer} />
        )
      }
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Пока ничего нет</Text>
            <Text style={styles.emptyHint}>Измените фильтры или зайдите позже.</Text>
          </View>
        ) : null
      }
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingHint: { marginTop: 12, fontSize: 15, color: '#6b7280' },
  listContent: { paddingTop: 8, paddingBottom: 24 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', gap: 10 },
  inputHalf: { flex: 1 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8, marginTop: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#ccfbf1', borderColor: '#0d9488' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextActive: { color: '#0f766e', fontWeight: '600' },
  resetBtn: { alignSelf: 'flex-start', marginBottom: 8, paddingVertical: 8 },
  resetBtnText: { fontSize: 15, color: '#0d9488', fontWeight: '600' },
  banner: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  footer: { marginVertical: 16 },
  footerSpacer: { height: 8 },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  emptyHint: { marginTop: 8, fontSize: 15, color: '#6b7280', textAlign: 'center' },
});
