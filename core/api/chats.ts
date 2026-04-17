import type { SupabaseClient } from '@supabase/supabase-js';

import type { Message } from '@/core/types/database';

export type ChatListRow = {
  id: number;
  created_at: string;
  peerId: string;
  peerUsername: string | null;
  lastBody: string | null;
  lastCreatedAt: string | null;
};

/**
 * RPC из `supabase_schema.sql`: один чат на пару (ровно два участника) или новый чат.
 */
export async function findOrCreatePeerChat(
  client: SupabaseClient,
  peerId: string
): Promise<{ chatId: number | null; error: Error | null }> {
  const { data, error } = await client.rpc('find_or_create_peer_chat', { p_peer_id: peerId });
  if (error) {
    return { chatId: null, error: new Error(error.message) };
  }
  const n = typeof data === 'number' ? data : Number(data);
  if (!Number.isFinite(n) || n <= 0) {
    return { chatId: null, error: new Error('Некорректный ответ сервера') };
  }
  return { chatId: n, error: null };
}

export async function fetchMyChatsList(
  client: SupabaseClient,
  myUserId: string
): Promise<{ rows: ChatListRow[]; error: Error | null }> {
  // Без вложенного select chats→chat_members: у PostgREST/RLS это часто ломается; три простых запроса.
  const { data: myRows, error: myErr } = await client
    .from('chat_members')
    .select('chat_id')
    .eq('user_id', myUserId);

  if (myErr) {
    return { rows: [], error: new Error(myErr.message) };
  }

  const chatIds = [...new Set((myRows ?? []).map((r) => (r as { chat_id: number }).chat_id))];
  if (chatIds.length === 0) {
    return { rows: [], error: null };
  }

  const { data: chats, error: chatsErr } = await client
    .from('chats')
    .select('id, created_at')
    .in('id', chatIds)
    .order('created_at', { ascending: false });

  if (chatsErr) {
    return { rows: [], error: new Error(chatsErr.message) };
  }

  const { data: memberRows, error: memErr } = await client
    .from('chat_members')
    .select('chat_id, user_id')
    .in('chat_id', chatIds);

  if (memErr) {
    return { rows: [], error: new Error(memErr.message) };
  }

  const membersByChat = new Map<number, string[]>();
  for (const row of memberRows ?? []) {
    const r = row as { chat_id: number; user_id: string };
    const list = membersByChat.get(r.chat_id) ?? [];
    list.push(r.user_id);
    membersByChat.set(r.chat_id, list);
  }

  const rowsDraft: { id: number; created_at: string; peerId: string }[] = [];
  for (const c of chats ?? []) {
    const chat = c as { id: number; created_at: string };
    const ids = membersByChat.get(chat.id) ?? [];
    const peerId = ids.find((id) => id !== myUserId);
    if (!peerId) continue;
    rowsDraft.push({ id: chat.id, created_at: chat.created_at, peerId });
  }

  if (rowsDraft.length === 0) {
    return { rows: [], error: null };
  }

  const finalChatIds = rowsDraft.map((r) => r.id);

  const peerIds = [...new Set(rowsDraft.map((r) => r.peerId))];
  const { data: profiles } = await client.from('profiles').select('id, username').in('id', peerIds);
  const usernameById = new Map<string, string | null>();
  for (const p of profiles ?? []) {
    const row = p as { id: string; username: string | null };
    usernameById.set(row.id, row.username);
  }

  const { data: recentMsgs, error: msgErr } = await client
    .from('messages')
    .select('chat_id, body, created_at')
    .in('chat_id', finalChatIds)
    .order('created_at', { ascending: false })
    .limit(300);

  if (msgErr) {
    return { rows: [], error: new Error(msgErr.message) };
  }

  const lastByChat = new Map<number, { body: string; created_at: string }>();
  for (const m of recentMsgs ?? []) {
    const row = m as { chat_id: number; body: string; created_at: string };
    if (!lastByChat.has(row.chat_id)) {
      lastByChat.set(row.chat_id, { body: row.body, created_at: row.created_at });
    }
  }

  const rows: ChatListRow[] = rowsDraft.map((r) => {
    const last = lastByChat.get(r.id);
    return {
      ...r,
      peerUsername: usernameById.get(r.peerId) ?? null,
      lastBody: last?.body ?? null,
      lastCreatedAt: last?.created_at ?? null,
    };
  });

  return { rows, error: null };
}

const MESSAGE_PAGE = 80;

export async function fetchMessagesPage(
  client: SupabaseClient,
  chatId: number
): Promise<{ rows: Message[]; error: Error | null }> {
  const { data, error } = await client
    .from('messages')
    .select('id, chat_id, sender_id, body, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE);

  if (error) {
    return { rows: [], error: new Error(error.message) };
  }
  const rows = ((data ?? []) as Message[]).slice().reverse();
  return { rows, error: null };
}

export async function sendChatMessage(
  client: SupabaseClient,
  chatId: number,
  senderId: string,
  body: string
): Promise<{ row: Message | null; error: Error | null }> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { row: null, error: new Error('Пустое сообщение') };
  }
  const { data, error } = await client
    .from('messages')
    .insert({ chat_id: chatId, sender_id: senderId, body: trimmed })
    .select('id, chat_id, sender_id, body, created_at')
    .single();

  if (error) {
    return { row: null, error: new Error(error.message) };
  }
  return { row: data as Message, error: null };
}

export async function fetchChatPeerSummary(
  client: SupabaseClient,
  chatId: number,
  myUserId: string
): Promise<{ peerId: string | null; peerUsername: string | null; error: Error | null }> {
  const { data, error } = await client.from('chat_members').select('user_id').eq('chat_id', chatId);
  if (error) {
    return { peerId: null, peerUsername: null, error: new Error(error.message) };
  }
  const ids = (data ?? []).map((r) => (r as { user_id: string }).user_id);
  const peerId = ids.find((id) => id !== myUserId) ?? null;
  if (!peerId) {
    return { peerId: null, peerUsername: null, error: null };
  }
  const { data: prof, error: pErr } = await client
    .from('profiles')
    .select('username')
    .eq('id', peerId)
    .maybeSingle();
  if (pErr) {
    return { peerId, peerUsername: null, error: new Error(pErr.message) };
  }
  const username = (prof as { username: string | null } | null)?.username ?? null;
  return { peerId, peerUsername: username, error: null };
}
