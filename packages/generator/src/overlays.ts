import { createHash } from "node:crypto";
import type { AddonManifest, DelegateStep, LaunchbedProjectConfig, TargetId } from "@launchbed/schema";
import { LAUNCHBED_PROJECT_FILE } from "@launchbed/schema";
import { ACTION_PINS, EXPO_PINS, FLUTTER_PINS, GENERATED_MISE } from "./versions";
import { dartPackageName, npmProjectSlug, organizationFromApplicationId, validateDelegateStep } from "./delegate";
import type { CompiledDesignTokens } from "@launchbed/design-tokens/style-dictionary";
import { expoScreenPack, flutterScreenPack, type ScreenPack } from "./screen-packs";

const encoder = new TextEncoder();

export interface OverlayFile {
  path: string;
  contents: string;
  origin: "overlay";
}

export interface DelegateMaterial {
  target: TargetId;
  strategy: "delegate";
  templateId: string;
  templateVersion: string;
  step: DelegateStep;
  overlays: OverlayFile[];
  warnings: string[];
}

function sha256Text(text: string): string {
  return createHash("sha256").update(encoder.encode(text)).digest("hex");
}

export function projectConfigJson(config: LaunchbedProjectConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

function expoMiseToml(includeScrcpy: boolean): string {
  const tools = [
    `node = "${EXPO_PINS.node}"`,
    `bun = "${EXPO_PINS.bun}"`,
    `just = "${GENERATED_MISE.tools.just}"`,
  ];
  if (includeScrcpy) {
    tools.push(`"github:Genymobile/scrcpy" = "5.0.1"`);
  }
  return `min_version = "${GENERATED_MISE.minVersion}"

[tools]
${tools.join("\n")}

[tasks.doctor]
run = "just doctor"
[tasks.dev]
run = "just dev"
[tasks.test]
run = "just test"
`;
}

function flutterMiseToml(includeScrcpy: boolean): string {
  const tools = [
    `flutter = "${FLUTTER_PINS.sdk}"`,
    `just = "${GENERATED_MISE.tools.just}"`,
  ];
  if (includeScrcpy) {
    tools.push(`"github:Genymobile/scrcpy" = "5.0.1"`);
  }
  return `min_version = "${GENERATED_MISE.minVersion}"

[tools]
${tools.join("\n")}

[tasks.doctor]
run = "just doctor"
[tasks.dev]
run = "just dev"
[tasks.test]
run = "just test"
`;
}

function expoJustfile(includeScrcpy: boolean, hasAuthTests = false): string {
  const scrcpy = includeScrcpy
    ? `
# Mirror an Android device with official scrcpy flags. Requires ANDROID_SERIAL when several devices are connected.
devices:
    adb devices -l

mirror *args:
    scrcpy --stay-awake "$@"

record *args:
    scrcpy --no-audio --record "$@"
`
    : "";
  return `set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments

default:
    @just --list

# Check Node, Expo CLI and (optionally) a connected Android device
doctor:
    @node -v
    @npx --yes expo-cli --version || npx --yes expo --version
    @command -v adb >/dev/null && adb devices -l || echo "adb not on PATH (optional; needed for Android devices)"

dev:
    npx expo start

android:
    npx expo start --android

ios:
    npx expo start --ios

lint:
    npx expo lint

${hasAuthTests ? `# Typecheck, then run the Launchbed auth/validation tests with Bun (pinned in mise.toml).
test:
    npx tsc --noEmit
    bun test src/launchbed
` : `# No default unit-test script in the official template; typecheck instead.
test:
    npx tsc --noEmit
`}
prebuild:
    npx expo prebuild

# Optional cloud build. Requires a local Expo login; this repo stores no tokens or secrets.
eas-build *args:
    npx --yes eas-cli build --platform android --non-interactive "$@"
${scrcpy}`;
}

function flutterJustfile(includeScrcpy: boolean): string {
  const scrcpy = includeScrcpy
    ? `
devices:
    flutter devices

mirror *args:
    scrcpy --stay-awake "$@"

record *args:
    scrcpy --no-audio --record "$@"
`
    : "";
  return `set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments

default:
    @just --list

doctor:
    flutter doctor

dev:
    flutter run

android:
    flutter run -d android

ios:
    flutter run -d ios

lint:
    flutter analyze

test:
    flutter test
${scrcpy}`;
}

function expoWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

# SHA pins verified 2026-11-16 via git ls-remote. No secrets.
jobs:
  expo:
    runs-on: ubuntu-latest
    steps:
      - uses: ${ACTION_PINS.checkout.uses} # ${ACTION_PINS.checkout.tag}
      - uses: ${ACTION_PINS.setupNode.uses} # ${ACTION_PINS.setupNode.tag}
        with:
          node-version: "${EXPO_PINS.node}"
          cache: npm
      - name: Install
        run: npm ci
      - name: Typecheck
        run: npx tsc --noEmit
      - name: Lint
        run: npx expo lint
      - name: Export web
        run: npx expo export --platform web
`;
}

function flutterWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

# SHA pins verified 2026-11-16 via git ls-remote. Flutter is pinned via mise.
jobs:
  flutter:
    runs-on: ubuntu-latest
    steps:
      - uses: ${ACTION_PINS.checkout.uses} # ${ACTION_PINS.checkout.tag}
      - name: Set up Flutter ${FLUTTER_PINS.sdk}
        run: |
          git clone --depth 1 --branch ${FLUTTER_PINS.sdk} https://github.com/flutter/flutter.git "$HOME/flutter"
          echo "$HOME/flutter/bin" >> "$GITHUB_PATH"
      - name: Analyze
        run: flutter analyze
      - name: Test
        run: flutter test
`;
}

