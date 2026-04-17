import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'listing-images';

function extFromUri(uri: string): string {
  const m = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
  const e = (m?.[1] ?? 'jpg').toLowerCase();
  if (e === 'jpeg') return 'jpg';
  return e.length <= 8 ? e : 'jpg';
}

/**
 * Загрузка обложки в `listing-images` с путём `{user_id}/...` (RLS Storage).
 * Возвращает публичный URL для поля `image_url`.
 */
export async function uploadListingCover(
  client: SupabaseClient,
  userId: string,
  localUri: string
): Promise<{ publicUrl: string; error: Error | null }> {
  const ext = extFromUri(localUri);
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `${userId}/${name}`;

  try {
    const res = await fetch(localUri);
    const blob = await res.blob();
    const contentType = blob.type && blob.type !== '' ? blob.type : 'image/jpeg';
    const { error } = await client.storage.from(BUCKET).upload(path, blob, {
      contentType,
      upsert: true,
    });
    if (error) {
      return { publicUrl: '', error: new Error(error.message) };
    }
    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, error: null };
  } catch (e) {
    return {
      publicUrl: '',
      error: e instanceof Error ? e : new Error('Не удалось прочитать файл'),
    };
  }
}

/** Удаляет объект в бакете по публичному URL обложки (если URL из этого бакета). */
export async function removeListingCoverByPublicUrl(
  client: SupabaseClient,
  imageUrl: string | null | undefined
): Promise<void> {
  if (!imageUrl) return;
  const marker = `/object/public/${BUCKET}/`;
  const i = imageUrl.indexOf(marker);
  if (i < 0) return;
  let path = decodeURIComponent(imageUrl.slice(i + marker.length));
  const q = path.indexOf('?');
  if (q >= 0) path = path.slice(0, q);
  if (!path || path.includes('..')) return;
  await client.storage.from(BUCKET).remove([path]);
}
