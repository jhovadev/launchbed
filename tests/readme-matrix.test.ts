import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readmeMatrixBlock, renderReadmeMatrix } from "../scripts/readme-matrix";

test("README support matrix matches the catalogs (bun scripts/readme-matrix.ts --write)", () => {
  const readme = readFileSync(join(import.meta.dir, "../README.md"), "utf8");
  expect(readmeMatrixBlock(readme)).toBe(renderReadmeMatrix());
});
