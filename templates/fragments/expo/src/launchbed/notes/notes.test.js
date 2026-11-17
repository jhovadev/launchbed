import { describe, expect, test } from "bun:test";
import { createMemoryStore } from "../storage/key-value";
import { NOTES_KEY, createNotesRepository, validateNote } from "./notes-repository";

function repository(store = createMemoryStore()) {
  let clock = 1000;
  let id = 0;
  return createNotesRepository(store, { now: () => (clock += 10), newId: () => `note-${++id}` });
}

describe("notes repository", () => {
  test("creates, lists newest first, updates and deletes", async () => {
    const notes = repository();
    const first = await notes.save({ title: "Groceries", body: "Milk" });
    const second = await notes.save({ title: "Ideas", body: "" });
    expect((await notes.list()).map((note) => note.id)).toEqual([second.id, first.id]);
    await notes.save({ id: first.id, title: "Groceries", body: "Milk, eggs" });
    expect((await notes.list())[0]).toMatchObject({ id: first.id, body: "Milk, eggs" });
    await notes.remove(second.id);
    expect((await notes.list()).map((note) => note.id)).toEqual([first.id]);
  });

  test("persists across repository instances (app restart)", async () => {
    const store = createMemoryStore();
    await repository(store).save({ title: "Kept", body: "after restart" });
    expect(await repository(store).list()).toHaveLength(1);
  });

  test("rejects empty notes like the Compose editor", async () => {
    expect(validateNote({ title: " ", body: "" })).toBe("Write a title or some text");
    expect(validateNote({ title: "", body: "x" })).toBeNull();
    await expect(repository().save({ title: "", body: " " })).rejects.toThrow("Write a title or some text");
  });

  test("ignores corrupt storage and notifies subscribers", async () => {
    const store = createMemoryStore({ [NOTES_KEY]: "{oops" });
    const notes = repository(store);
    expect(await notes.list()).toEqual([]);
    let calls = 0;
    const stop = notes.subscribe(() => calls++);
    await notes.save({ title: "A", body: "" });
    stop();
    await notes.save({ title: "B", body: "" });
    expect(calls).toBe(1);
  });
});
