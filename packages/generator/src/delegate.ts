import { spawnSync } from "node:child_process";
import { LaunchbedError, isPositional, type DelegateStep } from "@launchbed/schema";

const SAFE_ARG = /^-{0,2}[A-Za-z0-9][A-Za-z0-9_@./=,+:-]*$/;
const SAFE_COMMAND = /^(npx|flutter)$/;

/**
 * Validates a delegate step before any process is spawned. Arguments are
 * allowlisted literals; nothing is interpolated through a shell.
 */
export function validateDelegateStep(step: DelegateStep): DelegateStep {
  if (!SAFE_COMMAND.test(step.command)) {
    throw new LaunchbedError(
      "DELEGATE_ERROR",
      `Delegate command "${step.command}" is not on the official allowlist (npx, flutter).`,
    );
  }
  for (const arg of step.argv) {
    if (!SAFE_ARG.test(arg)) {
      throw new LaunchbedError(
        "DELEGATE_ERROR",
        "A delegate argument failed the allowlist and was rejected before execution.",
      );
    }
  }
  return step;
}


/** Returns a copy of argv with the last positional (the project directory) set to outputPath. */
export function withDelegateOutputPath(argv: readonly string[], outputPath: string): string[] {
  const next = [...argv];
  for (let i = next.length - 1; i >= 0; i -= 1) {
    if (isPositional(next, i)) {
      next[i] = outputPath;
      return next;
    }
  }
  throw new LaunchbedError("DELEGATE_ERROR", "The official CLI step has no directory argument to replace.");
}

export interface DelegateRunOptions {
  cwd: string;
  /** When set, used as the last path argument instead of the planned slug. Must already be allowlisted. */
  outputPath?: string;
  timeoutMs?: number;
}

/**
 * Runs an official CLI with an argv array. Never uses a shell.
 * Only `launchbed new` should call this; the web API returns the plan instead.
 */
export function runDelegateStep(step: DelegateStep, options: DelegateRunOptions): void {
  const validated = validateDelegateStep(step);
  const argv = [...validated.argv];
  if (options.outputPath) {
    if (!SAFE_ARG.test(options.outputPath) && !/^\/[A-Za-z0-9/_+=.-]+$/.test(options.outputPath)) {
      throw new LaunchbedError("DELEGATE_ERROR", "The output path for the official CLI is not a safe path.");
    }
    const replaced = withDelegateOutputPath(argv, options.outputPath);
    argv.splice(0, argv.length, ...replaced);
  }
  const result = spawnSync(validated.command, argv, {
    cwd: options.cwd,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: options.timeoutMs ?? 10 * 60 * 1000,
    env: { ...process.env, CI: "1", AD: "0" },
  });
  if (result.error) {
    const message = result.error.message.includes("ENOENT")
      ? `The official command "${validated.command}" was not found on PATH. Run \`launchbed doctor --target\` for prerequisites.`
      : "The official CLI could not be started.";
    throw new LaunchbedError("PREREQUISITE_MISSING", message);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim().split("\n").slice(-8).join(" ").slice(0, 400);
    throw new LaunchbedError(
      "DELEGATE_ERROR",
      `Official command ${validated.command} failed with exit ${result.status ?? "unknown"}.${stderr ? ` ${stderr}` : ""}`,
    );
  }
}

export function dartPackageName(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = slug.length > 0 ? slug : "app";
  return /^[a-z]/.test(base) ? base : `app_${base}`;
}

export function npmProjectSlug(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = slug.length > 0 ? slug : "app";
  return /^[a-z]/.test(base) ? base : `app-${base}`;
}

export function organizationFromApplicationId(applicationId: string): string {
  const parts = applicationId.split(".");
  if (parts.length <= 2) return applicationId;
  return parts.slice(0, -1).join(".");
}
