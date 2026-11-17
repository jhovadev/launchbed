import { For, Show, createMemo, createSignal } from "solid-js";
import type { CatalogResponse, ProjectPresetManifest, ProjectRequest, ThemeConfig } from "@launchbed/schema";
import { resolveThemeTokens } from "@launchbed/design-tokens";
import { PreviewScreen } from "@launchbed/preview";
import { formatNewCommand, projectSlug } from "@launchbed/schema";

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
}

const SDK_MIN = [24, 26, 28, 30, 31, 33, 34, 35, 36, 37];
const SDK_COMPILE = [34, 35, 36, 37];
const FONTS: { value: ThemeConfig["typography"]["fontFamily"]; label: string }[] = [
  { value: "default", label: "Platform default" },
  { value: "sansSerif", label: "Sans serif" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
];
const PRESETS = [
  { name: "Violet", value: "#6750A4" },
  { name: "Forest", value: "#006C4C" },
  { name: "Ember", value: "#8C4A2F" },
  { name: "Ocean", value: "#2C5D8F" },
  { name: "Graphite", value: "#4A4F5A" },
];
const CATEGORY_LABELS: Record<string, string> = {
  storage: "Storage",
  ui: "UI",
  native: "Native",
  tooling: "Tooling",
  foundation: "Foundation",
};

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
  const [previewMode, setPreviewMode] = createSignal<"light" | "dark">("light");
  // The minimal preset is a usable, predictable starting point on both SSR and hydration.
  const starterPreset = (props.presets ?? []).find((preset) => preset.id === "compose-minimal" && preset.status === "stable");
  const [presetId, setPresetId] = createSignal<string>(starterPreset?.id ?? "");
  const [previewScreen, setPreviewScreen] = createSignal<"welcome" | "dashboard" | "settings" | "notes" | "catalog">("welcome");
  const [selectedAddons, setSelectedAddons] = createSignal<string[]>([]);
  const [addonQuery, setAddonQuery] = createSignal("");
  const supportedPresets = (props.presets ?? []).filter((preset) => preset.status === "stable" || preset.status === "beta");
  const upcomingPresets = (props.presets ?? []).filter((preset) => preset.status === "planned");
  const selectedPreset = createMemo(() => (props.presets ?? []).find((preset) => preset.id === presetId()));
  const requiredAddons = createMemo(() => selectedPreset()?.requiredAddons ?? []);
  const availableScreens = createMemo(() => {
    const screens: ("welcome" | "dashboard" | "settings" | "notes" | "catalog")[] = ["welcome"];
    if (selectedAddons().includes("ui/dashboard")) screens.push("dashboard");
    if (selectedAddons().includes("ui/settings")) screens.push("settings");
    if (selectedAddons().includes("ui/notes")) screens.push("notes");
    if (selectedAddons().includes("ui/catalog")) screens.push("catalog");
    return screens;
  });
  const activePreviewScreen = createMemo(() =>
    availableScreens().includes(previewScreen()) ? previewScreen() : "welcome",
  );
  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string[]>>({});
  const [formError, setFormError] = createSignal("");
  const [status, setStatus] = createSignal("");
  const [busy, setBusy] = createSignal<"plan" | "generate" | null>(null);
  const [plan, setPlan] = createSignal<PlanSummary | null>(null);

  const tokens = createMemo(() => resolveThemeTokens(themeConfig(form())));

  const generatedAddons = createMemo(() => props.catalog.addons.filter((addon) => addon.generatable));
  const plannedAddons = createMemo(() => props.catalog.addons.filter((addon) => !addon.generatable));
  const filteredAddons = (category: string) => generatedAddons().filter((addon) =>
    addon.category === category &&
    `${addon.displayName} ${addon.description} ${addon.id}`.toLowerCase().includes(addonQuery().trim().toLowerCase()),
  );
  const filteredPlannedAddons = (category: string) => plannedAddons().filter((addon) =>
    addon.category === category &&
    `${addon.displayName} ${addon.description} ${addon.id}`.toLowerCase().includes(addonQuery().trim().toLowerCase()),
  );
  const STEPS = [
    { id: "project", label: "Project" },
    { id: "preset", label: "Preset" },
    { id: "addons", label: "Add-ons" },
    { id: "theme", label: "Theme" },
    { id: "review", label: "Review" },
  ] as const;
  const [step, setStep] = createSignal(0);
  const [copied, setCopied] = createSignal(false);
  const cliCommand = createMemo(() =>
    formatNewCommand({
      projectName: form().projectName || "Demo App",
      applicationId: form().applicationId || "com.example.demo",
      preset: presetId() || undefined,
      addons: selectedAddons().filter((id) => !requiredAddons().includes(id)),
      out: projectSlug(form().projectName || "Demo App"),
    }),
  );

  function plannedReason(addon: CatalogResponse["addons"][number]): string {
    const note = addon.compatibility?.notes?.[0];
    if (note) return note;
    return `This add-on is ${addon.status} and is not generated yet.`;
  }

  async function copyCommand(): Promise<void> {
    const command = cliCommand();
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(command);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        // Fall through to selecting the command so the user can copy it.
      }
    }
    const pre = document.getElementById("cliCommand");
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

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setPlan(null);
    setStatus("");
    clearErrors();
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "minSdk" && next.targetSdk < (value as number)) next.targetSdk = value as number;
      return next;
    });
  }

  function applyPreset(id: string): void {
    setPlan(null);
    setStatus("");
    clearErrors();
    setPresetId(id);
    const preset = (props.presets ?? []).find((entry) => entry.id === id);
    if (!preset || !(preset.status === "stable" || preset.status === "beta")) return;
    setSelectedAddons([...preset.requiredAddons].sort());
    setPreviewScreen(preset.previewScreens.find((screen) => screen !== "welcome") ?? "welcome");
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
    setPlan(null);
    setStatus("");
    clearErrors();
    setSelectedAddons((previous) =>
      checked ? [...new Set([...previous, id])].sort() : previous.filter((value) => value !== id),
    );
  }

  function resetToCustom(): void {
    setPlan(null);
    setStatus("");
    clearErrors();
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
      ...(presetId() ? { preset: presetId() } : {}),
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
        totals: { files: number; bytes: number };
        request: { addons: string[] };
        warnings: string[];
      };
      setPlan({
        files: result.totals.files,
        bytes: result.totals.bytes,
        addons: result.request.addons,
        warnings: result.warnings,
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

  return (
    <div class="builder" data-launchbed-ui="v1">
      <header class="builder-heading">
        <div>
          <p class="eyebrow">Project builder</p>
          <h2>Build a Launchbed starter.</h2>
          <p class="builder-intro">Work through the steps: name the app, pick a preset, choose add-ons and a theme, then download a real Android project — or copy the equivalent CLI command.</p>
        </div>
        <span class="builder-trust">No sign-up · No cloud build</span>
      </header>
      <div class="workspace">
        <form class="panel form-panel" aria-busy={busy() !== null} onSubmit={(event) => { event.preventDefault(); void generate(); }} noValidate>
          <nav class="stepper" aria-label="Builder steps">
            <ol>
              <For each={STEPS}>{(item, index) => (
                <li classList={{ "is-active": step() === index(), "is-complete": step() > index() }}>
                  <button type="button" aria-current={step() === index() ? "step" : undefined} onClick={() => goTo(index())}>
                    <span class="stepper-index">{String(index() + 1).padStart(2, "0")}</span>
                    <span class="stepper-label">{item.label}</span>
                  </button>
                </li>
              )}</For>
            </ol>
          </nav>

          <Show when={formError()}>
            <div class="alert" role="alert" aria-live="assertive">
              <strong>We could not generate this project.</strong>
              <p>{formError()}</p>
              <Show when={Object.keys(fieldErrors()).length > 0}>
                <ul><For each={Object.entries(fieldErrors())}>{([field, messages]) => <li><code>{field}</code>: {messages.join(" ")}</li>}</For></ul>
              </Show>
            </div>
          </Show>

          <section class="builder-section" hidden={step() !== 0} aria-labelledby="section-identity">
            <div class="section-heading"><span class="step">01</span><div><h3 id="section-identity">Name your app</h3><p>Only two fields are required. Technical defaults are already filled in.</p></div></div>
            <div class="field">
              <label for="projectName">Project name</label>
              <input id="projectName" name="projectName" value={form().projectName} required maxlength={64} autocomplete="off"
                aria-invalid={errorFor("projectName").length > 0}
                aria-describedby={errorFor("projectName").length > 0 ? "projectName-error" : undefined}
                onInput={(event) => update("projectName", event.currentTarget.value)} />
              <Show when={errorFor("projectName").length > 0}><p class="field-error" id="projectName-error">{errorFor("projectName").join(" ")}</p></Show>
            </div>
            <div class="field">
              <label for="applicationId">Application ID <span class="field-hint">unique app identifier</span></label>
              <input id="applicationId" name="applicationId" value={form().applicationId} required spellcheck={false} autocomplete="off"
                aria-invalid={errorFor("applicationId").length > 0}
                aria-describedby={errorFor("applicationId").length > 0 ? "applicationId-error" : undefined}
                onInput={(event) => {
                  const previousId = form().applicationId;
                  const previousNamespace = form().namespace;
                  update("applicationId", event.currentTarget.value);
                  if (previousId === previousNamespace) update("namespace", event.currentTarget.value);
                }} />
              <Show when={errorFor("applicationId").length > 0}><p class="field-error" id="applicationId-error">{errorFor("applicationId").join(" ")}</p></Show>
              <p class="field-help">Example: com.yourcompany.myapp. You can change the package separately below.</p>
            </div>
            <details class="advanced-panel">
              <summary>Advanced Android settings <span>Namespace, Kotlin package and SDK</span></summary>
              <div class="advanced-content">
                <div class="field-grid">
                  <div class="field">
                    <label for="namespace">Namespace</label>
                    <input id="namespace" name="namespace" value={form().namespace} required spellcheck={false} autocomplete="off"
                      aria-invalid={errorFor("namespace").length > 0} aria-describedby={errorFor("namespace").length > 0 ? "namespace-error" : undefined}
                      onInput={(event) => update("namespace", event.currentTarget.value)} />
                    <Show when={errorFor("namespace").length > 0}><p class="field-error" id="namespace-error">{errorFor("namespace").join(" ")}</p></Show>
                  </div>
                  <div class="field">
                    <label for="packageName">Kotlin package <span class="optional">optional</span></label>
                    <input id="packageName" name="packageName" value={form().packageName} placeholder="Defaults to namespace" spellcheck={false} autocomplete="off"
                      aria-invalid={errorFor("packageName").length > 0} aria-describedby={errorFor("packageName").length > 0 ? "packageName-error" : undefined}
                      onInput={(event) => update("packageName", event.currentTarget.value)} />
                    <Show when={errorFor("packageName").length > 0}><p class="field-error" id="packageName-error">{errorFor("packageName").join(" ")}</p></Show>
                  </div>
                </div>
                <div class="field-grid three">
                  <div class="field"><label for="minSdk">Minimum SDK</label>
                    <select id="minSdk" value={String(form().minSdk)} onChange={(event) => update("minSdk", Number(event.currentTarget.value))}>
                      <For each={SDK_MIN}>{(value) => <option value={String(value)} disabled={value < (selectedPreset()?.compatibility.minSdk ?? props.catalog.template.minSdk)}>API {value}</option>}</For>
                    </select>
                  </div>
                  <div class="field"><label for="targetSdk">Target SDK</label>
                    <select id="targetSdk" value={String(form().targetSdk)} onChange={(event) => update("targetSdk", Number(event.currentTarget.value))}>
                      <For each={SDK_MIN}>{(value) => <option value={String(value)}>API {value}</option>}</For>
                    </select>
                  </div>
                  <div class="field"><label for="compileSdk">Compile SDK</label>
                    <select id="compileSdk" value={String(form().compileSdk)} onChange={(event) => update("compileSdk", Number(event.currentTarget.value))}>
                      <For each={SDK_COMPILE}>{(value) => <option value={String(value)}>API {value}</option>}</For>
                    </select>
                  </div>
                </div>
                <Show when={errorFor("minSdk").length || errorFor("targetSdk").length || errorFor("compileSdk").length}>
                  <p class="field-error">{[...errorFor("minSdk"), ...errorFor("targetSdk"), ...errorFor("compileSdk")].join(" ")}</p>
                </Show>
                <p class="field-help">The generator validates SDK compatibility. Keep these defaults unless your project needs a different API level.</p>
              </div>
            </details>
          </section>

          <section class="builder-section" hidden={step() !== 1} aria-labelledby="section-preset">
            <div class="section-heading">
              <span class="step">02</span>
              <div><h3 id="section-preset">Choose a starting point</h3><p>Use a ready-to-build template, or start with a custom setup.</p></div>
            </div>
            <fieldset class="template-fieldset">
              <legend class="sr-only">Project template</legend>
              <div class="template-grid">
                <For each={supportedPresets}>
                  {(preset) => (
                    <label class="template-card" classList={{ "is-selected": presetId() === preset.id }}>
                      <input type="radio" name="preset" value={preset.id} checked={presetId() === preset.id}
                        onChange={() => applyPreset(preset.id)} />
                      <span class="template-card-top">
                        <span class="template-icon" aria-hidden="true">{preset.id === "local-notes" ? "N" : preset.id === "catalog-ui" ? "C" : preset.id === "compose-starter" ? "S" : "K"}</span>
                        <span class={`badge badge-${preset.status}`}>{preset.status}</span>
                      </span>
                      <span class="template-card-name">{preset.name}</span>
                      <span class="template-card-description">{preset.description}</span>
                      <span class="template-card-foot">{preset.requiredAddons.length} included capabilities</span>
                    </label>
                  )}
                </For>
                <label class="template-card custom-template" classList={{ "is-selected": presetId() === "" }}>
                  <input type="radio" name="preset" value="" checked={presetId() === ""} onChange={resetToCustom} />
                  <span class="template-card-top"><span class="template-icon" aria-hidden="true">+</span><span class="badge badge-stable">flexible</span></span>
                  <span class="template-card-name">Custom setup</span>
                  <span class="template-card-description">Start minimal and pick only the capabilities you need.</span>
                  <span class="template-card-foot">Choose your own add-ons</span>
                </label>
              </div>
            </fieldset>
            <Show when={upcomingPresets.length > 0}>
              <details class="upcoming-presets">
                <summary>{upcomingPresets.length} more templates are planned and cannot be generated yet</summary>
                <ul><For each={upcomingPresets}>{(preset) => <li><strong>{preset.name}</strong> — {preset.description}</li>}</For></ul>
              </details>
            </Show>
          </section>

          <section class="builder-section" hidden={step() !== 2} aria-labelledby="section-addons">
            <div class="section-heading"><span class="step">03</span><div><h3 id="section-addons">Add capabilities</h3><p>Optional. Built-in template requirements stay selected. Planned add-ons are visible but disabled.</p></div></div>
            <div class="addon-picker addon-picker-open">
              <div class="field"><label for="addonSearch">Search capabilities</label>
                <input type="search" id="addonSearch" value={addonQuery()} placeholder="Try Room, navigation, or UI…"
                  onInput={(event) => setAddonQuery(event.currentTarget.value)} />
              </div>
              <For each={["storage", "ui", "tooling", "native", "foundation"]}>
                {(category) => <Show when={filteredAddons(category).length > 0 || filteredPlannedAddons(category).length > 0}>
                  <fieldset class="addon-group"><legend>{CATEGORY_LABELS[category]}</legend>
                    <For each={filteredAddons(category)}>{(addon) => (
                      <label class="addon" classList={{ "is-required": requiredAddons().includes(addon.id) }}>
                        <input type="checkbox" value={addon.id} checked={selectedAddons().includes(addon.id)}
                          disabled={requiredAddons().includes(addon.id)} onChange={(event) => toggleAddon(addon.id, event.currentTarget.checked)} />
                        <span class="addon-body"><span class="addon-title">{addon.displayName}
                          <Show when={requiredAddons().includes(addon.id)}><span class="badge badge-stable">included</span></Show>
                          <span class={`badge badge-${addon.status}`}>{addon.status}</span>
                        </span><span class="addon-description">{addon.description}</span></span>
                      </label>
                    )}</For>
                    <For each={filteredPlannedAddons(category)}>{(addon) => (
                      <label class="addon disabled" aria-disabled="true">
                        <input type="checkbox" value={addon.id} disabled checked={false} />
                        <span class="addon-body"><span class="addon-title">{addon.displayName}
                          <span class={`badge badge-${addon.status}`}>{addon.status}</span>
                        </span>
                        <span class="addon-description">{addon.description}</span>
                        <span class="addon-reason">{plannedReason(addon)}</span>
                        </span>
                      </label>
                    )}</For>
                  </fieldset>
                </Show>}</For>
              <Show when={generatedAddons().length === 0 && plannedAddons().length === 0}><p class="notice">No add-ons are listed yet.</p></Show>
              <Show when={errorFor("addons").length > 0}><p class="field-error">{errorFor("addons").join(" ")}</p></Show>
            </div>
            <Show when={selectedAddons().length > 0}>
              <p class="addon-selection">Selected: {selectedAddons().map((id) => props.catalog.addons.find((item) => item.id === id)?.displayName ?? id).join(" · ")}</p>
            </Show>
          </section>

          <section class="builder-section" hidden={step() !== 3} aria-labelledby="section-theme">
            <div class="section-heading"><span class="step">04</span><div><h3 id="section-theme">Choose a look</h3><p>See your Material 3 colors update in the preview.</p></div></div>
            <fieldset class="field">
              <legend>Color palette</legend>
              <div class="preset-row">
                <For each={PRESETS}>{(preset) => (
                  <label class="preset" classList={{ selected: form().seedColor.toLowerCase() === preset.value.toLowerCase() }}>
                    <input type="radio" name="seedPreset" value={preset.value} checked={form().seedColor.toLowerCase() === preset.value.toLowerCase()}
                      onChange={() => update("seedColor", preset.value)} />
                    <span class="preset-chip" style={{ "background-color": preset.value }} aria-hidden="true" /><span>{preset.name}</span>
                  </label>
                )}</For>
                <label class="preset custom"><span class="preset-chip" style={{ "background-color": form().seedColor }} aria-hidden="true" /><span>Custom</span>
                  <input type="color" name="seedColor" value={form().seedColor} aria-label="Custom seed color"
                    onInput={(event) => update("seedColor", event.currentTarget.value)} />
                </label>
              </div>
            </fieldset>
            <details class="advanced-panel">
              <summary>Fine-tune appearance <span>Fonts, corners and app theme</span></summary>
              <div class="advanced-content">
                <div class="field-grid">
                  <div class="field"><label for="fontFamily">Typography</label>
                    <select id="fontFamily" value={form().fontFamily} onChange={(event) => update("fontFamily", event.currentTarget.value as FormState["fontFamily"])}>
                      <For each={FONTS}>{(font) => <option value={font.value}>{font.label}</option>}</For>
                    </select>
                  </div>
                  <div class="field"><label for="cornerRadius">Corner radius: {form().cornerRadius} dp</label>
                    <input id="cornerRadius" type="range" min="0" max="32" step="1" value={String(form().cornerRadius)}
                      onInput={(event) => update("cornerRadius", Number(event.currentTarget.value))} />
                  </div>
                </div>
                <div class="field"><span class="label" id="default-mode-label">Default app theme</span>
                  <div class="segmented" role="group" aria-labelledby="default-mode-label">
                    <For each={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }] as const}>
                      {(option) => <label classList={{ selected: form().defaultMode === option.value }}>
                        <input type="radio" name="defaultMode" value={option.value} checked={form().defaultMode === option.value}
                          onChange={() => update("defaultMode", option.value)} />{option.label}
                      </label>}</For>
                  </div>
                </div>
              </div>
            </details>
          </section>

          <section class="builder-section" hidden={step() !== 4} aria-labelledby="section-review">
            <div class="section-heading"><span class="step">05</span><div><h3 id="section-review">Review and download</h3><p>Check the plan, copy the CLI command, then download a verified ZIP.</p></div></div>
            <dl class="review-summary">
              <div><dt>Project</dt><dd>{form().projectName}</dd></div>
              <div><dt>Application ID</dt><dd><code>{form().applicationId}</code></dd></div>
              <div><dt>Preset</dt><dd>{selectedPreset()?.name ?? "Custom setup"}</dd></div>
              <div><dt>Add-ons</dt><dd>{selectedAddons().length === 0 ? "none" : selectedAddons().join(", ")}</dd></div>
            </dl>
            <div class="cli-copy">
              <div class="cli-copy-head">
                <label for="cliCommand">Equivalent CLI command</label>
                <button type="button" class="button secondary compact" onClick={() => void copyCommand()}>
                  {copied() ? "Copied" : "Copy command"}
                </button>
              </div>
              <pre id="cliCommand" class="cli-command" tabindex="0" aria-label="Equivalent CLI command">{cliCommand()}</pre>
              <p class="field-help">Run this from a checkout of Launchbed with Bun. It writes a project directory and a sibling ZIP.</p>
            </div>
            <div class="actions">
              <div class="actions-copy"><strong>Ready to launch?</strong><span>The ZIP includes the Gradle wrapper, a pinned mise.toml, a justfile, Kotlin sources and setup scripts.</span></div>
              <button type="submit" class="button primary" disabled={busy() !== null}>
                {busy() === "generate" ? "Preparing your ZIP…" : "Download Android project"}
              </button>
              <button type="button" class="button secondary" disabled={busy() !== null} onClick={() => void checkPlan()}>
                {busy() === "plan" ? "Reviewing…" : "Refresh file plan"}
              </button>
            </div>
            <div class="status" aria-live="polite" role="status">{status() || (busy() ? "Working…" : "")}</div>
            <Show when={plan()}>{(summary) => <div class="plan"><h3>Generated files</h3>
              <dl><div><dt>Files</dt><dd>{summary().files}</dd></div><div><dt>Source size</dt><dd>{formatBytes(summary().bytes)}</dd></div>
                <div><dt>Resolved add-ons</dt><dd>{summary().addons.length === 0 ? "none" : summary().addons.join(", ")}</dd></div></dl>
              <Show when={summary().warnings.length > 0}><ul class="warnings"><For each={summary().warnings}>{(warning) => <li>{warning}</li>}</For></ul></Show>
              <p class="plan-note">The ZIP is verified against this plan before download.</p>
            </div>}</Show>
          </section>

          <div class="step-actions">
            <button type="button" class="button secondary" disabled={step() === 0} onClick={() => goTo(step() - 1)}>Back</button>
            <Show when={step() < STEPS.length - 1}>
              <button type="button" class="button primary" onClick={() => goTo(step() + 1)}>Continue to {STEPS[step() + 1]!.label}</button>
            </Show>
          </div>
        </form>

        <aside class="panel preview-panel" aria-labelledby="preview-title">
          <div class="preview-header"><div><span class="preview-kicker">Live preview</span><h3 id="preview-title">Your Android app</h3></div>
            <div class="segmented small" role="group" aria-label="Preview mode">
              <For each={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] as const}>{(option) => (
                <label classList={{ selected: previewMode() === option.value }}><input type="radio" name="previewMode" value={option.value}
                  checked={previewMode() === option.value} onChange={() => setPreviewMode(option.value)} />{option.label}</label>
              )}</For>
            </div>
          </div>
          <Show when={availableScreens().length > 1}>
            <div class="preview-screens" role="group" aria-label="Preview screen">
              <For each={availableScreens()}>{(screen) => <button type="button" class="preview-screen-button"
                classList={{ selected: activePreviewScreen() === screen }} aria-pressed={activePreviewScreen() === screen}
                onClick={() => setPreviewScreen(screen)}>{screen}</button>}</For>
            </div>
          </Show>
          <PreviewScreen tokens={tokens()} mode={previewMode()} screen={activePreviewScreen()}
            projectName={form().projectName || "Android App"}
            caption="Illustrative Compose preview. Not a running emulator." />
          <div class="preview-summary-head"><strong>Your configuration</strong><span>{selectedAddons().length} capabilities</span></div>
          <dl class="summary">
            <div><dt>Template</dt><dd>{selectedPreset()?.name ?? "Custom"}</dd></div>
            <div><dt>App ID</dt><dd><code>{form().applicationId}</code></dd></div>
            <div><dt>Minimum SDK</dt><dd>API {form().minSdk}</dd></div>
          </dl>
          <details class="preview-details"><summary>Show technical details</summary>
            <dl class="summary"><div><dt>Namespace</dt><dd><code>{form().namespace}</code></dd></div>
              <div><dt>Package</dt><dd><code>{form().packageName.trim() || form().namespace}</code></dd></div>
              <div><dt>SDK targets</dt><dd>{form().targetSdk} / {form().compileSdk}</dd></div>
            </dl>
          </details>
          <p class="preview-note">Everything is generated as source code and builds locally. No account required.</p>
        </aside>
      </div>
    </div>
  );
}
