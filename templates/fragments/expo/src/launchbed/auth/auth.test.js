// Run with `just test` (bun test src/launchbed). Plain JS so the app's tsc stays free of test-runner types.
import { describe, expect, test } from "bun:test";
import { confirmPasswordError, emailError, passwordError } from "./validation";
import { DEMO_EMAIL, DEMO_PASSWORD, createInMemoryAuth } from "./fake-auth";

describe("validation", () => {
  test("email", () => {
    expect(emailError("")).toBe("Enter an email address");
    expect(emailError("not-an-email")).toBe("Enter a valid email address");
    expect(emailError("  ada@example.com ")).toBeNull();
  });
  test("password", () => {
    expect(passwordError("")).toBe("Enter a password");
    expect(passwordError("short")).toBe("Use at least 8 characters");
    expect(passwordError("long-enough")).toBeNull();
  });
  test("confirm password", () => {
    expect(confirmPasswordError("secret-123", "")).toBe("Confirm your password");
    expect(confirmPasswordError("secret-123", "other-123")).toBe("Passwords do not match");
    expect(confirmPasswordError("secret-123", "secret-123")).toBeNull();
  });
});

describe("in-memory auth", () => {
  test("demo account signs in, wrong password fails", () => {
    const auth = createInMemoryAuth();
    expect(auth.signIn(DEMO_EMAIL, DEMO_PASSWORD).ok).toBe(true);
    expect(auth.signIn(DEMO_EMAIL, "wrong-password")).toEqual({ ok: false, message: "Email or password is not recognized" });
  });
  test("register rejects duplicates and updates the profile", () => {
    const auth = createInMemoryAuth();
    const created = auth.register("Ada@Example.com", "secret-123", "Ada");
    expect(created.ok).toBe(true);
    expect(auth.register("ada@example.com", "secret-123", "Ada").ok).toBe(false);
    if (!created.ok) throw new Error("unreachable");
    const updated = auth.updateProfile(created.user, "Ada Lovelace");
    expect(updated.ok && updated.user.displayName).toBe("Ada Lovelace");
  });
});
