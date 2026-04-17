import type { SupabaseClient } from '@supabase/supabase-js';

import type { Listing } from '@/core/types/database';

const PAGE_SIZE = 20;

export type ListingsSort = 'new' | 'price_asc' | 'price_desc';

/** Фильтр комнат: точное число или «4 и больше». */
export type RoomsFilter = 'any' | '4plus' | number;

export type ListingsQuery = {
  search: string;
  district: string;
  minPrice: number | null;
  maxPrice: number | null;
  rooms: RoomsFilter;
  sort: ListingsSort;
  offset: number;
};

function sanitizeIlikeFragment(raw: string): string {
  return raw.replace(/[%*,()]/g, ' ').trim();
}

/**
 * Загрузка страницы объявлений. RLS: чтение доступно anon + authenticated.
 */
export async function fetchListingsPage(
  client: SupabaseClient,
  q: ListingsQuery
): Promise<{ rows: Listing[]; error: Error | null }> {
  let query = client.from('listings').select('*');

  const search = sanitizeIlikeFragment(q.search);
  if (search.length > 0) {
    const pattern = `%${search}%`;
    query = query.or(`title.ilike.${pattern},district.ilike.${pattern}`);
  }

  const district = sanitizeIlikeFragment(q.district);
  if (district.length > 0) {
    query = query.ilike('district', `%${district}%`);
  }

  if (q.minPrice != null && Number.isFinite(q.minPrice)) {
    query = query.gte('price', q.minPrice);
  }
  if (q.maxPrice != null && Number.isFinite(q.maxPrice)) {
    query = query.lte('price', q.maxPrice);
  }

  if (q.rooms === '4plus') {
    query = query.gte('rooms', 4);
  } else if (typeof q.rooms === 'number') {
    query = query.eq('rooms', q.rooms);
  }

  switch (q.sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'new':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  const from = q.offset;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error } = await query;
  if (error) {
    return { rows: [], error: new Error(error.message) };
  }
  return { rows: (data ?? []) as Listing[], error: null };
}

export const LISTINGS_PAGE_SIZE = PAGE_SIZE;

export async function fetchListingById(
  client: SupabaseClient,
  id: number
): Promise<{ row: Listing | null; error: Error | null }> {
  const { data, error } = await client.from('listings').select('*').eq('id', id).maybeSingle();
  if (error) {
    return { row: null, error: new Error(error.message) };
  }
  return { row: (data as Listing | null) ?? null, error: null };
}
