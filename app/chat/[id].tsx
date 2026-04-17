import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  fetchChatPeerSummary,
  fetchMessagesPage,
  sendChatMessage,
} from '@/core/api/chats';
import { useAuth } from '@/core/auth/AuthContext';
import { mapQueryError } from '@/core/errors/mapSupabaseError';
import { useChatMessagesRealtime } from '@/core/realtime/useChatMessagesRealtime';
import { tryGetSupabase } from '@/core/supabase/client';
import type { Message } from '@/core/types/database';

function mergeMessages(prev: Message[], incoming: Message[]): Message[] {
  const map = new Map<number, Message>();
  for (const m of prev) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function appendMessage(prev: Message[], row: Message): Message[] {
  if (prev.some((m) => m.id === row.id)) return prev;
  return [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export default function ChatScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { user, canCreateContent } = useAuth();
  const chatId = Number(idParam);
  const validId = Number.isFinite(chatId) && chatId > 0;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [peerTitle, setPeerTitle] = useState<string>('Диалог');

  const listRef = useRef<FlatList<Message>>(null);
  const sb = tryGetSupabase();

  const onRealtimeInsert = useCallback((row: Message) => {
    setMessages((prev) => appendMessage(prev, row));
  }, []);

  const realtimeStatus = useChatMessagesRealtime({
    client: sb,
    chatId: validId ? chatId : null,
    enabled: !!(canCreateContent && validId && user && sb),
    onInsert: onRealtimeInsert,
  });

  const reloadMessages = useCallback(async () => {
    if (!validId) return;
    const client = tryGetSupabase();
    if (!client) return;
    const { rows, error } = await fetchMessagesPage(client, chatId);
    if (error) {
      setErrorText(mapQueryError(error));
      return;
    }
    setErrorText(null);
    setMessages((prev) => mergeMessages(prev, rows));
  }, [chatId, validId]);

  const loadInitial = useCallback(async () => {
    if (!validId) {
      setErrorText('Некорректная ссылка.');
      setLoading(false);
      return;
    }
    const client = tryGetSupabase();
    if (!client) {
      setErrorText('Нет настроек Supabase.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorText(null);
    const { rows, error } = await fetchMessagesPage(client, chatId);
    setLoading(false);
    if (error) {
      setMessages([]);
      setErrorText(mapQueryError(error));
      return;
    }
    setMessages(rows);
  }, [chatId, validId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!user?.id || !validId) return;
    const client = tryGetSupabase();
    if (!client) return;
    let cancelled = false;
    void (async () => {
      const { peerUsername, error } = await fetchChatPeerSummary(client, chatId, user.id);
      if (cancelled) return;
      if (!error) {
        setPeerTitle(peerUsername?.trim() ? peerUsername : 'Собеседник');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, validId, user?.id]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: peerTitle });
  }, [navigation, peerTitle]);

  useFocusEffect(
    useCallback(() => {
      if (!validId) return;
      const pollMs = realtimeStatus === 'subscribed' ? 45000 : 7000;
      const t = setInterval(() => {
        void reloadMessages();
      }, pollMs);
      return () => clearInterval(t);
    }, [validId, reloadMessages, realtimeStatus])
  );

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !user?.id || !validId) return;
    const client = tryGetSupabase();
    if (!client) return;
    setSending(true);
    const { row, error } = await sendChatMessage(client, chatId, user.id, text);
    setSending(false);
    if (error) {
      Alert.alert('RENTO', error.message);
      return;
    }
    setDraft('');
    if (row) {
      setMessages((prev) => appendMessage(prev, row));
    }
  }, [draft, user?.id, validId, chatId]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      const mine = user?.id === item.sender_id;
      return (
        <View style={[styles.bubbleWrap, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <View style={[styles.bubble, mine ? styles.bubbleBodyMine : styles.bubbleBodyTheirs]}>
            <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
              {item.body}
            </Text>
            <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>
              {new Date(item.created_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      );
    },
    [user?.id]
  );

  const realtimeBanner = useMemo(() => {
    if (realtimeStatus === 'subscribed') {
      return (
        <View style={styles.rtOk}>
          <Text style={styles.rtOkText}>Обновления в реальном времени</Text>
        </View>
      );
    }
    if (realtimeStatus === 'connecting' || realtimeStatus === 'idle') {
      return (
        <View style={styles.rtPending}>
          <Text style={styles.rtPendingText}>Подключаем real-time…</Text>
        </View>
      );
    }
    if (realtimeStatus === 'channel_error' || realtimeStatus === 'timed_out') {
      return (
        <View style={styles.rtWarn}>
          <Text style={styles.rtWarnText}>
            Поток real-time недоступен: проверьте публикацию таблицы messages для supabase_realtime
            (SQL в конце supabase_schema.sql). Сообщения подгружаются чаще по таймеру.
          </Text>
        </View>
      );
    }
    return null;
  }, [realtimeStatus]);

  const listHeader = useMemo(
    () => (
      <View>
        {realtimeBanner}
        {errorText ? (
          <View style={styles.bannerWrap}>
            <Text style={styles.banner}>{errorText}</Text>
          </View>
        ) : null}
      </View>
    ),
    [errorText, realtimeBanner]
  );

  if (!user) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Чат' }} />
        <Text style={styles.centerText}>Войдите, чтобы открыть переписку.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/(auth)/login' as Href)}>
          <Text style={styles.primaryBtnText}>Войти</Text>
        </Pressable>
      </View>
    );
  }

  if (!canCreateContent) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Чат' }} />
        <Text style={styles.centerText}>Переписка для вашего аккаунта недоступна.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Назад</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: peerTitle }} />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: peerTitle }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Сообщение…"
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={4000}
            editable={!sending}
          />
          <Pressable
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            onPress={() => void onSend()}
            disabled={sending || !draft.trim()}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Отправить</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerText: { fontSize: 16, color: '#374151', textAlign: 'center', marginBottom: 20 },
  primaryBtn: { backgroundColor: '#0d9488', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  listContent: { paddingVertical: 12, paddingHorizontal: 12, flexGrow: 1 },
  rtOk: {
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#a7f3d0',
  },
  rtOkText: { fontSize: 13, color: '#047857', fontWeight: '600' },
  rtPending: {
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  rtPendingText: { fontSize: 13, color: '#4b5563' },
  rtWarn: {
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
  },
  rtWarnText: { fontSize: 12, color: '#92400e', lineHeight: 18 },
  bannerWrap: { marginBottom: 12 },
  banner: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bubbleWrap: { marginBottom: 10, maxWidth: '92%' },
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleTheirs: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleBodyMine: { backgroundColor: '#0d9488' },
  bubbleBodyTheirs: { backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextTheirs: { color: '#111' },
  time: { fontSize: 11, marginTop: 4 },
  timeMine: { color: 'rgba(255,255,255,0.85)' },
  timeTheirs: { color: '#6b7280' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  sendBtn: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.7 },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
