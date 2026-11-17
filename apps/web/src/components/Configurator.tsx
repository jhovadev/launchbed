import type { JSX } from "solid-js";
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { CatalogResponse, ProjectPresetManifest, ProjectRequest, TargetId, ThemeConfig } from "@launchbed/schema";
import { resolveThemeTokens } from "@launchbed/design-tokens";
import { PREVIEW_SCREEN_LABELS, PreviewScreen, type PreviewScreenId } from "@launchbed/preview";
import { formatNewCommand, projectSlug } from "@launchbed/schema";
import ArrowLeft from "lucide-solid/icons/arrow-left";
import ArrowRight from "lucide-solid/icons/arrow-right";
import Atom from "lucide-solid/icons/atom";
import Box from "lucide-solid/icons/box";
import Check from "lucide-solid/icons/check";
import ChevronDown from "lucide-solid/icons/chevron-down";
import CircleAlert from "lucide-solid/icons/circle-exclamation-point";
import Copy from "lucide-solid/icons/copy";
import Download from "lucide-solid/icons/download";
import Feather from "lucide-solid/icons/feather";
import FileCode from "lucide-solid/icons/file-code";
import LayoutDashboard from "lucide-solid/icons/layout-dashboard";
import LayoutGrid from "lucide-solid/icons/layout-grid";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import Moon from "lucide-solid/icons/moon";
import NotebookPen from "lucide-solid/icons/notebook-pen";
import Plus from "lucide-solid/icons/plus";
import RotateCw from "lucide-solid/icons/rotate-cw";
import Rocket from "lucide-solid/icons/rocket";
import Search from "lucide-solid/icons/search";
import Smartphone from "lucide-solid/icons/smartphone";
import Sun from "lucide-solid/icons/sun";
import Terminal from "lucide-solid/icons/terminal";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

interface Props {
  catalog: CatalogResponse;
  presets?: readonly ProjectPresetManifest[];
}

interface FormState {
  projectName: string;
  applicationId: string;
  namespace: string;
  packageName: string;
  minSdk: number;
  compileSdk: number;
  targetSdk: number;
  seedColor: string;
  fontFamily: ThemeConfig["typography"]["fontFamily"];
  cornerRadius: number;
  defaultMode: ThemeConfig["defaultMode"];
}

interface ApiError {
  error: {
    code: string;
    message: string;
    issues: { path: string; message: string }[];
  };
}

interface PlanSummary {
  files: number;
  bytes: number;
  addons: string[];
  warnings: string[];
  strategy: string;
  paths: { path: string; origin: string }[];
}

type Addon = CatalogResponse["addons"][number];

