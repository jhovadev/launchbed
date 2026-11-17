import type { JSX } from "solid-js";
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { resolveThemeTokens, type ThemeTokens } from "@launchbed/design-tokens";
import type { ThemeConfig } from "@launchbed/schema";
import { PAvatar, PBadge, PButton, PCard, PListItem, PSwitch, PTextField, TokenSurface } from "@launchbed/preview";
import ArrowLeft from "lucide-solid/icons/arrow-left";
import Check from "lucide-solid/icons/check";
import Copy from "lucide-solid/icons/copy";
import Mail from "lucide-solid/icons/mail";
import Minus from "lucide-solid/icons/minus";
import Moon from "lucide-solid/icons/moon";
import Search from "lucide-solid/icons/search";
import Sun from "lucide-solid/icons/sun";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

export interface CatalogProp {
  name: string;
  type: string;
  required?: boolean;
  default?: string;
}

export interface CatalogComponent {
  name: string;
  displayName: string;
  description: string;
  variants: string[];
  sizes: string[];
  states: string[];
  tokens: string[];
  props: CatalogProp[];
  a11y: string;
  targets: Record<string, { status: "supported" | "unsupported"; reason?: string; destination?: string }>;
  sources: { target: string; path: string; destination: string; content: string }[];
}

interface Props {
  components: CatalogComponent[];
}

const TARGETS = [
  { id: "android-compose", label: "Compose", language: "Kotlin" },
  { id: "expo", label: "Expo", language: "TSX" },
  { id: "flutter", label: "Flutter", language: "Dart" },
] as const;
type CatalogTarget = (typeof TARGETS)[number]["id"];

const PALETTES = [
  { name: "Violet", value: "#6750A4" },
  { name: "Forest", value: "#006C4C" },
  { name: "Ocean", value: "#2C5D8F" },
  { name: "Ember", value: "#8C4A2F" },
];

