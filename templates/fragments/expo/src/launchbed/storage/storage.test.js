import { describe, expect, test } from "bun:test";
import { createMemoryStore } from "./key-value";
import { DEFAULT_SESSION, SESSION_KEY, loadSession, parseSession, saveSession } from "./session-state";

describe("persisted session", () => {
  test("starts from defaults on a fresh install", async () => {
    expect(await loadSession(createMemoryStore())).toEqual(DEFAULT_SESSION);
  });

  test("round-trips onboarding, user and preferences", async () => {
    const store = createMemoryStore();
    const state = {
      onboardingSeen: true,
      user: { email: "demo@example.com", displayName: "Demo user" },
      appearance: "dark",
      notifications: false,
    };
    await saveSession(store, state);
    expect(await loadSession(store)).toEqual(state);
  });

  test("never writes a password", async () => {
    const store = createMemoryStore();
    await saveSession(store, { ...DEFAULT_SESSION, user: { email: "a@b.co", displayName: "A", password: "secret" } });
    expect(store.snapshot()[SESSION_KEY]).not.toContain("secret");
  });

  test("falls back to defaults for corrupt or unexpected data", () => {
    expect(parseSession("{not json")).toEqual(DEFAULT_SESSION);
    expect(parseSession("[]")).toEqual(DEFAULT_SESSION);
    expect(parseSession(JSON.stringify({ onboardingSeen: "yes", user: { email: 1 }, appearance: "neon" }))).toEqual(DEFAULT_SESSION);
  });

  test("survives a store that throws", async () => {
    const broken = { getItem: async () => { throw new Error("disk"); }, setItem: async () => {}, removeItem: async () => {} };
    expect(await loadSession(broken)).toEqual(DEFAULT_SESSION);
  });
});
