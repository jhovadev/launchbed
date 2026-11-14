import { InitializrError, SLOT_FILE, SLOT_IDS, type SlotId } from "@android-initializr/schema";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export const SLOT_MARKER_PREFIX = "// @initializr-slot ";

export function markerFor(slot: SlotId): string {
  return `${SLOT_MARKER_PREFIX}${slot}`;
}

function textOf(files: Map<string, Uint8Array>, path: string): string {
  const data = files.get(path);
  if (!data) {
    throw new InitializrError("TEMPLATE_ERROR", `Required template file is missing: ${path}`);
  }
  return decoder.decode(data);
}

function slotCount(content: string, slot: SlotId): number {
  return content.split("\n").filter((line) => line.trim() === markerFor(slot)).length;
}

/** Fails if a declared slot is missing, duplicated or moved to another file. */
export function validateSlotLayout(files: Map<string, Uint8Array>): void {
  for (const slot of SLOT_IDS) {
    const path = SLOT_FILE[slot];
    if (!path || !files.has(path)) continue;
    const count = slotCount(textOf(files, path), slot);
    if (count !== 1) {
      throw new InitializrError(
        "TEMPLATE_ERROR",
        `Template slot "${slot}" must appear exactly once in ${path} (found ${count}).`,
      );
    }
  }
}

/**
 * Inserts trusted lines immediately before a slot marker. The marker is kept so
 * later template migrations can detect stale addon operations.
 */
export function insertIntoSlot(
  files: Map<string, Uint8Array>,
  path: string,
  slot: SlotId,
  lines: readonly string[],
): void {
  const expected = SLOT_FILE[slot];
  if (expected !== undefined && expected !== path) {
    throw new InitializrError(
      "RESOLUTION_ERROR",
      `Slot "${slot}" belongs to ${expected}, not ${path}.`,
    );
  }
  const content = textOf(files, path);
  const all = content.split("\n");
  const index = all.findIndex((line) => line.trim() === markerFor(slot));
  if (index < 0) {
    throw new InitializrError("TEMPLATE_ERROR", `Slot "${slot}" is not defined in ${path}.`);
  }
  all.splice(index, 0, ...lines);
  files.set(path, encoder.encode(all.join("\n")));
}
