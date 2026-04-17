import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker, type Region } from 'react-native-maps';

import { fetchListingsWithCoordinates } from '@/core/api/listings';
import { mapQueryError } from '@/core/errors/mapSupabaseError';
import { formatPriceSom } from '@/core/format/price';
import { tryGetSupabase } from '@/core/supabase/client';
import type { Listing } from '@/core/types/database';

const TASHKENT: Region = {
  latitude: 41.3111,
  longitude: 69.2797,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export default function MapTabContent() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
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

  useEffect(() => {
    if (rows.length === 0) return;
    const coords = rows.map((r) => ({
      latitude: r.latitude as number,
      longitude: r.longitude as number,
    }));
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 120, left: 40 },
        animated: true,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [rows]);

  const onRefreshTap = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  return (
    <View style={styles.root}>
      <MapView ref={mapRef} style={styles.map} initialRegion={TASHKENT} showsUserLocation={false}>
        {rows.map((listing) => (
          <Marker
            key={listing.id}
            coordinate={{ latitude: listing.latitude as number, longitude: listing.longitude as number }}
            tracksViewChanges={false}>
            <Callout
              onPress={() => router.push(`/listing/${listing.id}` as Href)}
              tooltip
              style={styles.calloutOuter}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle} numberOfLines={2}>
                  {listing.title}
                </Text>
                <Text style={styles.calloutMeta} numberOfLines={1}>
                  {listing.district} · {formatPriceSom(Number(listing.price))}
                </Text>
                <Text style={styles.calloutLink}>Открыть объявление</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {loading && rows.length === 0 ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.overlayText}>Загружаем точки на карте…</Text>
        </View>
      ) : null}

      {errorText ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{errorText}</Text>
        </View>
      ) : null}

      {rows.length === 0 && !loading ? (
        <View style={styles.hintCard}>
          <Text style={styles.hintTitle}>Пока нет меток</Text>
          <Text style={styles.hintBody}>
            Координаты задаются при создании или редактировании объявления. После сохранения точка
            появится здесь.
          </Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.refreshFab,
          { top: errorText ? 72 : 12 },
          pressed && styles.refreshFabPressed,
        ]}
        onPress={() => void onRefreshTap()}
        disabled={refreshing || loading}>
        {refreshing ? (
          <ActivityIndicator color="#0f766e" />
        ) : (
          <Text style={styles.refreshFabText}>Обновить</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  overlayText: { marginTop: 12, fontSize: 15, color: '#4b5563' },
  banner: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 10,
  },
  bannerText: { color: '#92400e', fontSize: 14, lineHeight: 20 },
  hintCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  hintTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  hintBody: { marginTop: 8, fontSize: 15, color: '#4b5563', lineHeight: 22 },
  calloutOuter: { width: 260 },
  callout: { padding: 10 },
  calloutTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  calloutMeta: { marginTop: 6, fontSize: 14, color: '#6b7280' },
  calloutLink: { marginTop: 10, fontSize: 15, fontWeight: '600', color: '#0d9488' },
  refreshFab: {
    position: 'absolute',
    right: 12,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    minWidth: 100,
    alignItems: 'center',
  },
  refreshFabPressed: { opacity: 0.9 },
  refreshFabText: { fontSize: 14, fontWeight: '600', color: '#0f766e' },
});
