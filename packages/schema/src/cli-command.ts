import { projectSlug } from "./identifiers";

/** Builds a reproducible `launchbed new` invocation that matches a request. */
export function formatNewCommand(options: {
  projectName: string;
  applicationId: string;
  preset?: string;
  addons?: readonly string[];
  out?: string;
  target?: string;
  themeId?: string;
}): string {
  const parts = ["launchbed new"];
  parts.push("--name", shellQuote(options.projectName));
  parts.push("--app-id", options.applicationId);
  if (options.target && options.target !== "android-compose") {
    parts.push("--target", options.target);
  }
  if (options.preset) {
    parts.push("--preset", options.preset);
  }
  if (options.themeId) {
    parts.push("--theme", options.themeId);
  }
  const addons = [...(options.addons ?? [])].sort();
  for (const addon of addons) {
    parts.push("--addon", addon);
  }
  if (options.out) {
    parts.push("--out", options.out);
  }
  return parts.join(" ");
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@,=+-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

/** Flags of the official CLIs whose next argument is a value, not a project directory. */
const VALUE_FLAGS = new Set([
  "--template",
  "--project-name",
  "--org",
  "--platforms",
  "--android-language",
  "--name",
  "--out",
  "--cwd",
  "--config",
  "--package",
]);

export function isPositional(argv: readonly string[], index: number): boolean {
  const arg = argv[index];
  if (!arg || arg.startsWith("-")) return false;
  const previous = argv[index - 1];
  if (previous && VALUE_FLAGS.has(previous)) return false;
  return true;
}

/** The directory an official CLI step creates: its last positional argument. */
export function delegateDirectory(step: { argv: readonly string[] }): string {
  for (let i = step.argv.length - 1; i >= 0; i -= 1) {
    if (isPositional(step.argv, i)) return step.argv[i]!;
  }
  return "app";
}

/** The official CLI step as one copyable shell line. */
export function formatDelegateStep(step: { command: string; argv: readonly string[] }): string {
  return [step.command, ...step.argv].map(shellQuote).join(" ");
}

/** File name of the overlay-only ZIP for delegated targets. */
export function overlayZipFileName(projectName: string): string {
  return `${projectSlug(projectName)}-launchbed-overlay.zip`;
}

/**
 * Manual setup for a delegated target without the Launchbed CLI: run the official
 * command, then unzip the overlay ZIP over the new project.
 */
export function delegateSetupCommands(options: {
  target: string;
  step: { command: string; argv: readonly string[] };
  zipFileName: string;
  /** Extra steps that run inside the project after unzipping (pinned dependency installs). */
  extraSteps?: readonly { command: string; argv: readonly string[] }[];
}): string[] {
  const directory = delegateDirectory(options.step);
  const lines = [formatDelegateStep(options.step), `cd ${shellQuote(directory)}`, `unzip -o ../${shellQuote(options.zipFileName)}`];
  const extra = options.extraSteps ?? [];
  for (const step of extra) lines.push(formatDelegateStep(step));
  if (options.target === "flutter" && !extra.some((step) => step.command === "flutter")) lines.push("flutter pub get");
  return lines;
}
