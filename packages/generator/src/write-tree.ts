import { existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { LaunchbedError } from "@launchbed/schema";
import { isExecutablePath } from "./plan";

/**
 * Writes a materialized project to an empty (or --force) directory.
 * Paths have already been validated by the generator.
 */
export function writeProjectTree(
  files: Map<string, Uint8Array>,
  directory: string,
  options: { force?: boolean } = {},
): string {
  const root = resolve(directory);
  if (existsSync(root)) {
    const stat = lstatSync(root);
    if (!stat.isDirectory()) {
      throw new LaunchbedError("IO_ERROR", "Refusing to overwrite a file with a project directory. Pass a directory to --out.");
    }
    const entries = readdirSync(root);
    if (entries.length > 0 && !options.force) {
      throw new LaunchbedError(
        "IO_ERROR",
        `Refusing to overwrite ${directory} because it is not empty. Pass --force to replace files.`,
      );
    }
  } else {
    mkdirSync(root, { recursive: true });
  }

  const paths = [...files.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const path of paths) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    const mode = isExecutablePath(path) ? 0o755 : 0o644;
    writeFileSync(target, files.get(path)!, { mode });
  }
  return root;
}
