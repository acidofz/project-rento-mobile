import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { findOrCreatePeerChat } from '@/core/api/chats';
import { addFavorite, fetchIsFavorite, removeFavorite } from '@/core/api/favorites';
import { fetchListingById } from '@/core/api/listings';
import { useAuth } from '@/core/auth/AuthContext';
import { mapQueryError } from '@/core/errors/mapSupabaseError';
import { formatPriceSom } from '@/core/format/price';
import { tryGetSupabase } from '@/core/supabase/client';
import type { Listing } from '@/core/types/database';

function roomsLabel(rooms: number): string {
  if (rooms === 1) return '1 комната';
  if (rooms >= 2 && rooms <= 4) return `${rooms} комнаты`;
  return `${rooms} комнат`;
}

export default function ListingDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { user, canCreateContent } = useAuth();
  const id = Number(idParam);
  const validId = Number.isFinite(id) && id > 0;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoaded, setFavoriteLoaded] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  const load = useCallback(async () => {
    if (!validId) {
      setErrorText('Некорректная ссылка.');
      setLoading(false);
      return;
    }
    const sb = tryGetSupabase();
    if (!sb) {
      setErrorText('Приложение не настроено: нет ключей Supabase.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorText(null);
    const { row, error } = await fetchListingById(sb, id);
    setLoading(false);
    if (error) {
      setListing(null);
      setErrorText(mapQueryError(error));
      return;
    }
    if (!row) {
      setListing(null);
      setErrorText('Объявление не найдено или снято.');
      return;
    }
    setListing(row);
  }, [id, validId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOwn = useMemo(
    () => !!(user?.id && listing?.owner_id && user.id === listing.owner_id),
    [user?.id, listing?.owner_id]
  );

  useEffect(() => {
    if (!listing || !user || isOwn) {
      setIsFavorite(false);
      setFavoriteLoaded(true);
      return;
    }
    setFavoriteLoaded(false);
    const sb = tryGetSupabase();
    if (!sb) {
      setFavoriteLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { favorite, error } = await fetchIsFavorite(sb, listing.id);
      if (cancelled) return;
      setFavoriteLoaded(true);
      if (!error) setIsFavorite(favorite);
    })();
    return () => {
      cancelled = true;
    };
  }, [listing?.id, user?.id, isOwn, listing]);

  const handleHeaderFavorite = useCallback(async () => {
    if (!listing || isOwn) return;
    if (!user) {
      router.push('/(auth)/login' as Href);
      return;
    }
    if (favoriteBusy || !favoriteLoaded) return;
    const sb = tryGetSupabase();
    if (!sb) return;
    const next = !isFavorite;
    setFavoriteBusy(true);
    setIsFavorite(next);
    const { error } = next ? await addFavorite(sb, listing.id) : await removeFavorite(sb, listing.id);
    setFavoriteBusy(false);
    if (error) {
      setIsFavorite(!next);
      Alert.alert('RENTO', error.message);
    }
  }, [listing, isOwn, user, isFavorite, favoriteBusy, favoriteLoaded, router]);

  useLayoutEffect(() => {
    if (!listing || isOwn) {
      navigation.setOptions({ headerRight: () => null });
      return;
    }
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => {
            void handleHeaderFavorite();
          }}
          disabled={favoriteBusy || (!!user && !favoriteLoaded)}
          style={{ marginRight: 8, padding: 8 }}
          accessibilityLabel={
            user ? (isFavorite ? 'Убрать из избранного' : 'В избранное') : 'Войти, чтобы сохранить'
          }>
          <FontAwesome
            name={user && isFavorite ? 'heart' : 'heart-o'}
            size={22}
            color={user && isFavorite ? '#e11d48' : '#9ca3af'}
          />
        </Pressable>
      ),
    });
  }, [
    navigation,
    listing,
    isOwn,
    user,
    isFavorite,
    favoriteLoaded,
    favoriteBusy,
    handleHeaderFavorite,
  ]);

  const openChatWithOwner = useCallback(async () => {
    if (!listing || !user) return;
    const ownerId = listing.owner_id;
    if (!ownerId) {
      Alert.alert('RENTO', 'У объявления не указан владелец.');
      return;
    }
    const sb = tryGetSupabase();
    if (!sb) {
      Alert.alert('RENTO', 'Нет подключения к серверу.');
      return;
    }
    setOpeningChat(true);
    const { chatId, error } = await findOrCreatePeerChat(sb, ownerId);
    setOpeningChat(false);
    if (error || chatId == null) {
      Alert.alert('RENTO', error?.message ?? 'Не удалось открыть чат.');
      return;
    }
    router.push(`/chat/${chatId}` as Href);
  }, [listing, user, router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Stack.Screen options={{ title: 'Объявление' }} />
      </View>
    );
  }

  if (errorText || !listing) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Объявление' }} />
        <Text style={styles.error}>{errorText ?? 'Нет данных.'}</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Назад</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: listing.title.slice(0, 40) }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          {listing.image_url ? (
            <Image
              source={{ uri: listing.image_url }}
              style={styles.heroImg}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.heroImg, styles.heroPlaceholder]}>
              <Text style={styles.heroPlaceholderText}>Нет фото</Text>
            </View>
          )}
        </View>

        <Text style={styles.price}>{formatPriceSom(Number(listing.price))}</Text>
        <Text style={styles.title}>{listing.title}</Text>
        <Text style={styles.line}>
          {listing.district} · {roomsLabel(listing.rooms)}
        </Text>

        {isOwn ? (
          <View style={styles.ownBlock}>
            <Text style={styles.own}>Это ваше объявление.</Text>
            {canCreateContent ? (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => router.push(`/my-listings/${listing.id}/edit` as Href)}>
                <Text style={styles.secondaryBtnText}>Редактировать</Text>
              </Pressable>
            ) : null}
          </View>
        ) : user ? (
          canCreateContent ? (
            <Pressable
              style={[styles.primaryBtn, openingChat && styles.primaryBtnDisabled]}
              onPress={() => void openChatWithOwner()}
              disabled={openingChat}>
              {openingChat ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Написать владельцу</Text>
              )}
            </Pressable>
          ) : (
            <Text style={styles.restricted}>Действия с объявлениями для вашего аккаунта ограничены.</Text>
          )
        ) : (
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.primaryBtnText}>Войдите, чтобы написать</Text>
          </Pressable>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { paddingBottom: 32 },
  hero: { backgroundColor: '#f3f4f6' },
  heroImg: { width: '100%', aspectRatio: 16 / 9 },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroPlaceholderText: { color: '#9ca3af', fontSize: 16 },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0d9488',
    marginTop: 16,
    marginHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginTop: 8,
    marginHorizontal: 16,
    lineHeight: 28,
  },
  line: { fontSize: 16, color: '#6b7280', marginTop: 8, marginHorizontal: 16 },
  ownBlock: { marginTop: 20, marginHorizontal: 16 },
  own: { fontSize: 15, color: '#374151', marginBottom: 12 },
  restricted: {
    marginHorizontal: 16,
    marginTop: 24,
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
  },
  primaryBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#0d9488',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryBtnDisabled: { opacity: 0.75 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  secondaryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600', color: '#111' },
  error: { fontSize: 16, color: '#b91c1c', textAlign: 'center', lineHeight: 24 },
});
