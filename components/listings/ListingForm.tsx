import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { insertListing, updateListing, type ListingDraft } from '@/core/api/myListings';
import { useAuth } from '@/core/auth/AuthContext';
import { tryGetSupabase } from '@/core/supabase/client';
import { uploadListingCover } from '@/core/storage/listingCoverUpload';
import type { Listing } from '@/core/types/database';

type Props = {
  mode: 'create' | 'edit';
  /** Для режима edit */
  initial?: Listing | null;
  onSuccess: () => void;
};

function parsePositiveInt(raw: string, label: string): { ok: true; value: number } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: false, message: `Заполните поле «${label}».` };
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return { ok: false, message: `«${label}» — целое число от 1.` };
  }
  return { ok: true, value: n };
}

function parseOptionalCoord(raw: string): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: null };
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n)) return { ok: false, message: 'Неверные координаты.' };
  return { ok: true, value: n };
}

export function ListingForm({ mode, initial, onSuccess }: Props) {
  const { user } = useAuth();
  const uid = user?.id;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [district, setDistrict] = useState(initial?.district ?? '');
  const [roomsStr, setRoomsStr] = useState(initial != null ? String(initial.rooms) : '');
  const [priceStr, setPriceStr] = useState(initial != null ? String(initial.price) : '');
  const [latStr, setLatStr] = useState(
    initial?.latitude != null ? String(initial.latitude) : ''
  );
  const [lngStr, setLngStr] = useState(
    initial?.longitude != null ? String(initial.longitude) : ''
  );
  const [remoteImageUrl, setRemoteImageUrl] = useState<string | null>(initial?.image_url ?? null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const previewUri = localImageUri ?? remoteImageUrl;

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('RENTO', 'Нужен доступ к галерее, чтобы выбрать фото.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setLocalImageUri(res.assets[0].uri);
      setFormError(null);
    }
  }, []);

  const clearLocalImage = useCallback(() => {
    setLocalImageUri(null);
  }, []);

  const buildDraft = useCallback((): { ok: true; draft: ListingDraft } | { ok: false; message: string } => {
    const r = parsePositiveInt(roomsStr, 'Комнаты');
    if (!r.ok) return r;
    const p = parsePositiveInt(priceStr, 'Цена');
    if (!p.ok) return p;
    const la = parseOptionalCoord(latStr);
    if (!la.ok) return la;
    const lo = parseOptionalCoord(lngStr);
    if (!lo.ok) return lo;
    if ((la.value == null) !== (lo.value == null)) {
      return { ok: false, message: 'Укажите обе координаты или оставьте обе пустыми.' };
    }
    if (!title.trim()) return { ok: false, message: 'Введите заголовок.' };
    if (!district.trim()) return { ok: false, message: 'Введите район.' };
    const image_url = localImageUri ? null : remoteImageUrl;
    return {
      ok: true,
      draft: {
        title: title.trim(),
        district: district.trim(),
        rooms: r.value,
        price: p.value,
        image_url,
        latitude: la.value,
        longitude: lo.value,
      },
    };
  }, [title, district, roomsStr, priceStr, latStr, lngStr, localImageUri, remoteImageUrl, mode]);

  const submitLabel = useMemo(() => (mode === 'create' ? 'Опубликовать' : 'Сохранить'), [mode]);

  const onSubmit = useCallback(async () => {
    setFormError(null);
    const sb = tryGetSupabase();
    if (!sb || !uid) {
      setFormError('Войдите в аккаунт.');
      return;
    }
    const built = buildDraft();
    if (!built.ok) {
      setFormError(built.message);
      return;
    }
    let draft = built.draft;
    if (localImageUri) {
      setSaving(true);
      const up = await uploadListingCover(sb, uid, localImageUri);
      setSaving(false);
      if (up.error) {
        setFormError(up.error.message);
        return;
      }
      draft = { ...draft, image_url: up.publicUrl };
    } else if (mode === 'create' && !draft.image_url) {
      draft = { ...draft, image_url: null };
    }
    setSaving(true);
    if (mode === 'create') {
      const { error } = await insertListing(sb, uid, draft);
      setSaving(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    } else if (initial) {
      const { error } = await updateListing(sb, initial.id, draft);
      setSaving(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    }
    setSaving(false);
    onSuccess();
  }, [buildDraft, localImageUri, mode, initial, onSuccess, uid]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Заголовок</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Кратко о жилье" />

        <Text style={styles.label}>Район</Text>
        <TextInput style={styles.input} value={district} onChangeText={setDistrict} placeholder="Например, Чиланзар" />

        <Text style={styles.label}>Комнаты</Text>
        <TextInput
          style={styles.input}
          value={roomsStr}
          onChangeText={setRoomsStr}
          placeholder="Число от 1"
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Цена (сум / месяц)</Text>
        <TextInput
          style={styles.input}
          value={priceStr}
          onChangeText={setPriceStr}
          placeholder="Только цифры"
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Широта / долгота (необязательно, для карты)</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.half]}
            value={latStr}
            onChangeText={setLatStr}
            placeholder="Широта"
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, styles.half]}
            value={lngStr}
            onChangeText={setLngStr}
            placeholder="Долгота"
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.label}>Обложка</Text>
        <Pressable style={styles.pickBtn} onPress={pickImage}>
          <Text style={styles.pickBtnText}>{localImageUri || remoteImageUrl ? 'Сменить фото' : 'Выбрать фото'}</Text>
        </Pressable>
        {localImageUri ? (
          <Pressable onPress={clearLocalImage}>
            <Text style={styles.clearPhoto}>Убрать новое фото (останется старое)</Text>
          </Pressable>
        ) : null}
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.preview} contentFit="cover" />
        ) : (
          <Text style={styles.hint}>Без фото тоже можно опубликовать.</Text>
        )}

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <Pressable
          style={[styles.submit, saving && styles.submitDisabled]}
          onPress={() => void onSubmit()}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{submitLabel}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  pickBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0f2f1',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  pickBtnText: { color: '#0f766e', fontWeight: '600' },
  clearPhoto: { color: '#0d9488', marginBottom: 8, fontSize: 14 },
  preview: { width: '100%', height: 200, borderRadius: 12, marginTop: 8 },
  hint: { color: '#888', marginTop: 8 },
  error: { color: '#b91c1c', marginTop: 12, lineHeight: 22 },
  submit: {
    marginTop: 24,
    backgroundColor: '#0d9488',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
