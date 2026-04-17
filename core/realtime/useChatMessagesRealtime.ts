import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Message } from '@/core/types/database';

export type ChatRealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'subscribed'
  | 'channel_error'
  | 'timed_out'
  | 'closed';

type Options = {
  client: SupabaseClient | null;
  chatId: number | null;
  enabled: boolean;
  onInsert: (row: Message) => void;
};

/**
 * Подписка на INSERT в `public.messages` для одного чата (postgres_changes).
 * JWT для Realtime должен быть выставлен через `client.realtime.setAuth` (см. AuthContext).
 */
export function useChatMessagesRealtime({ client, chatId, enabled, onInsert }: Options): ChatRealtimeStatus {
  const [status, setStatus] = useState<ChatRealtimeStatus>('idle');
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  const handlePayload = useCallback((payload: { new: Record<string, unknown> }) => {
    const raw = payload.new;
    if (!raw || typeof raw !== 'object') return;
    const id = typeof raw.id === 'number' ? raw.id : Number(raw.id);
    const cid = typeof raw.chat_id === 'number' ? raw.chat_id : Number(raw.chat_id);
    if (!Number.isFinite(id) || !Number.isFinite(cid)) return;
    if (chatId != null && cid !== chatId) return;
    const row: Message = {
      id,
      chat_id: cid,
      sender_id: String(raw.sender_id ?? ''),
      body: String(raw.body ?? ''),
      created_at: String(raw.created_at ?? ''),
    };
    if (!row.sender_id) return;
    onInsertRef.current(row);
  }, [chatId]);

  useEffect(() => {
    if (!client || !enabled || chatId == null || !Number.isFinite(chatId) || chatId <= 0) {
      setStatus('idle');
      return;
    }

    setStatus('connecting');
    const channel = client
      .channel(`messages-insert:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => handlePayload(payload as { new: Record<string, unknown> })
      )
      .subscribe((subStatus, err) => {
        if (subStatus === 'SUBSCRIBED') {
          setStatus('subscribed');
          return;
        }
        if (subStatus === 'CHANNEL_ERROR') {
          setStatus('channel_error');
          if (__DEV__ && err) console.warn('[realtime messages]', err);
          return;
        }
        if (subStatus === 'TIMED_OUT') {
          setStatus('timed_out');
          return;
        }
        if (subStatus === 'CLOSED') {
          setStatus('closed');
        }
      });

    return () => {
      setStatus('closed');
      void client.removeChannel(channel);
    };
  }, [client, chatId, enabled, handlePayload]);

  return status;
}
