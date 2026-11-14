import { For, Show, createMemo, createSignal } from "solid-js";
import type { CatalogResponse, ProjectPresetManifest, ProjectRequest, ThemeConfig } from "@android-initializr/schema";
import { resolveThemeTokens } from "@android-initializr/design-tokens";
import { PreviewScreen } from "@android-initializr/preview";

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
    seedColor: "#006C4C",
    fontFamily: "default",
    cornerRadius: 12,
    defaultMode: "system",
  });
  const [previewMode, setPreviewMode] = createSignal<"light" | "dark">("light");
  const [previewScreen, setPreviewScreen] = createSignal<"welcome" | "dashboard" | "settings">("welcome");
  const availableScreens = createMemo(() => {
    const screens: ("welcome" | "dashboard" | "settings")[] = ["welcome"];
    if (selectedAddons().includes("ui/dashboard")) screens.push("dashboard");
    if (selectedAddons().includes("ui/settings")) screens.push("settings");
    return screens;
  });
  const activePreviewScreen = createMemo(() =>
    availableScreens().includes(previewScreen()) ? previewScreen() : "welcome",
  );
  const [selectedAddons, setSelectedAddons] = createSignal<string[]>([]);
  const [presetId, setPresetId] = createSignal<string>("");
  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string[]>>({});
  const [formError, setFormError] = createSignal("");
  const [status, setStatus] = createSignal("");
  const [busy, setBusy] = createSignal<"plan" | "generate" | null>(null);
  const [plan, setPlan] = createSignal<PlanSummary | null>(null);

  const tokens = createMemo(() => resolveThemeTokens(themeConfig(form())));

  const generatedAddons = createMemo(() => props.catalog.addons.filter((addon) => addon.generatable));

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "minSdk" && next.targetSdk < (value as number)) next.targetSdk = value as number;
      return next;
    });
  }

  function applyPreset(id: string): void {
    setPresetId(id);
    const preset = (props.presets ?? []).find((entry) => entry.id === id);
    if (!preset || !(preset.status === "stable" || preset.status === "beta")) return;
    setSelectedAddons([...preset.requiredAddons].sort());
    const theme = preset.defaultTheme;
    setForm((previous) => ({
      ...previous,
      seedColor: theme.seedColor,
      fontFamily: theme.typography.fontFamily,
      cornerRadius: theme.shape.cornerRadius,
      defaultMode: theme.defaultMode,
    }));
  }

  function toggleAddon(id: string, checked: boolean): void {
    setSelectedAddons((previous) =>
      checked ? [...new Set([...previous, id])].sort() : previous.filter((value) => value !== id),
    );
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
    <div class="workspace">
      <form
        class="panel form-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
        }}
        noValidate
      >
        <Show when={formError()}>
          <div class="alert" role="alert">
            <strong>We could not generate this project.</strong>
            <p>{formError()}</p>
            <Show when={Object.keys(fieldErrors()).length > 0}>
              <ul>
                <For each={Object.entries(fieldErrors())}>
                  {([field, messages]) => (
                    <li>
                      <code>{field}</code>: {messages.join(" ")}
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        </Show>

        <section aria-labelledby="section-preset">
          <h2 id="section-preset">
            <span class="step">00</span> Project template
          </h2>
          <p class="section-help">
            Presets are declarative configurations over the same generator. The backend resolves and
            validates every dependency.
          </p>
          <div class="field">
            <label for="preset">Preset</label>
            <select
              id="preset"
              value={presetId()}
              onChange={(event) => applyPreset(event.currentTarget.value)}
            >
              <option value="">Custom (manual selection)</option>
              <For each={(props.presets ?? [])}>
                {(preset) => (
                  <option value={preset.id} disabled={!(preset.status === "stable" || preset.status === "beta")}>
                    {preset.name} ({preset.status})
                  </option>
                )}
              </For>
            </select>
          </div>
          <Show when={presetId()}>
            {(id) => {
              const preset = (props.presets ?? []).find((entry) => entry.id === id());
              return preset ? (
                <p class="section-help">
                  {preset.description} Required addons:{" "}
                  {preset.requiredAddons.length === 0 ? "none" : preset.requiredAddons.join(", ")}.
                </p>
              ) : null;
            }}
          </Show>
        </section>

        <section aria-labelledby="section-identity">
          <h2 id="section-identity">
            <span class="step">01</span> Identity
          </h2>
          <p class="section-help">
            <code>applicationId</code> is installed on the device. <code>namespace</code> only controls the
            generated <code>R</code> class. They can differ, and the Kotlin package can differ from both.
          </p>
          <div class="field">
            <label for="projectName">Project name</label>
            <input
              id="projectName"
              name="projectName"
              value={form().projectName}
              required
              maxlength={64}
              autocomplete="off"
              aria-invalid={errorFor("projectName").length > 0}
              aria-describedby={errorFor("projectName").length > 0 ? "projectName-error" : undefined}
              onInput={(event) => update("projectName", event.currentTarget.value)}
            />
            <Show when={errorFor("projectName").length > 0}>
              <p class="field-error" id="projectName-error">{errorFor("projectName").join(" ")}</p>
            </Show>
          </div>
          <div class="field-grid">
            <div class="field">
              <label for="applicationId">Application ID</label>
              <input
                id="applicationId"
                name="applicationId"
                value={form().applicationId}
                required
                spellcheck={false}
                autocomplete="off"
                aria-invalid={errorFor("applicationId").length > 0}
                onInput={(event) => update("applicationId", event.currentTarget.value)}
              />
              <Show when={errorFor("applicationId").length > 0}>
                <p class="field-error">{errorFor("applicationId").join(" ")}</p>
              </Show>
            </div>
            <div class="field">
              <label for="namespace">Namespace</label>
              <input
                id="namespace"
                name="namespace"
                value={form().namespace}
                required
                spellcheck={false}
                autocomplete="off"
                aria-invalid={errorFor("namespace").length > 0}
                onInput={(event) => update("namespace", event.currentTarget.value)}
              />
              <Show when={errorFor("namespace").length > 0}>
                <p class="field-error">{errorFor("namespace").join(" ")}</p>
              </Show>
            </div>
          </div>
          <div class="field">
            <label for="packageName">Kotlin package <span class="optional">optional</span></label>
            <input
              id="packageName"
              name="packageName"
              value={form().packageName}
              placeholder="Defaults to the namespace"
              spellcheck={false}
              autocomplete="off"
              aria-invalid={errorFor("packageName").length > 0}
              onInput={(event) => update("packageName", event.currentTarget.value)}
            />
            <Show when={errorFor("packageName").length > 0}>
              <p class="field-error">{errorFor("packageName").join(" ")}</p>
            </Show>
          </div>
        </section>

        <section aria-labelledby="section-sdk">
          <h2 id="section-sdk">
            <span class="step">02</span> Android SDK
          </h2>
          <div class="field-grid three">
            <div class="field">
              <label for="minSdk">minSdk</label>
              <select
                id="minSdk"
                value={String(form().minSdk)}
                onChange={(event) => update("minSdk", Number(event.currentTarget.value))}
              >
                <For each={SDK_MIN}>{(value) => <option value={String(value)}>{value}</option>}</For>
              </select>
            </div>
            <div class="field">
              <label for="targetSdk">targetSdk</label>
              <select
                id="targetSdk"
                value={String(form().targetSdk)}
                onChange={(event) => update("targetSdk", Number(event.currentTarget.value))}
              >
                <For each={SDK_MIN}>{(value) => <option value={String(value)}>{value}</option>}</For>
              </select>
            </div>
            <div class="field">
              <label for="compileSdk">compileSdk</label>
              <select
                id="compileSdk"
                value={String(form().compileSdk)}
                onChange={(event) => update("compileSdk", Number(event.currentTarget.value))}
              >
                <For each={SDK_COMPILE}>{(value) => <option value={String(value)}>{value}</option>}</For>
              </select>
            </div>
          </div>
          <Show when={errorFor("targetSdk").length > 0 || errorFor("minSdk").length > 0 || errorFor("compileSdk").length > 0}>
            <p class="field-error">{[...errorFor("minSdk"), ...errorFor("targetSdk"), ...errorFor("compileSdk")].join(" ")}</p>
          </Show>
        </section>

        <section aria-labelledby="section-theme">
          <h2 id="section-theme">
            <span class="step">03</span> Theme
          </h2>
          <fieldset class="field">
            <legend>Seed color</legend>
            <div class="preset-row">
              <For each={PRESETS}>
                {(preset) => (
                  <label class="preset" classList={{ selected: form().seedColor.toLowerCase() === preset.value.toLowerCase() }}>
                    <input
                      type="radio"
                      name="seedPreset"
                      value={preset.value}
                      checked={form().seedColor.toLowerCase() === preset.value.toLowerCase()}
                      onChange={() => update("seedColor", preset.value)}
                    />
                    <span class="preset-chip" style={{ "background-color": preset.value }} aria-hidden="true" />
                    <span>{preset.name}</span>
                  </label>
                )}
              </For>
              <label class="preset custom">
                <span class="preset-chip" style={{ "background-color": form().seedColor }} aria-hidden="true" />
                <span>Custom</span>
                <input
                  type="color"
                  name="seedColor"
                  value={form().seedColor}
                  aria-label="Custom seed color"
                  onInput={(event) => update("seedColor", event.currentTarget.value)}
                />
              </label>
            </div>
          </fieldset>

          <div class="field-grid">
            <div class="field">
              <label for="fontFamily">Typography</label>
              <select
                id="fontFamily"
                value={form().fontFamily}
                onChange={(event) =>
                  update("fontFamily", event.currentTarget.value as FormState["fontFamily"])
                }
              >
                <For each={FONTS}>{(font) => <option value={font.value}>{font.label}</option>}</For>
              </select>
            </div>
            <div class="field">
              <label for="cornerRadius">Corner radius: {form().cornerRadius} dp</label>
              <input
                id="cornerRadius"
                type="range"
                min="0"
                max="32"
                step="1"
                value={String(form().cornerRadius)}
                onInput={(event) => update("cornerRadius", Number(event.currentTarget.value))}
              />
            </div>
          </div>

          <div class="field">
            <span class="label">Default app mode</span>
            <div class="segmented" role="group" aria-label="Default app mode">
              <For each={[{ value: "system", label: "Follow system" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }] as const}>
                {(option) => (
                  <label classList={{ selected: form().defaultMode === option.value }}>
                    <input
                      type="radio"
                      name="defaultMode"
                      value={option.value}
                      checked={form().defaultMode === option.value}
                      onChange={() => update("defaultMode", option.value)}
                    />
                    {option.label}
                  </label>
                )}
              </For>
            </div>
          </div>
        </section>

        <section aria-labelledby="section-addons">
          <h2 id="section-addons">
            <span class="step">04</span> Addons
          </h2>
          <p class="section-help">
            F0 ships a declarative catalog. Only <strong>stable</strong> and <strong>beta</strong> addons with
            file operations can be generated; planned entries are visible but disabled.
          </p>
          <Show when={generatedAddons().length === 0}>
            <p class="notice">
              No addon is generatable in F0. The catalog is a contract for later patches; the generated project
              is the minimal Android template.
            </p>
          </Show>
          <For each={["storage", "ui", "native", "tooling", "foundation"]}>
            {(category) => (
              <fieldset class="addon-group">
                <legend>{CATEGORY_LABELS[category]}</legend>
                <For each={props.catalog.addons.filter((addon) => addon.category === category)}>
                  {(addon) => (
                    <label class="addon" classList={{ disabled: !addon.generatable }}>
                      <input
                        type="checkbox"
                        value={addon.id}
                        disabled={!addon.generatable}
                        checked={selectedAddons().includes(addon.id)}
                        onChange={(event) => toggleAddon(addon.id, event.currentTarget.checked)}
                      />
                      <span class="addon-body">
                        <span class="addon-title">
                          {addon.displayName}
                          <span class={`badge badge-${addon.status}`}>{addon.status}</span>
                        </span>
                        <span class="addon-description">{addon.description}</span>
                      </span>
                    </label>
                  )}
                </For>
              </fieldset>
            )}
          </For>
          <Show when={errorFor("addons").length > 0}>
            <p class="field-error">{errorFor("addons").join(" ")}</p>
          </Show>
        </section>

        <div class="actions">
          <button type="submit" class="button primary" disabled={busy() !== null}>
            {busy() === "generate" ? "Generating…" : "Generate project ZIP"}
          </button>
          <button type="button" class="button secondary" disabled={busy() !== null} onClick={() => void checkPlan()}>
            {busy() === "plan" ? "Planning…" : "Inspect plan"}
          </button>
        </div>

        <div class="status" aria-live="polite" role="status">
          {status()}
        </div>

        <Show when={plan()}>
          {(summary) => (
            <div class="plan">
              <h3>GenerationPlan preview</h3>
              <dl>
                <div><dt>Files</dt><dd>{summary().files}</dd></div>
                <div><dt>Uncompressed</dt><dd>{formatBytes(summary().bytes)}</dd></div>
                <div><dt>Addons</dt><dd>{summary().addons.length === 0 ? "none" : summary().addons.join(", ")}</dd></div>
              </dl>
              <Show when={summary().warnings.length > 0}>
                <ul class="warnings">
                  <For each={summary().warnings}>{(warning) => <li>{warning}</li>}</For>
                </ul>
              </Show>
              <p class="plan-note">
                The ZIP is verified against this plan before download: same paths, same bytes, normalized
                permissions.
              </p>
            </div>
          )}
        </Show>
      </form>

      <aside class="panel preview-panel" aria-labelledby="preview-title">
        <div class="preview-header">
          <h2 id="preview-title">Preview</h2>
          <Show when={availableScreens().length > 1}>
            <div class="segmented small" role="group" aria-label="Preview screen">
              <For each={availableScreens()}>
                {(screen) => (
                  <label classList={{ selected: activePreviewScreen() === screen }}>
                    <input
                      type="radio"
                      name="previewScreen"
                      value={screen}
                      checked={activePreviewScreen() === screen}
                      onChange={() => setPreviewScreen(screen)}
                    />
                    {screen}
                  </label>
                )}
              </For>
            </div>
          </Show>
          <div class="segmented small" role="group" aria-label="Preview mode">
            <For each={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] as const}>
              {(option) => (
                <label classList={{ selected: previewMode() === option.value }}>
                  <input
                    type="radio"
                    name="previewMode"
                    value={option.value}
                    checked={previewMode() === option.value}
                    onChange={() => setPreviewMode(option.value)}
                  />
                  {option.label}
                </label>
              )}
            </For>
          </div>
        </div>
        <PreviewScreen
          tokens={tokens()}
          mode={previewMode()}
          screen={activePreviewScreen()}
          projectName={form().projectName || "Android App"}
          caption="Web simulation of the generated Compose screen using the same Material 3 tokens. It is not a Compose runtime."
        />
        <dl class="summary">
          <div><dt>Application ID</dt><dd><code>{form().applicationId}</code></dd></div>
          <div><dt>Namespace</dt><dd><code>{form().namespace}</code></dd></div>
          <div><dt>Kotlin package</dt><dd><code>{form().packageName.trim() || form().namespace}</code></dd></div>
          <div><dt>SDK</dt><dd>{form().minSdk} / {form().targetSdk} / {form().compileSdk}</dd></div>
          <div><dt>Seed</dt><dd><code>{form().seedColor.toUpperCase()}</code></dd></div>
        </dl>
        <p class="preview-note">
          The generated project is independent: it uses its own Gradle wrapper, version catalog and tool
          matrix. Nothing calls back to this server.
        </p>
      </aside>
    </div>
  );
}
