import { describe, expect, test } from "bun:test";
import { createMemoryStore } from "./key-value";

describe("key-value store contract", () => {
  test("set, get, overwrite and remove", async () => {
    const store = createMemoryStore({ seeded: "1" });
    expect(await store.getItem("seeded")).toBe("1");
    expect(await store.getItem("missing")).toBeNull();
    await store.setItem("theme", "dark");
    await store.setItem("theme", "light");
    expect(await store.getItem("theme")).toBe("light");
    await store.removeItem("theme");
    expect(await store.getItem("theme")).toBeNull();
  });
});
