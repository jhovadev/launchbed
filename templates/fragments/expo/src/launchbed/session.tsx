import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createInMemoryAuth, type AuthResult, type AuthUser } from "./auth/fake-auth";
import { appStore } from "./storage/app-store";
import type { KeyValueStore } from "./storage/key-value";
import { DEFAULT_SESSION, loadSession, saveSession, type AppearancePreference, type PersistedSession } from "./storage/session-state";
import { applyAppearance } from "./theme";

export interface Session {
  /** False until the stored session has been read; render nothing (or a splash) until then. */
  ready: boolean;
  onboardingSeen: boolean;
  user: AuthUser | null;
  appearance: AppearancePreference;
  notifications: boolean;
  completeOnboarding(): void;
  signIn(email: string, password: string): AuthResult;
  register(email: string, password: string, displayName: string): AuthResult;
  updateProfile(displayName: string): AuthResult;
  signOut(): void;
  setAppearance(appearance: AppearancePreference): void;
  setNotifications(enabled: boolean): void;
}

const SessionContext = createContext<Session | null>(null);

/**
 * App session persisted on the device (AsyncStorage): onboarding, the signed-in user and the
 * settings survive restarts. Passwords are never stored; the fake auth itself stays in memory.
 */
export function SessionProvider({ children, store = appStore }: { children: ReactNode; store?: KeyValueStore }) {
  const [auth] = useState(createInMemoryAuth);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PersistedSession>(DEFAULT_SESSION);
  const latest = useRef(state);

  useEffect(() => {
    let active = true;
    loadSession(store).then((loaded) => {
      if (!active) return;
      latest.current = loaded;
      setState(loaded);
      applyAppearance(loaded.appearance);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [store]);

  const update = useCallback(
    (patch: Partial<PersistedSession>) => {
      const next = { ...latest.current, ...patch };
      latest.current = next;
      setState(next);
      saveSession(store, next).catch((error: unknown) => console.warn("Could not save the session", error));
    },
    [store],
  );

  const value = useMemo<Session>(
    () => ({
      ready,
      ...state,
      completeOnboarding: () => update({ onboardingSeen: true }),
      signIn(email, password) {
        const result = auth.signIn(email, password);
        if (result.ok) update({ user: result.user });
        return result;
      },
      register(email, password, displayName) {
        const result = auth.register(email, password, displayName);
        if (result.ok) update({ user: result.user });
        return result;
      },
      updateProfile(displayName) {
        if (!state.user) return { ok: false, message: "You are signed out" };
        const result = auth.updateProfile(state.user, displayName);
        if (result.ok) update({ user: result.user });
        return result;
      },
      signOut: () => update({ user: null }),
      setAppearance(appearance) {
        applyAppearance(appearance);
        update({ appearance });
      },
      setNotifications: (notifications) => update({ notifications }),
    }),
    [auth, ready, state, update],
  );
  // Render nothing until the saved session is read: no flash of onboarding or sign-in, and on
  // web the first paint happens on the client with the right color scheme.
  return <SessionContext.Provider value={value}>{ready ? children : null}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}
