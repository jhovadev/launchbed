import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KeyValueStore } from "./key-value";

/**
 * Device storage for the screen pack: AsyncStorage (SQLite on Android, files on iOS,
 * localStorage on web). Unencrypted: do not store passwords or tokens here; use
 * expo-secure-store for secrets.
 */
export const appStore: KeyValueStore = AsyncStorage;
