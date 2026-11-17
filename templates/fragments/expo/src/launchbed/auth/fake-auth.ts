/**
 * In-memory fake. This is not a security boundary and must not be presented as real
 * authentication. Replace createInMemoryAuth() with a backend-backed repository
 * (Firebase, Supabase, or your own API) when you ship.
 */
export interface AuthUser {
  email: string;
  displayName: string;
}

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; message: string };

export interface AuthRepository {
  signIn(email: string, password: string): AuthResult;
  register(email: string, password: string, displayName: string): AuthResult;
  updateProfile(current: AuthUser, displayName: string): AuthResult;
}

export const DEMO_EMAIL = "demo@example.com";
export const DEMO_PASSWORD = "demo-password";

export function createInMemoryAuth(): AuthRepository {
  const accounts = new Map<string, { password: string; user: AuthUser }>([
    [DEMO_EMAIL, { password: DEMO_PASSWORD, user: { email: DEMO_EMAIL, displayName: "Demo user" } }],
  ]);
  return {
    signIn(email, password) {
      const account = accounts.get(email.trim().toLowerCase());
      if (!account || account.password !== password) {
        return { ok: false, message: "Email or password is not recognized" };
      }
      return { ok: true, user: account.user };
    },
    register(email, password, displayName) {
      const key = email.trim().toLowerCase();
      if (accounts.has(key)) return { ok: false, message: "An account with this email already exists" };
      const user = { email: email.trim(), displayName: displayName.trim() || email.trim() };
      accounts.set(key, { password, user });
      return { ok: true, user };
    },
    updateProfile(current, displayName) {
      const key = current.email.toLowerCase();
      const account = accounts.get(key);
      if (!account) return { ok: false, message: "You are signed out" };
      const user = { ...current, displayName: displayName.trim() || current.displayName };
      accounts.set(key, { ...account, user });
      return { ok: true, user };
    },
  };
}
