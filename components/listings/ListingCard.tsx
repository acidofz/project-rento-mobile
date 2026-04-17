import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image } from 'expo-image';
import { Link, type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPriceSom } from '@/core/format/price';
import type { Listing } from '@/core/types/database';

type Props = {
  listing: Listing;
  /**
   * Избранное: не передано — иконку не показываем.
   * `null` — гость: иконка ведёт на вход.
   * `Set` — авторизованный: закрашенное / пустое и переключение.
   */
  favoriteListingIds?: Set<number> | null;
  /** Для авторизованного: `next === true` — добавить в избранное. */
  onFavoriteToggle?: (listingId: number, nextFavorite: boolean) => void;
};

function roomsLabel(rooms: number): string {
  if (rooms >= 5) return `${rooms} комнат`;
  if (rooms === 1) return '1 комната';
  if (rooms >= 2 && rooms <= 4) return `${rooms} комнаты`;
  return `${rooms} комн.`;
}

export function ListingCard({ listing, favoriteListingIds, onFavoriteToggle }: Props) {
  const router = useRouter();
  const showFavorite = favoriteListingIds !== undefined;
  const isGuest = favoriteListingIds === null;
  const isFavorite = favoriteListingIds instanceof Set && favoriteListingIds.has(listing.id);

  return (
    <View style={styles.card}>
      <Link href={`/listing/${listing.id}` as Href} asChild style={styles.cardLink}>
        <Pressable style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}>
          <View style={styles.thumbWrap}>
            {listing.image_url ? (
              <Image
                source={{ uri: listing.image_url }}
                style={styles.thumb}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <Text style={styles.thumbPlaceholderText}>Нет фото</Text>
              </View>
            )}
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={2}>
              {listing.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {listing.district} · {roomsLabel(listing.rooms)}
            </Text>
            <Text style={styles.price}>{formatPriceSom(Number(listing.price))}</Text>
          </View>
        </Pressable>
      </Link>
      {showFavorite ? (
        <Pressable
          style={styles.favBtn}
          hitSlop={10}
          onPress={() => {
            if (isGuest) {
              router.push('/(auth)/login' as Href);
              return;
            }
            onFavoriteToggle?.(listing.id, !isFavorite);
          }}
          accessibilityLabel={isGuest ? 'Войти, чтобы сохранить' : isFavorite ? 'Убрать из избранного' : 'В избранное'}>
          <FontAwesome
            name={isFavorite ? 'heart' : 'heart-o'}
            size={22}
            color={isFavorite ? '#e11d48' : '#9ca3af'}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingRight: 4,
    paddingVertical: 12,
    paddingLeft: 12,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLink: { flex: 1, minWidth: 0 },
  cardMain: { flexDirection: 'row', flex: 1, gap: 12 },
  pressed: { opacity: 0.92 },
  thumbWrap: { width: 104, height: 104, borderRadius: 10, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { fontSize: 12, color: '#9ca3af' },
  body: { flex: 1, justifyContent: 'space-between', minWidth: 0 },
  title: { fontSize: 16, fontWeight: '600', color: '#111', lineHeight: 22 },
  meta: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  price: { fontSize: 17, fontWeight: '700', color: '#0d9488', marginTop: 8 },
  favBtn: { width: 44, alignItems: 'center', justifyContent: 'center' },
});
