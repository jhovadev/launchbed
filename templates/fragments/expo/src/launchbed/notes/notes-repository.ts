import type { KeyValueStore } from "../storage/key-value";

export interface Note {
  id: string;
  title: string;
  body: string;
  /** Milliseconds since epoch. */
  updatedAt: number;
}

export interface NoteInput {
  id?: string;
  title: string;
  body: string;
}

export interface NotesRepository {
  /** Newest first. */
  list(): Promise<Note[]>;
  get(id: string): Promise<Note | null>;
  save(input: NoteInput): Promise<Note>;
  remove(id: string): Promise<void>;
  /** Called after every change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export const NOTES_KEY = "launchbed.notes.v1";

function isNote(value: unknown): value is Note {
  if (typeof value !== "object" || value === null) return false;
  const note = value as Record<string, unknown>;
  return typeof note.id === "string" && typeof note.title === "string" && typeof note.body === "string" && typeof note.updatedAt === "number";
}

/** Same rule as the Compose notes editor: a note needs a title or some text. */
export function validateNote(input: Pick<NoteInput, "title" | "body">): string | null {
  return input.title.trim() || input.body.trim() ? null : "Write a title or some text";
}

/**
 * Notes kept as one JSON document in a key-value store (AsyncStorage on device). Fine for
 * hundreds of notes; move to expo-sqlite when you need queries, search or large data.
 */
export function createNotesRepository(
  store: KeyValueStore,
  options: { now?: () => number; newId?: () => string } = {},
): NotesRepository {
  const now = options.now ?? Date.now;
  let counter = 0;
  const newId = options.newId ?? (() => `${now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const listeners = new Set<() => void>();

  async function read(): Promise<Note[]> {
    try {
      const data: unknown = JSON.parse((await store.getItem(NOTES_KEY)) ?? "[]");
      return Array.isArray(data) ? data.filter(isNote) : [];
    } catch {
      return [];
    }
  }

  async function write(notes: Note[]): Promise<void> {
    await store.setItem(NOTES_KEY, JSON.stringify(notes));
    for (const listener of listeners) listener();
  }

  return {
    async list() {
      return (await read()).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
    },
    async get(id) {
      return (await read()).find((note) => note.id === id) ?? null;
    },
    async save(input) {
      const problem = validateNote(input);
      if (problem) throw new Error(problem);
      const notes = await read();
      const note: Note = { id: input.id ?? newId(), title: input.title.trim(), body: input.body.trim(), updatedAt: now() };
      const index = notes.findIndex((existing) => existing.id === note.id);
      if (index >= 0) notes[index] = note;
      else notes.push(note);
      await write(notes);
      return note;
    },
    async remove(id) {
      const notes = await read();
      await write(notes.filter((note) => note.id !== id));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
