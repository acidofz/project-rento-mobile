import type { SupabaseClient } from '@supabase/supabase-js';

import type { Listing } from '@/core/types/database';

/**
 * ID объявлений в избранном текущего пользователя (RLS: только свои строки).
 */
export async function fetchFavoriteListingIds(
  client: SupabaseClient
): Promise<{ ids: Set<number>; error: Error | null }> {
  const { data, error } = await client.from('favorites').select('listing_id');
  if (error) {
    return { ids: new Set(), error: new Error(error.message) };
  }
  const ids = new Set<number>();
  for (const row of data ?? []) {
    const id = (row as { listing_id: number }).listing_id;
    if (typeof id === 'number' && Number.isFinite(id)) ids.add(id);
  }
  return { ids, error: null };
}

export async function fetchFavoriteListings(
  client: SupabaseClient
): Promise<{ rows: Listing[]; error: Error | null }> {
  const { data, error } = await client
    .from('favorites')
    .select('created_at, listings(*)')
    .order('created_at', { ascending: false });

  if (error) {
    return { rows: [], error: new Error(error.message) };
  }

  const rows: Listing[] = [];
  for (const row of data ?? []) {
    const listing = (row as { listings: Listing | Listing[] | null }).listings;
    if (listing == null) continue;
    const one = Array.isArray(listing) ? listing[0] : listing;
    if (one && typeof one.id === 'number') rows.push(one as Listing);
  }
  return { rows, error: null };
}

export async function addFavorite(
  client: SupabaseClient,
  listingId: number
): Promise<{ error: Error | null }> {
  const { data: auth, error: authErr } = await client.auth.getUser();
  if (authErr || !auth.user) {
    return { error: new Error(authErr?.message ?? 'Не авторизован') };
  }
  const { error } = await client.from('favorites').insert({
    user_id: auth.user.id,
    listing_id: listingId,
  });
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

export async function removeFavorite(
  client: SupabaseClient,
  listingId: number
): Promise<{ error: Error | null }> {
  const { error } = await client.from('favorites').delete().eq('listing_id', listingId);
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

/** Одна строка избранного для объявления (для экрана детали). */
export async function fetchIsFavorite(
  client: SupabaseClient,
  listingId: number
): Promise<{ favorite: boolean; error: Error | null }> {
  const { count, error } = await client
    .from('favorites')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId);

  if (error) {
    return { favorite: false, error: new Error(error.message) };
  }
  return { favorite: (count ?? 0) > 0, error: null };
}