function expoAgents(projectName: string): string {
  return `# AGENTS.md

This ${projectName} project was scaffolded by Launchbed using the official Expo CLI.

- Official command: \`npx --yes ${EXPO_PINS.createPackage}@${EXPO_PINS.createVersion} --template ${EXPO_PINS.template} --yes --no-agents-md\`
- Expo SDK ${EXPO_PINS.sdk} (\`default@sdk-58\`). Docs: https://docs.expo.dev/more/create-expo/
- Launchbed overlays: \`mise.toml\`, \`justfile\`, \`tokens/\`, \`.github/workflows/ci.yml\`, \`launchbed.json\`.

## Commands

\`just doctor\`, \`just dev\`, \`just android\`, \`just ios\`, \`just lint\`, \`just test\`, \`just prebuild\`. \`just eas-build\` is optional and requires a local Expo login; this repo stores no secrets.

## Tokens

DTCG tokens were compiled at generate time into \`tokens/tokens.css\` and \`tokens/tokens.ts\`. Do not edit them by hand.

## Addons

\`ui/navigation\`, \`ui/onboarding\`, \`ui/auth\`, \`ui/profile\` and \`ui/dashboard\` are ported to Expo as a Launchbed screen pack (see docs/EXPO.md). Other Compose \`ui/*\` packs and Android storage/native addons do not apply. \`tooling/scrcpy\` does: it is for Android devices.
`;
}

function flutterAgents(projectName: string): string {
  return `# AGENTS.md

This ${projectName} project was scaffolded by Launchbed using the official Flutter CLI.

- Official command: \`flutter create --template ${FLUTTER_PINS.template} --platforms ${FLUTTER_PINS.platforms} --android-language ${FLUTTER_PINS.androidLanguage}\`
- Flutter SDK ${FLUTTER_PINS.sdk}, pinned in \`mise.toml\`.
- Launchbed overlays: \`mise.toml\`, \`justfile\`, \`tokens/\`, \`.github/workflows/ci.yml\`, \`launchbed.json\`.

## Commands

\`just doctor\`, \`just dev\`, \`just android\`, \`just ios\`, \`just lint\`, \`just test\`.

## Tokens

DTCG tokens were compiled at generate time into \`tokens/tokens.css\` and \`tokens/tokens.dart\`. Do not edit them by hand.

## Addons

\`ui/navigation\`, \`ui/onboarding\`, \`ui/auth\`, \`ui/profile\` and \`ui/dashboard\` are ported to Flutter as a Launchbed screen pack (see docs/FLUTTER.md). Other Compose \`ui/*\` packs and Android storage/native addons do not apply. \`tooling/scrcpy\` does: it is for Android devices.
`;
}

