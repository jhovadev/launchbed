import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createInMemoryAuth, type AuthResult, type AuthUser } from "./auth/fake-auth";

export interface Session {
  onboardingSeen: boolean;
  user: AuthUser | null;
  completeOnboarding(): void;
  signIn(email: string, password: string): AuthResult;
  register(email: string, password: string, displayName: string): AuthResult;
  updateProfile(displayName: string): AuthResult;
  signOut(): void;
}

const SessionContext = createContext<Session | null>(null);

/**
 * App session kept in memory: onboarding and sign-in reset when the app restarts.
 * Persist them (expo-secure-store, AsyncStorage) when you replace the fake auth.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [auth] = useState(createInMemoryAuth);
  const [onboardingSeen, setOnboardingSeen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const value = useMemo<Session>(
    () => ({
      onboardingSeen,
      user,
      completeOnboarding: () => setOnboardingSeen(true),
      signIn(email, password) {
        const result = auth.signIn(email, password);
        if (result.ok) setUser(result.user);
        return result;
      },
      register(email, password, displayName) {
        const result = auth.register(email, password, displayName);
        if (result.ok) setUser(result.user);
        return result;
      },
      updateProfile(displayName) {
        if (!user) return { ok: false, message: "You are signed out" };
        const result = auth.updateProfile(user, displayName);
        if (result.ok) setUser(result.user);
        return result;
      },
      signOut: () => setUser(null),
    }),
    [auth, onboardingSeen, user],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}
