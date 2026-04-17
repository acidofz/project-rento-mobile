import type { SupabaseClient } from '@supabase/supabase-js';

import type { Listing } from '@/core/types/database';

export async function fetchMyListings(
  client: SupabaseClient,
  ownerId: string
): Promise<{ rows: Listing[]; error: Error | null }> {
  const { data, error } = await client
    .from('listings')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) {
    return { rows: [], error: new Error(error.message) };
  }
  return { rows: (data ?? []) as Listing[], error: null };
}

export type ListingDraft = {
  title: string;
  district: string;
  rooms: number;
  price: number;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function insertListing(
  client: SupabaseClient,
  ownerId: string,
  draft: ListingDraft
): Promise<{ id: number | null; error: Error | null }> {
  const { data, error } = await client
    .from('listings')
    .insert({
      title: draft.title.trim(),
      district: draft.district.trim(),
      rooms: draft.rooms,
      price: draft.price,
      owner_id: ownerId,
      image_url: draft.image_url,
      latitude: draft.latitude,
      longitude: draft.longitude,
    })
    .select('id')
    .single();
  if (error) {
    return { id: null, error: new Error(error.message) };
  }
  const row = data as { id: number } | null;
  return { id: row?.id ?? null, error: null };
}

export async function updateListing(
  client: SupabaseClient,
  listingId: number,
  draft: ListingDraft
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from('listings')
    .update({
      title: draft.title.trim(),
      district: draft.district.trim(),
      rooms: draft.rooms,
      price: draft.price,
      image_url: draft.image_url,
      latitude: draft.latitude,
      longitude: draft.longitude,
    })
    .eq('id', listingId);
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

export async function deleteListing(
  client: SupabaseClient,
  listingId: number
): Promise<{ error: Error | null }> {
  const { error } = await client.from('listings').delete().eq('id', listingId);
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}
