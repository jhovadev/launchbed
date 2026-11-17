import type { AuthUser } from "../auth/fake-auth";
import type { KeyValueStore } from "./key-value";

export type AppearancePreference = "system" | "light" | "dark";

/** What survives an app restart. Never includes passwords. */
export interface PersistedSession {
  onboardingSeen: boolean;
  user: AuthUser | null;
  appearance: AppearancePreference;
  notifications: boolean;
}

export const SESSION_KEY = "launchbed.session.v1";

export const DEFAULT_SESSION: PersistedSession = {
  onboardingSeen: false,
  user: null,
  appearance: "system",
  notifications: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validates stored JSON field by field; anything unexpected falls back to the default. */
export function parseSession(raw: string | null): PersistedSession {
  if (!raw) return { ...DEFAULT_SESSION };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SESSION };
  }
  if (!isRecord(data)) return { ...DEFAULT_SESSION };
  const user = isRecord(data.user) && typeof data.user.email === "string" && typeof data.user.displayName === "string"
    ? { email: data.user.email, displayName: data.user.displayName }
    : null;
  const appearance = data.appearance === "light" || data.appearance === "dark" ? data.appearance : "system";
  return {
    onboardingSeen: data.onboardingSeen === true,
    user,
    appearance,
    notifications: typeof data.notifications === "boolean" ? data.notifications : DEFAULT_SESSION.notifications,
  };
}

export async function loadSession(store: KeyValueStore): Promise<PersistedSession> {
  try {
    return parseSession(await store.getItem(SESSION_KEY));
  } catch {
    return { ...DEFAULT_SESSION };
  }
}

export async function saveSession(store: KeyValueStore, state: PersistedSession): Promise<void> {
  const { onboardingSeen, user, appearance, notifications } = state;
  const safeUser = user ? { email: user.email, displayName: user.displayName } : null;
  await store.setItem(SESSION_KEY, JSON.stringify({ onboardingSeen, user: safeUser, appearance, notifications }));
}
