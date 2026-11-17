/**
 * Minimal async key-value contract. AsyncStorage satisfies it on device and web; tests use
 * createMemoryStore(). Keep app code on this interface so the backend can be swapped
 * (expo-secure-store for secrets, expo-sqlite for larger data) without touching screens.
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** In-memory store for tests and previews. */
export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore & { snapshot(): Record<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
    snapshot: () => Object.fromEntries(values),
  };
}