const SDK_MIN = [24, 26, 28, 30, 31, 33, 34, 35, 36, 37];
const SDK_COMPILE = [34, 35, 36, 37];
const FONTS: { value: ThemeConfig["typography"]["fontFamily"]; label: string }[] = [
  { value: "default", label: "Platform default" },
  { value: "sansSerif", label: "Sans serif" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
];
const PALETTES = [
  { name: "Violet", value: "#6750A4" },
  { name: "Forest", value: "#006C4C" },
  { name: "Ember", value: "#8C4A2F" },
  { name: "Ocean", value: "#2C5D8F" },
  { name: "Graphite", value: "#4A4F5A" },
];
const CATEGORY_LABELS: Record<string, string> = {
  storage: "Storage",
  ui: "Screens & UI",
  native: "Native",
  tooling: "Tooling",
  foundation: "Foundation",
};
const CATEGORY_ORDER = ["ui", "storage", "tooling", "native", "foundation"];

const TARGET_META: Record<string, { icon: (props: { class?: string }) => JSX.Element; stack: string; blurb: string; tile: string }> = {
  "android-compose": {
    icon: (p) => <Smartphone class={p.class} />,
    stack: "Kotlin · Jetpack Compose · Gradle",
    blurb: "Generated end-to-end by Launchbed. Buildable ZIP with Gradle wrapper, mise and just.",
    tile: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  expo: {
    icon: (p) => <Atom class={p.class} />,
    stack: "TypeScript · React Native · Expo Router",
    blurb: "Official create-expo-app (pinned) plus Launchbed overlays: tokens, mise, justfile and CI.",
    tile: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  flutter: {
    icon: (p) => <Feather class={p.class} />,
    stack: "Dart · Flutter · Material 3",
    blurb: "Official flutter create (SDK pinned via mise) plus Launchbed overlays and Dart tokens.",
    tile: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  "tauri-solid": {
    icon: (p) => <Box class={p.class} />,
    stack: "Rust · Tauri 2 · SolidJS",
    blurb: "Planned. Will delegate to the official create-tauri-app.",
    tile: "bg-muted text-muted-foreground",
  },
};

const PRESET_ICONS: Record<string, (props: { class?: string }) => JSX.Element> = {
  "compose-minimal": (p) => <Box class={p.class} />,
  "compose-starter": (p) => <LayoutDashboard class={p.class} />,
  "local-notes": (p) => <NotebookPen class={p.class} />,
  "catalog-ui": (p) => <LayoutGrid class={p.class} />,
  "app-starter": (p) => <Rocket class={p.class} />,
};

const ADDON_SCREENS: [string, PreviewScreenId[]][] = [
  ["ui/onboarding", ["onboarding"]],
  ["ui/auth", ["login", "register"]],
  ["ui/dashboard", ["dashboard"]],
  ["ui/notes", ["notes"]],
  ["ui/catalog", ["catalog"]],
  ["ui/profile", ["profile"]],
  ["ui/settings", ["settings"]],
];

const STEPS = [
  { id: "target", label: "Platform", hint: "Where it runs" },
  { id: "project", label: "Project", hint: "Name and ID" },
  { id: "preset", label: "Template", hint: "Starting point" },
  { id: "addons", label: "Add-ons", hint: "Capabilities" },
  { id: "theme", label: "Theme", hint: "Colors and shape" },
  { id: "review", label: "Review", hint: "Download" },
] as const;

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";
const labelClass = "text-sm font-medium leading-none";
const helpClass = "text-xs text-muted-foreground";
const errorClass = "text-xs font-medium text-destructive";

function themeConfig(form: FormState): ThemeConfig {
  return {
    seedColor: form.seedColor,
    schemeVariant: "tonalSpot",
    defaultMode: form.defaultMode,
    overrides: { light: {}, dark: {} },
    typography: { fontFamily: form.fontFamily },
    shape: { cornerRadius: form.cornerRadius },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    components: {
      card: { cornerRadius: 16, elevation: 1 },
      button: { cornerRadius: 20, minHeight: 48 },
    },
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusVariant(status: string): "success" | "info" | "warning" | "muted" {
  if (status === "stable") return "success";
  if (status === "beta") return "info";
  if (status === "experimental") return "warning";
  return "muted";
}

function SectionHeader(props: { index: number; title: string; description: string; id: string }) {
  return (
    <div class="mb-6 flex flex-col gap-1.5">
      <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step {props.index + 1} of {STEPS.length}</p>
      <h3 id={props.id} class="text-xl font-semibold tracking-tight">{props.title}</h3>
      <p class="text-sm text-muted-foreground">{props.description}</p>
    </div>
  );
}

function Collapsible(props: { title: string; subtitle: string; children: JSX.Element }) {
  return (
    <details class="group rounded-lg border bg-muted/30 [&_summary::-webkit-details-marker]:hidden">
      <summary class="flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span class="flex flex-col gap-0.5"><span>{props.title}</span><span class="text-xs font-normal text-muted-foreground">{props.subtitle}</span></span>
        <ChevronDown class="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div class="flex flex-col gap-4 border-t px-4 py-4">{props.children}</div>
    </details>
  );
}

export default function Configurator(props: Props) {
  const [form, setForm] = createSignal<FormState>({
    projectName: "Demo App",
    applicationId: "com.example.demo",
    namespace: "com.example.demo",
    packageName: "",
    minSdk: props.catalog.template.minSdk,
    compileSdk: props.catalog.template.compileSdk,
    targetSdk: props.catalog.template.targetSdk,
    seedColor: (props.presets ?? []).find((preset) => preset.id === "compose-minimal")?.defaultTheme.seedColor ?? "#6750A4",
    fontFamily: "default",
    cornerRadius: 12,
    defaultMode: "system",
  });
  const [target, setTarget] = createSignal<TargetId>("android-compose");
  const [previewMode, setPreviewMode] = createSignal<"light" | "dark">("light");
  // The minimal preset is a usable, predictable starting point on both SSR and hydration.
  const starterPreset = (props.presets ?? []).find((preset) => preset.id === "compose-minimal" && preset.status === "stable");
  const [presetId, setPresetId] = createSignal<string>(starterPreset?.id ?? "");
  const [previewScreen, setPreviewScreen] = createSignal<PreviewScreenId>("welcome");
  const [selectedAddons, setSelectedAddons] = createSignal<string[]>([]);
  const [addonQuery, setAddonQuery] = createSignal("");
  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string[]>>({});
  const [formError, setFormError] = createSignal("");
  const [status, setStatus] = createSignal("");
  const [delegateCommand, setDelegateCommand] = createSignal("");
  const [busy, setBusy] = createSignal<"plan" | "generate" | null>(null);
  const [plan, setPlan] = createSignal<PlanSummary | null>(null);
  const [step, setStep] = createSignal(0);
  const [copied, setCopied] = createSignal(false);

  // Follow the site theme (header toggle) for the preview until the user picks one here.
  const [previewTouched, setPreviewTouched] = createSignal(false);
  onMount(() => {
    const root = document.documentElement;
    const sync = () => { if (!previewTouched()) setPreviewMode(root.classList.contains("dark") ? "dark" : "light"); };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    onCleanup(() => observer.disconnect());
  });

  const targets = () => props.catalog.targets ?? [];
  const isOwned = () => target() === "android-compose";
  const targetDef = createMemo(() => targets().find((item) => item.id === target()));
  const supportedPresets = (props.presets ?? []).filter((preset) => preset.status === "stable" || preset.status === "beta");
  const upcomingPresets = (props.presets ?? []).filter((preset) => preset.status === "planned");
  const selectedPreset = createMemo(() => (props.presets ?? []).find((preset) => preset.id === presetId()));
  const requiredAddons = createMemo(() => selectedPreset()?.requiredAddons ?? []);
  const addonById = (id: string): Addon | undefined => props.catalog.addons.find((addon) => addon.id === id);
  const addonName = (id: string) => addonById(id)?.displayName ?? id;

  const availableScreens = createMemo(() => {
    const screens: PreviewScreenId[] = [];
    for (const [addon, ids] of ADDON_SCREENS) if (selectedAddons().includes(addon)) screens.push(...ids);
    return [...screens, "welcome" as const].filter((screen, index, all) => all.indexOf(screen) === index);
  });
  const activePreviewScreen = createMemo<PreviewScreenId>(() =>
    availableScreens().includes(previewScreen()) ? previewScreen() : (availableScreens()[0] ?? "welcome"),
  );

  const tokens = createMemo(() => resolveThemeTokens(themeConfig(form())));
  const swatches = createMemo(() => {
    const c = previewMode() === "dark" ? tokens().dark : tokens().light;
    return [
      { role: "primary", value: c.primary },
      { role: "secondary", value: c.secondary },
      { role: "tertiary", value: c.tertiary },
      { role: "surface", value: c.surface },
      { role: "error", value: c.error },
    ];
  });

  const addonTargets = (addon: Addon) => addon.targets ?? ["android-compose"];
  const generatedAddons = createMemo(() => props.catalog.addons.filter((addon) => addon.generatable && addonTargets(addon).includes(target())));
  const plannedAddons = createMemo(() => props.catalog.addons.filter((addon) => !addon.generatable && addonTargets(addon).includes(target())));
  const matchesQuery = (addon: Addon) =>
    `${addon.displayName} ${addon.description} ${addon.id}`.toLowerCase().includes(addonQuery().trim().toLowerCase());
  const filteredAddons = (category: string) => generatedAddons().filter((addon) => addon.category === category && matchesQuery(addon));
  const filteredPlanned = createMemo(() => plannedAddons().filter(matchesQuery));

  const cliCommand = createMemo(() =>
    formatNewCommand({
      projectName: form().projectName || "Demo App",
      applicationId: form().applicationId || "com.example.demo",
      preset: (isOwned() && presetId()) || undefined,
      addons: selectedAddons().filter((id) => !requiredAddons().includes(id)),
      out: projectSlug(form().projectName || "Demo App"),
      target: target(),
    }),
  );

  function plannedReason(addon: Addon): string {
    const note = addon.compatibility?.notes?.[0];
    if (note) return note;
    return `This add-on is ${addon.status} and is not generated yet.`;
  }

  async function copyText(text: string, elementId: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        // Fall through to selecting the command so the user can copy it.
      }
    }
    const pre = document.getElementById(elementId);
    if (pre) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(pre);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function goTo(index: number): void {
    const next = Math.max(0, Math.min(STEPS.length - 1, index));
    setStep(next);
    if (next === STEPS.length - 1) void checkPlan();
  }

  function resetResult(): void {
    setPlan(null);
    setStatus("");
    setDelegateCommand("");
    clearErrors();
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    resetResult();
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "minSdk" && next.targetSdk < (value as number)) next.targetSdk = value as number;
      return next;
    });
  }

  function chooseTarget(next: TargetId): void {
    resetResult();
    setTarget(next);
    if (next !== "android-compose") {
      setPresetId("");
      setSelectedAddons((current) => current.filter((id) => {
        const addon = addonById(id);
        return addon ? addonTargets(addon).includes(next) : false;
      }));
    } else if (!presetId() && selectedAddons().length === 0 && starterPreset) {
      setPresetId(starterPreset.id);
    }
  }

  function applyPreset(id: string): void {
    resetResult();
    setPresetId(id);
    const preset = (props.presets ?? []).find((entry) => entry.id === id);
    if (!preset || !(preset.status === "stable" || preset.status === "beta")) return;
    setSelectedAddons([...preset.requiredAddons].sort());
    const first = ADDON_SCREENS.find(([addon]) => preset.requiredAddons.includes(addon));
    setPreviewScreen(preset.requiredAddons.includes("ui/dashboard") ? "dashboard" : (first?.[1][0] ?? "welcome"));
    const theme = preset.defaultTheme;
    setForm((previous) => {
      const minSdk = Math.max(previous.minSdk, preset.compatibility.minSdk);
      return {
        ...previous,
        minSdk,
        targetSdk: Math.max(previous.targetSdk, minSdk),
        seedColor: theme.seedColor,
        fontFamily: theme.typography.fontFamily,
        cornerRadius: theme.shape.cornerRadius,
        defaultMode: theme.defaultMode,
      };
    });
  }

  function toggleAddon(id: string, checked: boolean): void {
    // Preset requirements are always added by the generator; never show them as removable.
    if (!checked && requiredAddons().includes(id)) return;
    resetResult();
    setSelectedAddons((previous) =>
      checked ? [...new Set([...previous, id])].sort() : previous.filter((value) => value !== id),
    );
    if (checked) {
      const screens = ADDON_SCREENS.find(([addon]) => addon === id)?.[1];
      if (screens?.[0]) setPreviewScreen(screens[0]);
    }
  }

  function resetToCustom(): void {
    resetResult();
    setPresetId("");
    setSelectedAddons([]);
    setPreviewScreen("welcome");
  }

  function requestBody(): ProjectRequest {
    const current = form();
    return {
      template: "android-compose-minimal",
      projectName: current.projectName,
      applicationId: current.applicationId,
      namespace: current.namespace,
      ...(current.packageName.trim() ? { packageName: current.packageName.trim() } : {}),
      minSdk: current.minSdk,
      compileSdk: current.compileSdk,
      targetSdk: current.targetSdk,
      theme: themeConfig(current),
      addons: selectedAddons(),
      target: target(),
      ...(presetId() && target() === "android-compose" ? { preset: presetId() } : {}),
    };
  }

  function applyError(payload: ApiError): void {
    const errors: Record<string, string[]> = {};
    for (const issue of payload.error.issues) {
      const field = issue.path.split(".")[0] ?? "(root)";
      errors[field] = [...(errors[field] ?? []), issue.message];
    }
    setFieldErrors(errors);
    setFormError(payload.error.message);
    setStatus("");
  }

  function clearErrors(): void {
    setFieldErrors({});
    setFormError("");
  }

  async function readError(response: Response): Promise<ApiError> {
    try {
      return (await response.json()) as ApiError;
    } catch {
      return {
        error: {
          code: "INTERNAL_ERROR",
          message: `The server responded with HTTP ${response.status}.`,
          issues: [],
        },
      };
    }
  }

  async function checkPlan(): Promise<void> {
    clearErrors();
    setPlan(null);
    setBusy("plan");
    setStatus("Planning…");
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody()),
      });
      if (!response.ok) {
        applyError(await readError(response));
        return;
      }
      const result = (await response.json()) as {
        strategy?: string;
        totals: { files: number; bytes: number };
        request: { addons: string[] };
        warnings: string[];
        files: { path: string; origin?: string }[];
      };
      setPlan({
        files: result.totals.files,
        bytes: result.totals.bytes,
        addons: result.request.addons,
        warnings: result.warnings,
        strategy: result.strategy ?? "owned",
        paths: result.files.map((file) => ({ path: file.path, origin: file.origin ?? "template" })),
      });
      setStatus(`Plan ready: ${result.totals.files} files, ${formatBytes(result.totals.bytes)}.`);
    } catch {
      setFormError("Could not reach the generation API. Is the dev server running?");
      setStatus("");
    } finally {
      setBusy(null);
    }
  }

  async function generate(): Promise<void> {
    clearErrors();
    setDelegateCommand("");
    setBusy("generate");
    setStatus("Generating ZIP…");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody()),
      });
      if (!response.ok) {
        applyError(await readError(response));
        return;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as { command?: string; strategy?: string };
        const command = payload.command ?? cliCommand();
        setDelegateCommand(command);
        setStatus(
          payload.strategy === "delegate"
            ? "This platform is created by its official CLI. Run the command below on your machine; the web app never executes it."
            : "Plan ready. Use the CLI to generate this target.",
        );
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName = match?.[1] ?? "android-project.zip";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      const files = response.headers.get("x-generation-files");
      setStatus(`Downloaded ${fileName} (${files ?? "?"} files, ${formatBytes(blob.size)}).`);
    } catch {
      setFormError("Generation failed. Check the server logs and try again.");
      setStatus("");
    } finally {
      setBusy(null);
    }
  }

  const errorFor = (field: string) => fieldErrors()[field] ?? [];
  const previewCaption = () =>
    isOwned()
      ? "Illustrative preview of the generated Compose screens. Not an emulator."
      : `Illustrative: your tokens on registry components. The official ${targetDef()?.displayName ?? target()} template screens are not reproduced.`;

  return (
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]" data-launchbed-ui="v1" data-launchbed-ui-rev="2">
      <form class="min-w-0 rounded-xl border bg-card text-card-foreground shadow-sm" aria-busy={busy() !== null}
        onSubmit={(event) => { event.preventDefault(); void generate(); }} noValidate>
        {/* Stepper */}
        <nav class="border-b px-3 py-3 sm:px-6" aria-label="Builder steps">
          <ol class="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:gap-2">
            <For each={STEPS}>{(item, index) => (
              <li class="flex min-w-0 items-center gap-1 sm:gap-2">
                <button type="button" aria-current={step() === index() ? "step" : undefined} onClick={() => goTo(index())}
                  aria-label={`Step ${index() + 1}: ${item.label}${step() > index() ? " (done)" : ""}`}
                  class={cn(
                    "group flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2",
                    step() === index() ? "text-foreground" : "text-muted-foreground",
                  )}>
                  <span class={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums transition-colors",
                    step() === index() && "border-primary bg-primary text-primary-foreground",
                    step() > index() && "border-primary/30 bg-primary/10 text-foreground",
                  )}>
                    <Show when={step() > index()} fallback={index() + 1}><Check class="size-3.5" aria-hidden="true" /></Show>
                  </span>
                  <span class={cn("hidden whitespace-nowrap font-medium md:inline", step() === index() && "inline")}>{item.label}</span>
                </button>
                <Show when={index() < STEPS.length - 1}><span class="h-px w-3 shrink-0 bg-border sm:w-6" aria-hidden="true" /></Show>
              </li>
            )}</For>
          </ol>
        </nav>

        <div class="p-4 sm:p-6">
          <Show when={formError()}>
            <div class="mb-6 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm" role="alert" aria-live="assertive">
              <CircleAlert class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              <div class="flex flex-col gap-1">
                <strong class="font-medium text-destructive">We could not generate this project.</strong>
                <p class="text-muted-foreground">{formError()}</p>
                <Show when={Object.keys(fieldErrors()).length > 0}>
                  <ul class="list-disc pl-4 text-muted-foreground"><For each={Object.entries(fieldErrors())}>{([field, messages]) => <li><code class="text-foreground">{field}</code>: {messages.join(" ")}</li>}</For></ul>
                </Show>
              </div>
            </div>
          </Show>

          {/* 1. Target */}
          <section hidden={step() !== 0} aria-labelledby="section-target">
            <SectionHeader index={0} id="section-target" title="Choose a platform"
              description="Android Compose is generated by Launchbed. Expo and Flutter start from their official CLI with Launchbed tokens, tooling and CI on top." />
            <fieldset>
              <legend class="sr-only">Platform</legend>
              <div class="grid gap-3 md:grid-cols-3">
                <For each={targets().filter((item) => item.status === "stable" || item.status === "beta")}>{(item) => {
                  const meta = TARGET_META[item.id] ?? TARGET_META["tauri-solid"]!;
                  return (
                    <label class={cn(
                      "relative flex min-w-0 cursor-pointer flex-col gap-3 rounded-lg border bg-background p-4 transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      target() === item.id && "border-primary ring-1 ring-primary",
                    )}>
                      <input type="radio" class="sr-only" name="target" value={item.id} checked={target() === item.id}
                        onChange={() => chooseTarget(item.id as TargetId)} />
                      <span class="flex items-start justify-between gap-2">
                        <span class={cn("grid size-10 place-items-center rounded-lg", meta.tile)} aria-hidden="true">{meta.icon({ class: "size-5" })}</span>
                        <span class="flex flex-wrap justify-end gap-1">
                          <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                          <Show when={target() === item.id}><span class="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden="true"><Check class="size-3" /></span></Show>
                        </span>
                      </span>
                      <span class="flex min-w-0 flex-col gap-1">
                        <span class="font-semibold leading-tight">{item.displayName}</span>
                        <span class="text-xs text-muted-foreground">{meta.stack}</span>
                      </span>
                      <span class="text-sm text-muted-foreground">{meta.blurb}</span>
                      <span class="mt-auto flex flex-wrap gap-1">
                        <Badge variant="outline">{item.strategy === "owned" ? "Generated by Launchbed" : `Official CLI: ${item.officialCli ?? "—"}`}</Badge>
                      </span>
                    </label>
                  );
                }}</For>
              </div>
              <For each={targets().filter((item) => !(item.status === "stable" || item.status === "beta"))}>{(item) => {
                const meta = TARGET_META[item.id] ?? TARGET_META["tauri-solid"]!;
                return (
                  <div class="mt-3 flex min-w-0 items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground" aria-disabled="true">
                    <span class={cn("grid size-8 shrink-0 place-items-center rounded-md", meta.tile)} aria-hidden="true">{meta.icon({ class: "size-4" })}</span>
                    <span class="flex min-w-0 flex-1 flex-col"><span class="font-medium text-foreground">{item.displayName}</span><span class="text-xs">{meta.blurb}</span></span>
                    <Badge variant="muted">{item.status}</Badge>
                  </div>
                );
              }}</For>
            </fieldset>
            <Show when={targetDef()}>{(def) => (
              <div class="mt-4 rounded-lg border bg-muted/30 p-4">
                <p class="text-sm font-medium">What you need locally</p>
                <ul class="mt-2 flex flex-wrap gap-1.5">
                  <For each={def().prereqs}>{(item) => <li class="min-w-0 max-w-full"><Badge class="whitespace-normal" variant={item.optional ? "muted" : "secondary"}>{item.label}{item.optional ? " · optional" : ""}</Badge></li>}</For>
                </ul>
              </div>
            )}</Show>
          </section>

          {/* 2. Project */}
          <section hidden={step() !== 1} aria-labelledby="section-identity">
            <SectionHeader index={1} id="section-identity" title="Name your app" description="Only two fields are required. Technical defaults are already filled in." />
            <div class="grid gap-5">
              <div class="grid gap-2">
                <label for="projectName" class={labelClass}>Project name</label>
                <input id="projectName" name="projectName" class={inputClass} value={form().projectName} required maxlength={64} autocomplete="off"
                  aria-invalid={errorFor("projectName").length > 0}
                  aria-describedby={errorFor("projectName").length > 0 ? "projectName-error" : "projectName-help"}
                  onInput={(event) => update("projectName", event.currentTarget.value)} />
                <Show when={errorFor("projectName").length > 0} fallback={<p id="projectName-help" class={helpClass}>Shown as the app title. The folder will be <code>{projectSlug(form().projectName || "Demo App")}</code>.</p>}>
                  <p class={errorClass} id="projectName-error">{errorFor("projectName").join(" ")}</p>
                </Show>
              </div>
              <div class="grid gap-2">
                <label for="applicationId" class={labelClass}>Application ID</label>
                <input id="applicationId" name="applicationId" class={cn(inputClass, "font-mono")} value={form().applicationId} required spellcheck={false} autocomplete="off"
                  aria-invalid={errorFor("applicationId").length > 0}
                  aria-describedby={errorFor("applicationId").length > 0 ? "applicationId-error" : "applicationId-help"}
                  onInput={(event) => {
                    const previousId = form().applicationId;
                    const previousNamespace = form().namespace;
                    update("applicationId", event.currentTarget.value);
                    if (previousId === previousNamespace) update("namespace", event.currentTarget.value);
                  }} />
                <Show when={errorFor("applicationId").length > 0} fallback={<p id="applicationId-help" class={helpClass}>Reverse domain, e.g. com.yourcompany.myapp. Used as the store identifier.</p>}>
                  <p class={errorClass} id="applicationId-error">{errorFor("applicationId").join(" ")}</p>
                </Show>
              </div>
              <Collapsible title="Advanced Android settings" subtitle={isOwned() ? "Namespace, Kotlin package and SDK levels" : "Used by the Android part of the delegated project"}>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="grid gap-2">
                    <label for="namespace" class={labelClass}>Namespace</label>
                    <input id="namespace" name="namespace" class={cn(inputClass, "font-mono")} value={form().namespace} required spellcheck={false} autocomplete="off"
                      aria-invalid={errorFor("namespace").length > 0} aria-describedby={errorFor("namespace").length > 0 ? "namespace-error" : undefined}
                      onInput={(event) => update("namespace", event.currentTarget.value)} />
                    <Show when={errorFor("namespace").length > 0}><p class={errorClass} id="namespace-error">{errorFor("namespace").join(" ")}</p></Show>
                  </div>
                  <div class="grid gap-2">
                    <label for="packageName" class={labelClass}>Kotlin package <span class="font-normal text-muted-foreground">(optional)</span></label>
                    <input id="packageName" name="packageName" class={cn(inputClass, "font-mono")} value={form().packageName} placeholder="Defaults to namespace" spellcheck={false} autocomplete="off"
                      aria-invalid={errorFor("packageName").length > 0} aria-describedby={errorFor("packageName").length > 0 ? "packageName-error" : undefined}
                      onInput={(event) => update("packageName", event.currentTarget.value)} />
                    <Show when={errorFor("packageName").length > 0}><p class={errorClass} id="packageName-error">{errorFor("packageName").join(" ")}</p></Show>
                  </div>
                </div>
                <div class="grid gap-4 sm:grid-cols-3">
                  <div class="grid gap-2"><label for="minSdk" class={labelClass}>Minimum SDK</label>
                    <select id="minSdk" class={inputClass} value={String(form().minSdk)} onChange={(event) => update("minSdk", Number(event.currentTarget.value))}>
                      <For each={SDK_MIN}>{(value) => <option value={String(value)} disabled={value < (selectedPreset()?.compatibility.minSdk ?? props.catalog.template.minSdk)}>API {value}</option>}</For>
                    </select>
                  </div>
                  <div class="grid gap-2"><label for="targetSdk" class={labelClass}>Target SDK</label>
                    <select id="targetSdk" class={inputClass} value={String(form().targetSdk)} onChange={(event) => update("targetSdk", Number(event.currentTarget.value))}>
                      <For each={SDK_MIN}>{(value) => <option value={String(value)}>API {value}</option>}</For>
                    </select>
                  </div>
                  <div class="grid gap-2"><label for="compileSdk" class={labelClass}>Compile SDK</label>
                    <select id="compileSdk" class={inputClass} value={String(form().compileSdk)} onChange={(event) => update("compileSdk", Number(event.currentTarget.value))}>
                      <For each={SDK_COMPILE}>{(value) => <option value={String(value)}>API {value}</option>}</For>
                    </select>
                  </div>
                </div>
                <Show when={errorFor("minSdk").length || errorFor("targetSdk").length || errorFor("compileSdk").length}>
                  <p class={errorClass}>{[...errorFor("minSdk"), ...errorFor("targetSdk"), ...errorFor("compileSdk")].join(" ")}</p>
                </Show>
                <p class={helpClass}>The generator validates SDK compatibility. Keep these defaults unless your project needs a different API level.</p>
              </Collapsible>
            </div>
          </section>

          {/* 3. Preset */}
          <section hidden={step() !== 2} aria-labelledby="section-preset">
            <SectionHeader index={2} id="section-preset" title="Choose a starting point"
              description={isOwned() ? "Pick a ready-to-build template, or start from scratch and add only what you need." : "Templates are Android-only today. Delegated platforms start from the official template."} />
            <fieldset>
              <legend class="sr-only">Project template</legend>
              <div class="grid gap-3 sm:grid-cols-2">
                <Show when={isOwned()}>
                  <For each={supportedPresets}>{(preset) => (
                    <label class={cn(
                      "relative flex min-w-0 cursor-pointer flex-col gap-3 rounded-lg border bg-background p-4 transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      presetId() === preset.id && "border-primary ring-1 ring-primary",
                    )}>
                      <input type="radio" class="sr-only" name="preset" value={preset.id} checked={presetId() === preset.id} onChange={() => applyPreset(preset.id)} />
                      <span class="flex items-start justify-between gap-2">
                        <span class="grid size-9 place-items-center rounded-md border bg-muted/50" aria-hidden="true">{(PRESET_ICONS[preset.id] ?? PRESET_ICONS["compose-minimal"]!)({ class: "size-4" })}</span>
                        <Badge variant={statusVariant(preset.status)}>{preset.status}</Badge>
                      </span>
                      <span class="flex flex-col gap-1">
                        <span class="font-semibold leading-tight">{preset.name}</span>
                        <span class="text-sm text-muted-foreground">{preset.description}</span>
                      </span>
                      <span class="mt-auto flex flex-wrap gap-1">
                        <Show when={preset.requiredAddons.length > 0} fallback={<Badge variant="muted">No add-ons</Badge>}>
                          <For each={preset.requiredAddons.filter((id) => id.startsWith("ui/") && id !== "ui/foundation" && id !== "ui/navigation").slice(0, 4)}>{(id) => <Badge variant="secondary">{addonName(id)}</Badge>}</For>
                          <Show when={preset.requiredAddons.length > 4}><Badge variant="muted">+{preset.requiredAddons.length - Math.min(4, preset.requiredAddons.filter((id) => id.startsWith("ui/") && id !== "ui/foundation" && id !== "ui/navigation").length)} more</Badge></Show>
                        </Show>
                      </span>
                    </label>
                  )}</For>
                </Show>
                <label class={cn(
                  "relative flex min-w-0 cursor-pointer flex-col gap-3 rounded-lg border border-dashed bg-background p-4 transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  presetId() === "" && "border-solid border-primary ring-1 ring-primary",
                )}>
                  <input type="radio" class="sr-only" name="preset" value="" checked={presetId() === ""} onChange={resetToCustom} />
                  <span class="flex items-start justify-between gap-2">
                    <span class="grid size-9 place-items-center rounded-md border bg-muted/50" aria-hidden="true"><Plus class="size-4" /></span>
                    <Badge variant="outline">flexible</Badge>
                  </span>
                  <span class="flex flex-col gap-1">
                    <span class="font-semibold leading-tight">{isOwned() ? "Custom setup" : "Official template"}</span>
                    <span class="text-sm text-muted-foreground">{isOwned() ? "Start minimal and pick only the capabilities you need." : "The official starter plus Launchbed tokens, mise, justfile and CI."}</span>
                  </span>
                </label>
              </div>
            </fieldset>
            <Show when={isOwned() && upcomingPresets.length > 0}>
              <div class="mt-4">
                <Collapsible title={`${upcomingPresets.length} more templates are planned`} subtitle="Visible for transparency. They cannot be generated yet.">
                  <ul class="grid gap-2 text-sm">
                    <For each={upcomingPresets}>{(preset) => <li class="flex flex-wrap items-center gap-2"><Badge variant="muted">planned</Badge><span class="font-medium">{preset.name}</span><span class="text-muted-foreground">{preset.description}</span></li>}</For>
                  </ul>
                </Collapsible>
              </div>
            </Show>
          </section>

          {/* 4. Add-ons */}
          <section hidden={step() !== 3} aria-labelledby="section-addons">
            <SectionHeader index={3} id="section-addons" title="Add capabilities"
              description="Optional. Template requirements stay selected and dependencies are resolved for you." />
            <div class="relative mb-5">
              <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label for="addonSearch" class="sr-only">Search capabilities</label>
              <input type="search" id="addonSearch" class={cn(inputClass, "pl-9")} value={addonQuery()} placeholder="Search Room, auth, navigation…"
                onInput={(event) => setAddonQuery(event.currentTarget.value)} />
            </div>
            <div class="grid gap-6">
              <For each={CATEGORY_ORDER}>{(category) => (
                <Show when={filteredAddons(category).length > 0}>
                  <fieldset class="grid gap-2">
                    <legend class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{CATEGORY_LABELS[category] ?? category}</legend>
                    <div class="grid gap-2 md:grid-cols-2">
                      <For each={filteredAddons(category)}>{(addon) => {
                        const required = () => requiredAddons().includes(addon.id);
                        const checked = () => selectedAddons().includes(addon.id);
                        return (
                          <label class={cn(
                            "flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                            checked() && "border-primary/60 bg-accent/40",
                            required() && "cursor-default",
                          )}>
                            <input type="checkbox" class="peer sr-only" value={addon.id} checked={checked()} disabled={required()}
                              onChange={(event) => toggleAddon(addon.id, event.currentTarget.checked)} />
                            <span class={cn(
                              "mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border border-input shadow-xs",
                              checked() && "border-primary bg-primary text-primary-foreground",
                              required() && "opacity-60",
                            )} aria-hidden="true"><Show when={checked()}><Check class="size-3" stroke-width={3} /></Show></span>
                            <span class="flex min-w-0 flex-col gap-1">
                              <span class="flex flex-wrap items-center gap-1.5 text-sm font-medium leading-none">
                                {addon.displayName}
                                <Show when={required()}><Badge variant="outline">included</Badge></Show>
                                <Show when={addon.status !== "stable"}><Badge variant={statusVariant(addon.status)}>{addon.status}</Badge></Show>
                              </span>
                              <span class="text-xs text-muted-foreground">{addon.description}</span>
                            </span>
                          </label>
                        );
                      }}</For>
                    </div>
                  </fieldset>
                </Show>
              )}</For>
              <Show when={filteredPlanned().length > 0}>
                <Collapsible title={`Coming later (${filteredPlanned().length})`} subtitle="Planned add-ons are listed for transparency and cannot be selected.">
                  <ul class="grid gap-3">
                    <For each={filteredPlanned()}>{(addon) => (
                      <li class="flex min-w-0 flex-col gap-1 text-sm">
                        <span class="flex flex-wrap items-center gap-1.5 font-medium">{addon.displayName}<Badge variant="muted">{addon.status}</Badge></span>
                        <span class="text-xs text-muted-foreground">{plannedReason(addon)}</span>
                      </li>
                    )}</For>
                  </ul>
                </Collapsible>
              </Show>
              <Show when={generatedAddons().length === 0}><p class="text-sm text-muted-foreground">No add-ons are available for this platform yet.</p></Show>
              <Show when={errorFor("addons").length > 0}><p class={errorClass}>{errorFor("addons").join(" ")}</p></Show>
            </div>
          </section>

          {/* 5. Theme */}
          <section hidden={step() !== 4} aria-labelledby="section-theme">
            <SectionHeader index={4} id="section-theme" title="Choose a look"
              description="A seed color generates the full Material 3 palette (DTCG tokens) for every platform. The preview updates live." />
            <fieldset class="grid gap-3">
              <legend class={cn(labelClass, "mb-3")}>Seed color</legend>
              <div class="flex flex-wrap gap-2">
                <For each={PALETTES}>{(palette) => (
                  <label class={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    form().seedColor.toLowerCase() === palette.value.toLowerCase() && "border-primary ring-1 ring-primary",
                  )}>
                    <input type="radio" class="sr-only" name="seedPreset" value={palette.value} checked={form().seedColor.toLowerCase() === palette.value.toLowerCase()}
                      onChange={() => update("seedColor", palette.value)} />
                    <span class="size-4 rounded-full border border-black/10" style={{ "background-color": palette.value }} aria-hidden="true" />
                    {palette.name}
                  </label>
                )}</For>
                <label class="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                  <input type="color" name="seedColor" class="size-5 cursor-pointer rounded border-0 bg-transparent p-0" value={form().seedColor} aria-label="Custom seed color"
                    onInput={(event) => update("seedColor", event.currentTarget.value)} />
                  Custom <code class="text-xs text-muted-foreground">{form().seedColor.toUpperCase()}</code>
                </label>
              </div>
            </fieldset>
            <div class="mt-5 grid grid-cols-5 gap-2" aria-label="Generated color roles">
              <For each={swatches()}>{(swatch) => (
                <div class="min-w-0">
                  <div class="h-10 rounded-md border" style={{ "background-color": swatch.value }} />
                  <p class="mt-1 truncate text-xs font-medium">{swatch.role}</p>
                  <p class="truncate font-mono text-[10px] text-muted-foreground">{swatch.value}</p>
                </div>
              )}</For>
            </div>
            <div class="mt-6 grid gap-5 sm:grid-cols-2">
              <div class="grid gap-2"><label for="fontFamily" class={labelClass}>Typography</label>
                <select id="fontFamily" class={inputClass} value={form().fontFamily} onChange={(event) => update("fontFamily", event.currentTarget.value as FormState["fontFamily"])}>
                  <For each={FONTS}>{(font) => <option value={font.value}>{font.label}</option>}</For>
                </select>
              </div>
              <div class="grid gap-2"><label for="cornerRadius" class={labelClass}>Corner radius <span class="font-normal text-muted-foreground">{form().cornerRadius} dp</span></label>
                <input id="cornerRadius" type="range" min="0" max="32" step="1" class="h-10 w-full accent-primary" value={String(form().cornerRadius)}
                  onInput={(event) => update("cornerRadius", Number(event.currentTarget.value))} />
              </div>
            </div>
            <div class="mt-5 grid gap-2">
              <span class={labelClass} id="default-mode-label">Default app theme</span>
              <div class="inline-flex w-fit rounded-md bg-muted p-1" role="radiogroup" aria-labelledby="default-mode-label">
                <For each={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }] as const}>
                  {(option) => (
                    <label class={cn(
                      "cursor-pointer rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      form().defaultMode === option.value && "bg-background text-foreground shadow-sm",
                    )}>
                      <input type="radio" class="sr-only" name="defaultMode" value={option.value} checked={form().defaultMode === option.value}
                        onChange={() => update("defaultMode", option.value)} />{option.label}
                    </label>
                  )}</For>
              </div>
            </div>
          </section>

          {/* 6. Review */}
          <section hidden={step() !== 5} aria-labelledby="section-review">
            <SectionHeader index={5} id="section-review" title="Review and download"
              description={isOwned() ? "Check the file plan, copy the CLI command, then download a verified ZIP." : "Check the overlay plan and copy the command. Delegated platforms are created on your machine."} />
            <dl class="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
              <For each={[
                ["Platform", targetDef()?.displayName ?? target()],
                ["Project", form().projectName],
                ["Application ID", form().applicationId],
                ["Template", isOwned() ? (selectedPreset()?.name ?? "Custom setup") : "Official template"],
              ] as const}>{([term, value]) => (
                <div class="min-w-0 bg-card p-3">
                  <dt class="text-xs text-muted-foreground">{term}</dt>
                  <dd class="mt-0.5 truncate text-sm font-medium" title={value}>{value}</dd>
                </div>
              )}</For>
            </dl>
            <div class="mt-3 flex flex-wrap gap-1.5" aria-label="Selected add-ons">
              <Show when={selectedAddons().length > 0} fallback={<Badge variant="muted">No add-ons</Badge>}>
                <For each={selectedAddons()}>{(id) => <Badge variant="secondary">{addonName(id)}</Badge>}</For>
              </Show>
            </div>

            <div class="mt-6 overflow-hidden rounded-lg border bg-zinc-950 text-zinc-50 dark:bg-zinc-900">
              <div class="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                <span class="flex items-center gap-2 text-xs text-zinc-400"><Terminal class="size-3.5" aria-hidden="true" /><label for="cliCommand">Equivalent CLI command</label></span>
                <button type="button" class="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  onClick={() => void copyText(cliCommand(), "cliCommand")} aria-live="polite">
                  <Show when={copied()} fallback={<><Copy class="size-3.5" aria-hidden="true" />Copy</>}><Check class="size-3.5" aria-hidden="true" />Copied</Show>
                </button>
              </div>
              <pre id="cliCommand" class="code-scroll px-4 py-3 text-[13px] leading-relaxed" tabindex="0" aria-label="Equivalent CLI command">{cliCommand()}</pre>
            </div>
            <p class={cn(helpClass, "mt-2")}>Run it from a Launchbed checkout with Bun. It writes a project directory and a sibling ZIP.</p>

            <div class="mt-6 flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 flex-col gap-0.5">
                <span class="text-sm font-medium">{isOwned() ? "Ready to launch?" : "Create it on your machine"}</span>
                <span class="text-xs text-muted-foreground">{isOwned()
                  ? "The ZIP includes the Gradle wrapper, a pinned mise.toml, a justfile, Kotlin sources and setup scripts."
                  : "The web app never runs official CLIs. It returns the plan and the exact command."}</span>
              </div>
              <div class="flex shrink-0 flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy() !== null} onClick={() => void checkPlan()}>
                  <Show when={busy() === "plan"} fallback={<RotateCw class="size-4" aria-hidden="true" />}><LoaderCircle class="size-4 animate-spin" aria-hidden="true" /></Show>
                  Refresh plan
                </Button>
                <Button type="submit" disabled={busy() !== null}>
                  <Show when={busy() === "generate"} fallback={isOwned() ? <Download class="size-4" aria-hidden="true" /> : <Terminal class="size-4" aria-hidden="true" />}><LoaderCircle class="size-4 animate-spin" aria-hidden="true" /></Show>
                  {busy() === "generate" ? "Preparing…" : isOwned() ? "Download Android project" : "Get the command"}
                </Button>
              </div>
            </div>
            <p class="mt-3 text-sm text-muted-foreground" aria-live="polite" role="status">{status() || (busy() ? "Working…" : "")}</p>

            <Show when={delegateCommand()}>
              <div class="mt-3 overflow-hidden rounded-lg border">
                <div class="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium">
                  <span>Run on your machine</span>
                  <button type="button" class="inline-flex h-7 items-center gap-1.5 rounded-md px-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => void copyText(delegateCommand(), "delegateCommand")}><Copy class="size-3.5" aria-hidden="true" />Copy</button>
                </div>
                <pre id="delegateCommand" class="code-scroll px-4 py-3 font-mono text-[13px]" tabindex="0">{delegateCommand()}</pre>
              </div>
            </Show>

            <Show when={plan()}>{(summary) => (
              <div class="mt-6 rounded-lg border">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <span class="flex items-center gap-2 text-sm font-medium"><FileCode class="size-4 text-muted-foreground" aria-hidden="true" />{summary().strategy === "delegate" ? "Launchbed overlays" : "Generated files"}</span>
                  <span class="flex gap-1.5"><Badge variant="secondary">{summary().files} files</Badge><Badge variant="secondary">{formatBytes(summary().bytes)}</Badge></span>
                </div>
                <ul class="max-h-56 overflow-auto px-4 py-2 font-mono text-xs leading-6 text-muted-foreground">
                  <For each={summary().paths}>{(file) => <li class="flex min-w-0 items-center justify-between gap-3"><span class="truncate">{file.path}</span><span class="shrink-0 text-[10px] uppercase tracking-wider opacity-70">{file.origin}</span></li>}</For>
                </ul>
                <Show when={summary().warnings.length > 0}>
                  <details class="group border-t bg-warning/40 px-4 py-3 text-xs text-foreground [&_summary::-webkit-details-marker]:hidden" open={summary().warnings.length <= 2}>
                    <summary class="flex cursor-pointer items-center gap-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <CircleAlert class="size-3.5 shrink-0" aria-hidden="true" />{summary().warnings.length} {summary().warnings.length === 1 ? "note" : "notes"} before shipping
                      <ChevronDown class="ml-auto size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <ul class="mt-2 grid gap-1 pl-5 text-muted-foreground"><For each={summary().warnings}>{(warning) => <li class="list-disc">{warning}</li>}</For></ul>
                  </details>
                </Show>
                <p class="border-t px-4 py-2 text-xs text-muted-foreground">{summary().strategy === "delegate" ? "Overlays are applied after the official CLI finishes." : "The ZIP is verified against this plan before download."}</p>
              </div>
            )}</Show>
          </section>
        </div>

        <div class="flex items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" disabled={step() === 0} onClick={() => goTo(step() - 1)}>
            <ArrowLeft class="size-4" aria-hidden="true" />Back
          </Button>
          <span class="text-xs text-muted-foreground tabular-nums">{step() + 1} / {STEPS.length}</span>
          <Show when={step() < STEPS.length - 1} fallback={<span class="w-[88px]" aria-hidden="true" />}>
            <Button type="button" onClick={() => goTo(step() + 1)}>
              <span class="hidden sm:inline">Continue to</span> {STEPS[step() + 1]!.label}<ArrowRight class="size-4" aria-hidden="true" />
            </Button>
          </Show>
        </div>
      </form>

      {/* Preview */}
      <aside class="min-w-0 self-start rounded-xl border bg-card text-card-foreground shadow-sm lg:sticky lg:top-20" aria-labelledby="preview-title">
        <div class="flex items-start justify-between gap-3 border-b p-4">
          <div class="flex min-w-0 flex-col gap-1">
            <h3 id="preview-title" class="flex items-center gap-2 font-semibold leading-none">Live preview <Badge variant="outline">Illustrative</Badge></h3>
            <p class="truncate text-xs text-muted-foreground">{targetDef()?.displayName ?? target()}</p>
          </div>
          <div class="inline-flex shrink-0 rounded-md bg-muted p-1" role="group" aria-label="Preview appearance">
            <For each={[{ value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }] as const}>{(option) => (
              <button type="button" aria-pressed={previewMode() === option.value} aria-label={`${option.label} preview`} onClick={() => { setPreviewTouched(true); setPreviewMode(option.value); }}
                class={cn("inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-xs font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  previewMode() === option.value && "bg-background text-foreground shadow-sm")}>
                <option.icon class="size-3.5" aria-hidden="true" /><span class="hidden sm:inline">{option.label}</span>
              </button>
            )}</For>
          </div>
        </div>
        <div class="flex flex-col gap-4 p-4">
          <Show when={availableScreens().length > 1}>
            <div class="flex flex-wrap gap-1.5" role="group" aria-label="Preview screen">
              <For each={availableScreens()}>{(screen) => (
                <button type="button" aria-pressed={activePreviewScreen() === screen} onClick={() => setPreviewScreen(screen)}
                  class={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activePreviewScreen() === screen ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground")}>
                  {PREVIEW_SCREEN_LABELS[screen]}
                </button>
              )}</For>
            </div>
          </Show>
          <div class="rounded-lg bg-muted/40 px-2 py-6 bg-grid">
            <PreviewScreen tokens={tokens()} mode={previewMode()} screen={activePreviewScreen()} target={target() === "tauri-solid" ? "android-compose" : target() as "android-compose" | "expo" | "flutter"}
              hasNavigation={selectedAddons().includes("ui/navigation")}
              projectName={form().projectName || "My App"}
              caption={previewCaption()} />
          </div>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <dt class="text-muted-foreground">Template</dt><dd class="truncate text-right font-medium">{isOwned() ? (selectedPreset()?.name ?? "Custom") : "Official"}</dd>
            <dt class="text-muted-foreground">Add-ons</dt><dd class="text-right font-medium">{selectedAddons().length}</dd>
            <dt class="text-muted-foreground">App ID</dt><dd class="truncate text-right font-mono" title={form().applicationId}>{form().applicationId}</dd>
            <dt class="text-muted-foreground">Seed</dt><dd class="flex items-center justify-end gap-1.5 font-mono"><span class="size-3 rounded-full border" style={{ "background-color": form().seedColor }} aria-hidden="true" />{form().seedColor.toUpperCase()}</dd>
          </dl>
          <p class="text-xs text-muted-foreground">Sample values in the preview ship as placeholders in the generated code. Replace them with your own data.</p>
        </div>
      </aside>
    </div>
  );
}
