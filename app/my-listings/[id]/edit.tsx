import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ListingForm } from '@/components/listings/ListingForm';
import { deleteListing } from '@/core/api/myListings';
import { fetchListingById } from '@/core/api/listings';
import { useAuth } from '@/core/auth/AuthContext';
import { mapQueryError } from '@/core/errors/mapSupabaseError';
import { tryGetSupabase } from '@/core/supabase/client';
import { removeListingCoverByPublicUrl } from '@/core/storage/listingCoverUpload';
import type { Listing } from '@/core/types/database';

export default function EditListingScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, canCreateContent, user } = useAuth();
  const id = Number(idParam);
  const valid = Number.isFinite(id) && id > 0;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!valid) {
      setErrorText('Некорректная ссылка.');
      setLoading(false);
      return;
    }
    const sb = tryGetSupabase();
    if (!sb) {
      setErrorText('Нет настроек Supabase.');
      setLoading(false);
      return;
    }
    const { row, error } = await fetchListingById(sb, id);
    setLoading(false);
    if (error) {
      setErrorText(mapQueryError(error));
      setListing(null);
      return;
    }
    if (!row) {
      setErrorText('Объявление не найдено.');
      setListing(null);
      return;
    }
    if (user?.id && row.owner_id !== user.id) {
      setErrorText('Это не ваше объявление.');
      setListing(null);
      return;
    }
    setErrorText(null);
    setListing(row);
  }, [id, valid, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!canCreateContent) {
    return <Redirect href="/(tabs)/profile" />;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (errorText || !listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{errorText ?? 'Нет данных.'}</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Назад</Text>
        </Pressable>
      </View>
    );
  }

  function confirmDelete() {
    Alert.alert('Удалить объявление?', 'Действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => void doDelete(),
      },
    ]);
  }

  async function doDelete() {
    const l = listing;
    if (!l) return;
    const sb = tryGetSupabase();
    if (!sb) return;
    await removeListingCoverByPublicUrl(sb, l.image_url);
    const { error } = await deleteListing(sb, l.id);
    if (error) {
      Alert.alert('RENTO', error.message);
      return;
    }
    router.replace('/my-listings' as Href);
  }

  return (
    <View style={styles.root}>
      <View style={styles.formWrap}>
        <ListingForm
          key={String(listing.id)}
          mode="edit"
          initial={listing}
          onSuccess={() => router.replace('/my-listings' as Href)}
        />
      </View>
      <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
        <Text style={styles.deleteText}>Удалить объявление</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  formWrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#b91c1c', textAlign: 'center', marginBottom: 16 },
  btn: { backgroundColor: '#f3f4f6', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  btnText: { fontWeight: '600' },
  deleteBtn: { marginHorizontal: 16, marginTop: 8, padding: 16, alignItems: 'center' },
  deleteText: { color: '#b91c1c', fontWeight: '600', fontSize: 16 },
});