function packDocs(target: "expo" | "flutter", pack: ScreenPack | null): string {
  if (!pack) return "";
  const enabled = (Object.keys(pack.features) as (keyof ScreenPack["features"])[])
    .filter((key) => pack.features[key])
    .join(", ");
  const where =
    target === "expo"
      ? "Routes live in `src/app` (expo-router), screens and session in `src/launchbed`, registry components in `components/ui`."
      : "The app shell and screens live in `lib/launchbed`, registry components in `lib/ui/components`, tests in `test/`.";
  return `
## Launchbed screen pack

Ported from the Compose add-ons: ${enabled || "navigation only"}. ${where}

- Route gate: onboarding first, then sign-in, then bottom tabs (Home${pack.features.profile ? ", Profile" : ""}).
- Auth is an in-memory fake (demo@example.com / demo-password). It is not a security boundary; replace it with a real backend before shipping.
- Onboarding and session state are kept in memory and reset on restart.
- Validation rules and messages match the Compose \`AuthValidator\`. Run \`just test\`.
`;
}

function docs(target: "expo" | "flutter", pack: ScreenPack | null = null): string {
  return docsBody(target) + packDocs(target, pack);
}

function packOverlays(pack: ScreenPack | null): OverlayFile[] {
  return pack ? pack.files.map((file) => ({ path: file.path, contents: file.contents, origin: "overlay" as const })) : [];
}

function docsBody(target: "expo" | "flutter"): string {
  if (target === "expo") {
    return `# Expo (Launchbed overlay)

Scaffolded with \`${EXPO_PINS.createPackage}@${EXPO_PINS.createVersion}\` and \`--template ${EXPO_PINS.template}\` (Expo SDK ${EXPO_PINS.sdk}), as documented at https://docs.expo.dev/more/create-expo/ on 2026-11-16.

During the SDK 58 transition, \`create-expo-app@latest\` without \`--template\` still creates an SDK 57 project (for Expo Go on a physical device). Launchbed pins SDK 58 explicitly.

The web/API never runs this command. Use \`launchbed new --target expo --yes\`.
`;
  }
  return `# Flutter (Launchbed overlay)

Scaffolded with \`flutter create --template ${FLUTTER_PINS.template} --platforms ${FLUTTER_PINS.platforms}\` and Flutter ${FLUTTER_PINS.sdk} (stable on 2026-11-11). The SDK is pinned in \`mise.toml\`.

The web/API never runs this command. Use \`launchbed new --target flutter --yes\`.
`;
}

export function buildExpoDelegate(options: {
  projectName: string;
  applicationId: string;
  packageName: string;
  addons: readonly AddonManifest[];
  tokens: CompiledDesignTokens;
}): DelegateMaterial {
  const slug = npmProjectSlug(options.projectName);
  const includeScrcpy = options.addons.some((addon) => addon.id === "tooling/scrcpy");
  const step = validateDelegateStep({
    type: "delegate",
    command: "npx",
    argv: [
      "--yes",
      `${EXPO_PINS.createPackage}@${EXPO_PINS.createVersion}`,
      slug,
      "--template",
      EXPO_PINS.template,
      "--yes",
      "--no-agents-md",
    ],
    description: `Official Expo scaffold (${EXPO_PINS.template}, ${EXPO_PINS.createPackage}@${EXPO_PINS.createVersion})`,
  });
  const config: LaunchbedProjectConfig = {
    schemaVersion: 1,
    target: "expo",
    projectName: options.projectName,
    applicationId: options.applicationId,
    packageName: options.packageName,
    addons: options.addons.map((addon) => addon.id),
    components: [],
  };
  const pack = expoScreenPack({ addonIds: config.addons, projectName: options.projectName });
  if (pack) config.components = [...pack.components];
  const overlays: OverlayFile[] = [
    ...packOverlays(pack),
    { path: "mise.toml", contents: expoMiseToml(includeScrcpy), origin: "overlay" as const },
    { path: "justfile", contents: expoJustfile(includeScrcpy, pack?.features.auth ?? false), origin: "overlay" as const },
    { path: "tokens/tokens.css", contents: options.tokens.css, origin: "overlay" as const },
    { path: "tokens/tokens.ts", contents: options.tokens.ts, origin: "overlay" as const },
    { path: ".github/workflows/ci.yml", contents: expoWorkflow(), origin: "overlay" as const },
    { path: "AGENTS.md", contents: expoAgents(options.projectName), origin: "overlay" as const },
    { path: "docs/EXPO.md", contents: docs("expo", pack), origin: "overlay" as const },
    { path: LAUNCHBED_PROJECT_FILE, contents: projectConfigJson(config), origin: "overlay" as const },
  ].sort((a, b) => a.path.localeCompare(b.path));
  const warnings = [
    "Expo projects are created by the official CLI; only Launchbed overlays are in this plan. The web API does not execute the official command.",
  ];
  if (includeScrcpy) {
    warnings.push("tooling/scrcpy applies to Expo for Android devices. Install scrcpy with mise, then use just devices / just mirror.");
  }
  if (pack) {
    warnings.push(
      "The Launchbed screen pack replaces src/app/_layout.tsx, src/app/index.tsx and src/app/explore.tsx from the official template. Session and sign-in live in memory (demo only).",
    );
  }
  return {
    target: "expo",
    strategy: "delegate",
    templateId: EXPO_PINS.templateId,
    templateVersion: EXPO_PINS.templateVersion,
    step,
    overlays,
    warnings,
  };
}

