import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Supabase session JSON may exceed iOS SecureStore single-value limit (~2048 B). */
const CHUNK_SIZE = 1900;

/** В браузере SecureStore недоступен — используем localStorage (только для dev / веб-сборки). */
const webSessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  },
};

async function deleteChunks(key: string, count: number) {
  await Promise.all(
    Array.from({ length: count }, (_, i) =>
      SecureStore.deleteItemAsync(`${key}__part_${i}`).catch(() => undefined)
    )
  );
}

const nativeChunkedSecureStore = {
  getItem: async (key: string): Promise<string | null> => {
    const meta = await SecureStore.getItemAsync(`${key}__meta`);
    if (!meta) {
      return SecureStore.getItemAsync(key);
    }
    const count = Number(meta);
    if (!Number.isFinite(count) || count <= 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const p = await SecureStore.getItemAsync(`${key}__part_${i}`);
      if (p == null) return null;
      parts.push(p);
    }
    return parts.join('');
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      const oldMeta = await SecureStore.getItemAsync(`${key}__meta`);
      if (oldMeta) {
        await deleteChunks(key, Number(oldMeta));
        await SecureStore.deleteItemAsync(`${key}__meta`).catch(() => undefined);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
    const oldMeta = await SecureStore.getItemAsync(`${key}__meta`);
    if (oldMeta) {
      await deleteChunks(key, Number(oldMeta));
      await SecureStore.deleteItemAsync(`${key}__meta`).catch(() => undefined);
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}__meta`, String(chunks.length));
    await Promise.all(
      chunks.map((c, i) => SecureStore.setItemAsync(`${key}__part_${i}`, c))
    );
  },
  removeItem: async (key: string): Promise<void> => {
    const meta = await SecureStore.getItemAsync(`${key}__meta`);
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
    if (meta) {
      await deleteChunks(key, Number(meta));
      await SecureStore.deleteItemAsync(`${key}__meta`).catch(() => undefined);
    }
  },
};

export const chunkedSecureStore =
  Platform.OS === 'web' ? webSessionStorage : nativeChunkedSecureStore;