function theme(seedColor: string): ThemeConfig {
  return {
    seedColor,
    schemeVariant: "tonalSpot",
    defaultMode: "system",
    overrides: { light: {}, dark: {} },
    typography: { fontFamily: "default" },
    shape: { cornerRadius: 12 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    components: { card: { cornerRadius: 16, elevation: 1 }, button: { cornerRadius: 20, minHeight: 40 } },
  };
}

/** Token-driven web approximation of each registry component. */
function Demo(props: { name: string }): JSX.Element {
  switch (props.name) {
    case "button":
      return <div class="flex flex-wrap items-center gap-3"><PButton label="Filled" /><PButton label="Outlined" variant="outlined" /><PButton label="Text" variant="text" /><PButton label="Disabled" disabled /></div>;
    case "text-field":
      return <div class="grid w-full max-w-sm gap-3"><PTextField label="Email" value="ada@example.com" leading={<Mail size={16} aria-hidden="true" />} focused /><PTextField label="Password" value="short" error supporting="At least 8 characters" /></div>;
    case "card":
      return <div class="grid w-full max-w-sm gap-3 sm:grid-cols-2"><PCard variant="elevated"><span class="aip-title-sm">Elevated</span><span class="aip-body-muted">Surface with shadow</span></PCard><PCard variant="filled"><span class="aip-title-sm">Filled</span><span class="aip-body-muted">Surface variant</span></PCard></div>;
    case "list-item":
      return <div class="w-full max-w-sm"><PCard variant="outlined" class="aip-card-list"><PListItem headline="Ada Lovelace" supporting="ada@example.com" leading={<PAvatar initials="AL" size="md" />} divider /><PListItem headline="Notifications" supporting="Daily summary" trailing={<PSwitch checked label="Notifications" />} /></PCard></div>;
    case "badge":
      return <div class="flex flex-wrap items-center gap-2"><PBadge label="Neutral" tone="neutral" /><PBadge label="Accent" tone="primary" /><PBadge label="Secondary" tone="secondary" /><PBadge label="3 new" tone="error" /></div>;
    case "switch":
      return <div class="flex items-center gap-4"><PSwitch checked label="On" /><PSwitch checked={false} label="Off" /></div>;
    case "avatar":
      return <div class="flex items-center gap-3"><PAvatar initials="AL" size="sm" /><PAvatar initials="AL" size="md" /><PAvatar initials="AL" size="lg" /></div>;
    case "app-bar":
      return <div class="w-full max-w-sm overflow-hidden rounded-xl border"><div class="aip-topbar"><span class="aip-icon-btn" aria-hidden="true"><ArrowLeft size={20} /></span><span class="aip-topbar-title">Details</span><span class="aip-icon-btn" aria-hidden="true"><Search size={18} /></span></div></div>;
    case "snackbar":
      return <div class="aip-snackbar"><span>Note deleted</span><span class="aip-snackbar-action">Undo</span></div>;
    case "dialog":
      return <div class="aip-dialog"><span class="aip-title">Delete note?</span><span class="aip-body-muted">This removes the note from this device.</span><span class="flex justify-end gap-2"><PButton label="Cancel" variant="text" /><PButton label="Delete" variant="text" /></span></div>;
    default:
      return <span class="aip-body-muted">No preview yet.</span>;
  }
}

export default function ComponentCatalog(props: Props) {
  const [target, setTarget] = createSignal<CatalogTarget>("android-compose");
  const [mode, setMode] = createSignal<"light" | "dark">("light");
  const [seed, setSeed] = createSignal("#6750A4");
  const [copied, setCopied] = createSignal("");
  const tokens = createMemo<ThemeTokens>(() => resolveThemeTokens(theme(seed())));
  const [modeTouched, setModeTouched] = createSignal(false);
  onMount(() => {
    const root = document.documentElement;
    const sync = () => { if (!modeTouched()) setMode(root.classList.contains("dark") ? "dark" : "light"); };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    onCleanup(() => observer.disconnect());
  });

  async function copy(text: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be blocked; the code stays selectable.
    }
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1800);
  }

  return (
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-[200px_minmax(0,1fr)]" data-launchbed-components="v1">
      <nav class="hidden lg:block" aria-label="Components">
        <div class="sticky top-20 flex flex-col gap-1 text-sm">
          <p class="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Components</p>
          <a href="#support-matrix" class="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">Support matrix</a>
          <For each={props.components}>{(component) => (
            <a href={`#${component.name}`} class="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">{component.displayName}</a>
          )}</For>
        </div>
      </nav>

      <div class="flex min-w-0 flex-col gap-8">
        {/* Toolbar */}
        <div class="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div class="flex min-w-0 flex-col gap-1.5">
            <span id="target-label" class="text-xs font-medium text-muted-foreground">Platform</span>
            <div class="inline-flex w-fit rounded-md bg-muted p-1" role="radiogroup" aria-labelledby="target-label">
              <For each={TARGETS}>{(item) => (
                <button type="button" role="radio" aria-checked={target() === item.id} onClick={() => setTarget(item.id)}
                  class={cn("rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    target() === item.id && "bg-background text-foreground shadow-sm")}>{item.label}</button>
              )}</For>
            </div>
          </div>
          <div class="flex flex-wrap items-end gap-3">
            <div class="flex flex-col gap-1.5">
              <span id="seed-label" class="text-xs font-medium text-muted-foreground">Seed color</span>
              <div class="flex items-center gap-1.5" role="radiogroup" aria-labelledby="seed-label">
                <For each={PALETTES}>{(palette) => (
                  <button type="button" role="radio" aria-checked={seed() === palette.value} aria-label={palette.name} title={palette.name} onClick={() => setSeed(palette.value)}
                    class={cn("size-7 rounded-full border-2 border-background shadow-xs ring-1 ring-border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      seed() === palette.value && "ring-2 ring-foreground")} style={{ "background-color": palette.value }} />
                )}</For>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <span id="mode-label" class="text-xs font-medium text-muted-foreground">Preview</span>
              <div class="inline-flex rounded-md bg-muted p-1" role="radiogroup" aria-labelledby="mode-label">
                <For each={[{ value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }] as const}>{(option) => (
                  <button type="button" role="radio" aria-checked={mode() === option.value} onClick={() => { setModeTouched(true); setMode(option.value); }}
                    class={cn("inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      mode() === option.value && "bg-background text-foreground shadow-sm")}><option.icon class="size-3.5" aria-hidden="true" />{option.label}</button>
                )}</For>
              </div>
            </div>
          </div>
        </div>

        {/* Support matrix */}
        <section id="support-matrix" class="scroll-mt-20" aria-labelledby="matrix-title">
          <h2 id="matrix-title" class="mb-3 text-lg font-semibold tracking-tight">Support matrix</h2>
          <div class="relative overflow-x-auto rounded-xl border">
            <table class="w-full min-w-[480px] text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" class="px-4 py-2.5 font-medium">Component</th>
                  <For each={TARGETS}>{(item) => <th scope="col" class={cn("px-4 py-2.5 text-center font-medium", target() === item.id && "text-foreground")}>{item.label}</th>}</For>
                </tr>
              </thead>
              <tbody>
                <For each={props.components}>{(component) => (
                  <tr class="border-t">
                    <th scope="row" class="px-4 py-2.5 text-left font-medium"><a href={`#${component.name}`} class="hover:underline">{component.displayName}</a></th>
                    <For each={TARGETS}>{(item) => {
                      const supported = component.targets[item.id]?.status === "supported";
                      return (
                        <td class={cn("px-4 py-2.5 text-center", target() === item.id && "bg-muted/30")}>
                          <Show when={supported} fallback={<span class="inline-flex items-center gap-1 text-muted-foreground" title={component.targets[item.id]?.reason}><Minus class="size-4" aria-hidden="true" /><span class="sr-only">Not supported</span></span>}>
                            <span class="inline-grid size-5 place-items-center rounded-full bg-success text-success-foreground"><Check class="size-3" stroke-width={3} aria-hidden="true" /><span class="sr-only">Supported</span></span>
                          </Show>
                        </td>
                      );
                    }}</For>
                  </tr>
                )}</For>
              </tbody>
            </table>
          </div>
        </section>

        <For each={props.components}>{(component) => {
          const source = () => component.sources.find((file) => file.target === target());
          const addCommand = `launchbed add ${component.name}`;
          return (
            <section id={component.name} class="scroll-mt-20 rounded-xl border bg-card shadow-xs" aria-labelledby={`${component.name}-title`}>
              <header class="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div class="flex min-w-0 flex-col gap-1.5">
                  <h2 id={`${component.name}-title`} class="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
                    {component.displayName}<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground">{component.name}</code>
                  </h2>
                  <p class="text-sm text-muted-foreground">{component.description}</p>
                </div>
                <div class="flex shrink-0 flex-wrap gap-1">
                  <For each={TARGETS}>{(item) => (
                    <Badge variant={component.targets[item.id]?.status === "supported" ? "secondary" : "muted"}>
                      <Show when={component.targets[item.id]?.status === "supported"}><Check class="size-3" aria-hidden="true" /></Show>{item.label}
                    </Badge>
                  )}</For>
                </div>
              </header>

              <div class="grid min-w-0 gap-0 xl:grid-cols-2">
                <div class="flex min-w-0 flex-col gap-4 border-b p-4 sm:p-6 xl:border-b-0 xl:border-r">
                  <TokenSurface tokens={tokens()} mode={mode()} class="flex min-h-36 items-center justify-center rounded-lg border p-6">
                    <Demo name={component.name} />
                  </TokenSurface>
                  <p class="text-xs text-muted-foreground">Web approximation rendered with the same DTCG tokens. The copied source uses each platform’s native widgets.</p>
                  <dl class="grid gap-3 text-sm sm:grid-cols-3">
                    <div><dt class="text-xs text-muted-foreground">Variants</dt><dd class="mt-1 flex flex-wrap gap-1"><For each={component.variants}>{(value) => <Badge variant="outline">{value}</Badge>}</For></dd></div>
                    <div><dt class="text-xs text-muted-foreground">Sizes</dt><dd class="mt-1 flex flex-wrap gap-1"><For each={component.sizes}>{(value) => <Badge variant="outline">{value}</Badge>}</For></dd></div>
                    <div><dt class="text-xs text-muted-foreground">States</dt><dd class="mt-1 flex flex-wrap gap-1"><For each={component.states}>{(value) => <Badge variant="outline">{value}</Badge>}</For></dd></div>
                  </dl>
                  <div class="relative overflow-x-auto rounded-lg border">
                    <table class="w-full min-w-[360px] text-left text-xs">
                      <caption class="sr-only">{component.displayName} props</caption>
                      <thead class="bg-muted/50 text-muted-foreground"><tr><th scope="col" class="px-3 py-2 font-medium">Prop</th><th scope="col" class="px-3 py-2 font-medium">Type</th><th scope="col" class="px-3 py-2 font-medium">Default</th></tr></thead>
                      <tbody>
                        <For each={component.props}>{(prop) => (
                          <tr class="border-t">
                            <td class="px-3 py-2 font-mono">{prop.name}<Show when={prop.required}><span class="text-destructive" aria-label="required">*</span></Show></td>
                            <td class="px-3 py-2 font-mono text-muted-foreground">{prop.type}</td>
                            <td class="px-3 py-2 font-mono text-muted-foreground">{prop.default ?? "—"}</td>
                          </tr>
                        )}</For>
                      </tbody>
                    </table>
                  </div>
                  <p class="text-xs text-muted-foreground"><span class="font-medium text-foreground">Accessibility.</span> {component.a11y}</p>
                </div>

                <div class="flex min-w-0 flex-col gap-3 p-4 sm:p-6">
                  {/* WAI-ARIA tabs, shadcn styling. Kobalte Tabs mismatched SSR hydration inside Astro islands. */}
                  <div class="min-w-0">
                    <div role="tablist" aria-label={`${component.displayName} source by platform`}
                      class="inline-flex h-10 w-full items-center justify-start rounded-md bg-muted p-1 text-muted-foreground sm:w-auto"
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                        event.preventDefault();
                        const index = TARGETS.findIndex((item) => item.id === target());
                        const next = TARGETS[(index + (event.key === "ArrowRight" ? 1 : TARGETS.length - 1)) % TARGETS.length]!;
                        setTarget(next.id);
                        document.getElementById(`${component.name}-tab-${next.id}`)?.focus();
                      }}>
                      <For each={TARGETS}>{(item) => (
                        <button type="button" role="tab" id={`${component.name}-tab-${item.id}`} aria-selected={target() === item.id}
                          aria-controls={`${component.name}-panel`} tabindex={target() === item.id ? 0 : -1} onClick={() => setTarget(item.id)}
                          class={cn("inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
                            target() === item.id && "bg-background text-foreground shadow-sm")}>{item.label}</button>
                      )}</For>
                    </div>
                    <div role="tabpanel" id={`${component.name}-panel`} aria-labelledby={`${component.name}-tab-${target()}`} class="mt-3 min-w-0">
                      <Show when={source()} fallback={
                        <p class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{component.targets[target()]?.reason ?? "Not available for this platform yet."}</p>
                      }>{(file) => {
                        const language = () => TARGETS.find((item) => item.id === target())?.language ?? "";
                        return (
                          <div class="overflow-hidden rounded-lg border bg-zinc-950 text-zinc-100">
                            <div class="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                              <span class="min-w-0 truncate font-mono text-[11px] text-zinc-400" title={file().destination}>{file().destination}</span>
                              <button type="button" onClick={() => void copy(file().content, `${component.name}-src`)}
                                class="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                                aria-label={`Copy ${language()} source`}>
                                <Show when={copied() === `${component.name}-src`} fallback={<Copy class="size-3.5" aria-hidden="true" />}><Check class="size-3.5" aria-hidden="true" /></Show>
                                {language()}
                              </button>
                            </div>
                            <pre class="code-scroll max-h-80 px-4 py-3 text-[12px] leading-relaxed" tabindex="0" aria-label={`${component.displayName} ${language()} source`}>{file().content}</pre>
                          </div>
                        );
                      }}</Show>
                    </div>
                  </div>
                  <div class="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                    <code class="min-w-0 truncate font-mono text-xs">{addCommand}</code>
                    <button type="button" onClick={() => void copy(addCommand, `${component.name}-add`)}
                      class="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Copy ${addCommand}`}>
                      <Show when={copied() === `${component.name}-add`} fallback={<Copy class="size-3.5" aria-hidden="true" />}><Check class="size-3.5" aria-hidden="true" /></Show>
                    </button>
                  </div>
                  <Show when={source()}>{(file) => <p class="text-xs text-muted-foreground [overflow-wrap:anywhere]">Copied to <code class="font-mono">{file().destination}</code>. Idempotent; pass <code class="font-mono">--force</code> to overwrite your edits.</p>}</Show>
                </div>
              </div>
            </section>
          );
        }}</For>
      </div>
    </div>
  );
}