export function buildFlutterDelegate(options: {
  projectName: string;
  applicationId: string;
  packageName: string;
  addons: readonly AddonManifest[];
  tokens: CompiledDesignTokens;
}): DelegateMaterial {
  const name = dartPackageName(options.projectName);
  const org = organizationFromApplicationId(options.applicationId);
  const includeScrcpy = options.addons.some((addon) => addon.id === "tooling/scrcpy");
  const step = validateDelegateStep({
    type: "delegate",
    command: "flutter",
    argv: [
      "create",
      "--template",
      FLUTTER_PINS.template,
      "--platforms",
      FLUTTER_PINS.platforms,
      "--org",
      org,
      "--project-name",
      name,
      "--android-language",
      FLUTTER_PINS.androidLanguage,
      "--empty",
      "--no-pub",
      name,
    ],
    description: `Official Flutter scaffold (template ${FLUTTER_PINS.template}, SDK ${FLUTTER_PINS.sdk})`,
  });
  const config: LaunchbedProjectConfig = {
    schemaVersion: 1,
    target: "flutter",
    projectName: options.projectName,
    applicationId: options.applicationId,
    packageName: options.packageName,
    addons: options.addons.map((addon) => addon.id),
    components: [],
  };
  const pack = flutterScreenPack({ addonIds: config.addons, projectName: options.projectName, dartPackage: name });
  if (pack) config.components = [...pack.components];
  const overlays: OverlayFile[] = [
    ...packOverlays(pack),
    { path: "mise.toml", contents: flutterMiseToml(includeScrcpy), origin: "overlay" as const },
    { path: "justfile", contents: flutterJustfile(includeScrcpy), origin: "overlay" as const },
    { path: "tokens/tokens.css", contents: options.tokens.css, origin: "overlay" as const },
    { path: "lib/tokens/tokens.dart", contents: options.tokens.flutter, origin: "overlay" as const },
    { path: ".github/workflows/ci.yml", contents: flutterWorkflow(), origin: "overlay" as const },
    { path: "AGENTS.md", contents: flutterAgents(options.projectName), origin: "overlay" as const },
    { path: "docs/FLUTTER.md", contents: docs("flutter", pack), origin: "overlay" as const },
    { path: LAUNCHBED_PROJECT_FILE, contents: projectConfigJson(config), origin: "overlay" as const },
  ].sort((a, b) => a.path.localeCompare(b.path));
  const warnings = [
    "Flutter projects are created by the official CLI; only Launchbed overlays are in this plan. The web API does not execute the official command.",
    `--no-pub was passed so the official step does not fetch packages; run flutter pub get (or just test) after generation.`,
  ];
  if (includeScrcpy) {
    warnings.push("tooling/scrcpy applies to Flutter for Android devices. Install scrcpy with mise, then use just devices / just mirror.");
  }
  if (pack) {
    warnings.push("The Launchbed screen pack replaces lib/main.dart from the official template. Session and sign-in live in memory (demo only).");
  }
  return {
    target: "flutter",
    strategy: "delegate",
    templateId: FLUTTER_PINS.templateId,
    templateVersion: FLUTTER_PINS.templateVersion,
    step,
    overlays,
    warnings,
  };
}

export function hashOverlay(contents: string): string {
  return sha256Text(contents);
}
