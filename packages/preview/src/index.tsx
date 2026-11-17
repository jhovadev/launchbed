import type { JSX } from "solid-js";
import { For, Show, children } from "solid-js";
import type { ThemeTokens } from "@launchbed/design-tokens";
import { previewTabs, type PreviewScreenId, type PreviewTab, type PreviewTabIcon, type PreviewTarget } from "./tabs";
import House from "lucide-solid/icons/house";
import SettingsIcon from "lucide-solid/icons/settings";
import ShoppingCart from "lucide-solid/icons/shopping-cart";
import User from "lucide-solid/icons/user";
import ArrowLeft from "lucide-solid/icons/arrow-left";
import BatteryFull from "lucide-solid/icons/battery-full";
import Bell from "lucide-solid/icons/bell";
import Calendar from "lucide-solid/icons/calendar";
import ChevronRight from "lucide-solid/icons/chevron-right";
import CircleCheck from "lucide-solid/icons/circle-check";
import Info from "lucide-solid/icons/info";
import Layers from "lucide-solid/icons/layers";
import LogOut from "lucide-solid/icons/log-out";
import Mail from "lucide-solid/icons/mail";
import Moon from "lucide-solid/icons/moon";
import Package from "lucide-solid/icons/package";
import Wrench from "lucide-solid/icons/wrench";
import Pencil from "lucide-solid/icons/pencil";
import Plus from "lucide-solid/icons/plus";
import Search from "lucide-solid/icons/search";
import ShieldCheck from "lucide-solid/icons/shield-check";
import Signal from "lucide-solid/icons/signal";
import Sparkles from "lucide-solid/icons/sparkles";
import Star from "lucide-solid/icons/star";
import Trash from "lucide-solid/icons/trash";
import Wifi from "lucide-solid/icons/wifi";

export type { PreviewScreenId, PreviewTarget };

export const PREVIEW_SCREEN_LABELS: Record<PreviewScreenId, string> = {
  welcome: "Home",
  dashboard: "Dashboard",
  settings: "Settings",
  notes: "Notes",
  catalog: "Catalog",
  onboarding: "Onboarding",
  login: "Sign in",
  register: "Register",
  profile: "Profile",
};

export { previewTabs, type PreviewTab, type PreviewTabIcon };

function TabIcon(props: { icon: PreviewTabIcon }) {
  return (
    <>
      {props.icon === "home" ? <House size={18} />
        : props.icon === "notes" ? <Pencil size={18} />
        : props.icon === "catalog" ? <ShoppingCart size={18} />
        : props.icon === "profile" ? <User size={18} />
        : <SettingsIcon size={18} />}
    </>
  );
}

function BottomBar(props: { tabs: readonly PreviewTab[]; current: PreviewScreenId }) {
  return (
    <div class="aip-navbar" aria-hidden="true">
      <For each={props.tabs}>{(tab) => (
        <span class="aip-navbar-item" classList={{ "aip-navbar-active": tab.screen === props.current }}>
          <span class="aip-navbar-indicator"><TabIcon icon={tab.icon} /></span>
          <span class="aip-navbar-label">{tab.label}</span>
        </span>
      )}</For>
    </div>
  );
}

export interface PreviewScreenProps {
  tokens: ThemeTokens;
  mode: "light" | "dark";
  projectName: string;
  screen?: PreviewScreenId;
  target?: PreviewTarget;
  /** ui/navigation replaces the minimal HomeScreen with a Welcome destination. */
  hasNavigation?: boolean;
  /** Optional caption rendered under the device frame. */
  caption?: string;
  /** Bottom navigation of the generated app (see previewTabs). Shown with 2+ tabs on a tab screen. */
  tabs?: readonly PreviewTab[];
}

/** CSS custom properties that drive every preview element from the DTCG/Material 3 tokens. */
export function tokenStyle(tokens: ThemeTokens, mode: "light" | "dark"): JSX.CSSProperties {
  const c = mode === "dark" ? tokens.dark : tokens.light;
  const font =
    tokens.typography.fontFamily === "serif"
      ? 'ui-serif, Georgia, "Noto Serif", serif'
      : tokens.typography.fontFamily === "monospace"
        ? 'ui-monospace, "Roboto Mono", "JetBrains Mono", monospace'
        : 'Roboto, "Google Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  return {
    "--m-primary": c.primary,
    "--m-on-primary": c.onPrimary,
    "--m-primary-container": c.primaryContainer,
    "--m-on-primary-container": c.onPrimaryContainer,
    "--m-secondary": c.secondary,
    "--m-secondary-container": c.secondaryContainer,
    "--m-on-secondary-container": c.onSecondaryContainer,
    "--m-tertiary": c.tertiary,
    "--m-tertiary-container": c.tertiaryContainer,
    "--m-on-tertiary-container": c.onTertiaryContainer,
    "--m-error": c.error,
    "--m-error-container": c.errorContainer,
    "--m-on-error-container": c.onErrorContainer,
    "--m-background": c.background,
    "--m-on-background": c.onBackground,
    "--m-surface": c.surface,
    "--m-on-surface": c.onSurface,
    "--m-surface-variant": c.surfaceVariant,
    "--m-on-surface-variant": c.onSurfaceVariant,
    "--m-outline": c.outline,
    "--m-outline-variant": c.outlineVariant,
    "--m-radius": `${tokens.shape.cornerRadius}px`,
    "--m-card-radius": `${tokens.components.card.cornerRadius}px`,
    "--m-button-radius": `${tokens.components.button.cornerRadius}px`,
    "--m-button-height": `${Math.min(tokens.components.button.minHeight, 56)}px`,
    "--m-sp-xs": `${tokens.spacing.xs}px`,
    "--m-sp-sm": `${tokens.spacing.sm}px`,
    "--m-sp-md": `${tokens.spacing.md}px`,
    "--m-sp-lg": `${tokens.spacing.lg}px`,
    "--m-font": font,
  } as JSX.CSSProperties;
}

/* ------------------------------------------------------------------ */
/* Registry visual language: the same primitives back the catalog.    */
/* ------------------------------------------------------------------ */

export function PButton(props: { label: string; variant?: "filled" | "tonal" | "outlined" | "text" | "error"; icon?: JSX.Element; block?: boolean; disabled?: boolean }) {
  return (
    <span class={`aip-btn aip-btn-${props.variant ?? "filled"}`} classList={{ "aip-btn-block": props.block, "aip-btn-disabled": props.disabled }}>
      {props.icon}
      <span>{props.label}</span>
    </span>
  );
}

export function PTextField(props: { label: string; value?: string; placeholder?: string; leading?: JSX.Element; trailing?: JSX.Element; supporting?: string; error?: boolean; focused?: boolean }) {
  return (
    <span class="aip-field" classList={{ "aip-field-error": props.error, "aip-field-focused": props.focused }}>
      <span class="aip-field-box">
        {props.leading}
        <span class="aip-field-text">
          <span class="aip-field-label">{props.label}</span>
          <span class="aip-field-value" classList={{ "aip-field-placeholder": !props.value }}>{props.value || props.placeholder || ""}</span>
        </span>
        {props.trailing}
      </span>
      <Show when={props.supporting}><span class="aip-field-support">{props.supporting}</span></Show>
    </span>
  );
}

export function PCard(props: { children: JSX.Element; variant?: "elevated" | "filled" | "outlined"; class?: string }) {
  return <span class={`aip-card aip-card-${props.variant ?? "outlined"} ${props.class ?? ""}`}>{props.children}</span>;
}

export function PListItem(props: { headline: string; supporting?: string; leading?: JSX.Element; trailing?: JSX.Element; divider?: boolean }) {
  // Resolve slot JSX exactly once: reading a JSX prop twice (condition + body) creates two
  // instances and breaks SSR hydration keys.
  const leading = children(() => props.leading);
  const trailing = children(() => props.trailing);
  return (
    <span class="aip-li" classList={{ "aip-li-divider": props.divider }}>
      <Show when={leading()}><span class="aip-li-leading">{leading()}</span></Show>
      <span class="aip-li-text">
        <span class="aip-li-headline">{props.headline}</span>
        <Show when={props.supporting}><span class="aip-li-supporting">{props.supporting}</span></Show>
      </span>
      <Show when={trailing()}><span class="aip-li-trailing">{trailing()}</span></Show>
    </span>
  );
}

export function PBadge(props: { label: string; tone?: "primary" | "secondary" | "tertiary" | "error" | "neutral" }) {
  return <span class={`aip-badge aip-badge-${props.tone ?? "secondary"}`}>{props.label}</span>;
}

export function PSwitch(props: { checked: boolean; label?: string }) {
  return (
    <span class="aip-switch" classList={{ "aip-switch-on": props.checked }} role="img" aria-label={`${props.label ?? "Switch"}: ${props.checked ? "on" : "off"}`}>
      <span class="aip-switch-thumb">
        <Show when={props.checked}><CircleCheck size={12} stroke-width={3} aria-hidden="true" /></Show>
      </span>
    </span>
  );
}

export function PAvatar(props: { initials: string; size?: "sm" | "md" | "lg" }) {
  return <span class={`aip-avatar aip-avatar-${props.size ?? "md"}`} aria-hidden="true">{props.initials}</span>;
}

/** Wraps registry primitives in the token CSS variables (used by the component catalog). */
export function TokenSurface(props: { tokens: ThemeTokens; mode: "light" | "dark"; children: JSX.Element; class?: string }) {
  return <div class={`aip-surface ${props.class ?? ""}`} style={tokenStyle(props.tokens, props.mode)}>{props.children}</div>;
}

/* ------------------------------------------------------------------ */
/* Screens                                                            */
/* ------------------------------------------------------------------ */

function TopBar(props: { title: string; back?: boolean; actions?: JSX.Element; large?: boolean }) {
  return (
    <div class="aip-topbar" classList={{ "aip-topbar-large": props.large }}>
      <Show when={props.back}><span class="aip-icon-btn" aria-hidden="true"><ArrowLeft size={20} /></span></Show>
      <span class="aip-topbar-title">{props.title}</span>
      <span class="aip-topbar-actions">{props.actions}</span>
    </div>
  );
}

function SampleChip() {
  return <span class="aip-sample" title="Placeholder values shipped with the starter">Sample data</span>;
}

function HomeScreen(props: { projectName: string }) {
  return (
    <>
      <TopBar title={props.projectName} />
      <div class="aip-content aip-center">
        <span class="aip-hero-icon" aria-hidden="true"><Sparkles size={28} /></span>
        <h4 class="aip-display">{props.projectName}</h4>
        <p class="aip-body-muted aip-text-center">A native Android app built with Kotlin and Jetpack Compose.</p>
        <PCard variant="filled" class="aip-w-full">
          <span class="aip-title-sm">Your starting point</span>
          <span class="aip-body-muted">Taps: 0</span>
          <span class="aip-body-muted">Ready to build.</span>
        </PCard>
        <PButton label="Tap the button" block />
      </div>
    </>
  );
}

/**
 * Delegated targets (Expo, Flutter) keep the official template's own screens, which this
 * preview does not reproduce. It shows the Launchbed tokens applied to registry components.
 */
function TokensScreen(props: { projectName: string; target: PreviewTarget }) {
  const file = () => (props.target === "flutter" ? "lib/tokens/tokens.dart" : "tokens/tokens.ts");
  return (
    <>
      <TopBar title={props.projectName} />
      <div class="aip-content aip-gap-md">
        <div class="aip-stack-xs">
          <span class="aip-headline">Your design tokens</span>
          <span class="aip-body-muted">Generated into {file()}. Add components with launchbed add.</span>
        </div>
        <PTextField label="Email" placeholder="you@example.com" leading={<Mail size={16} aria-hidden="true" />} />
        <PCard variant="outlined" class="aip-card-list">
          <PListItem headline="Notifications" supporting="ListItem + Switch" trailing={<PSwitch checked label="Notifications" />} divider />
          <PListItem headline="Ada Lovelace" supporting="ListItem + Avatar" leading={<PAvatar initials="AL" size="sm" />} />
        </PCard>
        <div class="aip-row-between"><span class="aip-title-sm">Badges</span><span style={{ display: "inline-flex", gap: "6px" }}><PBadge label="New" tone="primary" /><PBadge label="Beta" tone="secondary" /></span></div>
        <PButton label="Continue" block />
        <PButton label="Not now" variant="outlined" block />
      </div>
    </>
  );
}

const WELCOME_COPY: Record<PreviewTarget, string> = {
  "android-compose": "Navigation is ready. Add screens and register their routes in AppRoot.",
  expo: "Built with Expo and Launchbed design tokens. Add screens under src/app.",
  flutter: "Built with Flutter and Launchbed design tokens. Add screens under lib/launchbed/screens.",
};

function WelcomeScreen(props: { projectName: string; target: PreviewTarget }) {
  return (
    <>
      <TopBar title={props.projectName} />
      <div class="aip-content aip-center">
        <span class="aip-hero-icon" aria-hidden="true"><Sparkles size={28} /></span>
        <h4 class="aip-display">Welcome</h4>
        <p class="aip-body-muted aip-text-center">{WELCOME_COPY[props.target]}</p>
      </div>
    </>
  );
}

const STATS = [
  { label: "Tasks done", value: "8/12", icon: CircleCheck, tone: "primary" },
  { label: "Due today", value: "3", icon: Calendar, tone: "tertiary" },
  { label: "Messages", value: "5", icon: Mail, tone: "secondary" },
  { label: "Streak", value: "4 days", icon: Star, tone: "primary" },
] as const;

const ACTIVITY = [
  { title: "Design review", detail: "Moved to Done", time: "2h", icon: CircleCheck },
  { title: "Weekly sync", detail: "Notes added", time: "5h", icon: Pencil },
  { title: "Release 1.0", detail: "Build ready to test", time: "1d", icon: Wrench },
] as const;

function DashboardScreen() {
  return (
    <>
      <TopBar title="Dashboard" />
      <div class="aip-content">
        <div class="aip-row-between">
          <div class="aip-stack-xs">
            <span class="aip-headline">Overview</span>
            <span class="aip-body-muted">Good to see you</span>
          </div>
          <SampleChip />
        </div>
        <div class="aip-grid-2">
          <For each={STATS}>{(stat) => (
            <PCard variant="filled" class="aip-stat">
              <span class={`aip-stat-icon aip-tone-${stat.tone}`} aria-hidden="true"><stat.icon size={16} /></span>
              <span class="aip-stat-value">{stat.value}</span>
              <span class="aip-label">{stat.label}</span>
            </PCard>
          )}</For>
        </div>
        <span class="aip-title-sm">Recent activity</span>
        <PCard variant="outlined" class="aip-card-list">
          <For each={ACTIVITY}>{(item, index) => (
            <PListItem headline={item.title} supporting={item.detail} divider={index() < ACTIVITY.length - 1}
              leading={<span class="aip-li-icon" aria-hidden="true"><item.icon size={16} /></span>}
              trailing={<span class="aip-label">{item.time}</span>} />
          )}</For>
        </PCard>
      </div>
    </>
  );
}

function SettingsScreen() {
  return (
    <>
      <TopBar title="Settings" />
      <div class="aip-content aip-gap-sm">
        <span class="aip-group-label">Appearance</span>
        <PCard variant="filled" class="aip-card-list">
          <PListItem headline="Dark mode" supporting="Follow the selected appearance preference"
            leading={<span class="aip-li-icon" aria-hidden="true"><Moon size={16} /></span>} trailing={<PSwitch checked={false} label="Dark mode" />} />
        </PCard>
        <span class="aip-group-label">Notifications</span>
        <PCard variant="filled" class="aip-card-list">
          <PListItem headline="Enable notifications" supporting="Preference kept in memory"
            leading={<span class="aip-li-icon" aria-hidden="true"><Bell size={16} /></span>} trailing={<PSwitch checked label="Enable notifications" />} />
        </PCard>
        <span class="aip-group-label">About</span>
        <PCard variant="filled" class="aip-card-list">
          <PListItem headline="Launchbed" supporting="Generated native Android project" divider
            leading={<span class="aip-li-icon" aria-hidden="true"><Info size={16} /></span>} />
          <PListItem headline="Version" supporting="1.0"
            leading={<span class="aip-li-icon" aria-hidden="true"><Layers size={16} /></span>} />
        </PCard>
      </div>
    </>
  );
}

const NOTES = [
  { title: "Grocery list", body: "Milk, eggs, coffee beans", time: "Today" },
  { title: "Ideas for the week", body: "Try the new onboarding copy", time: "Yesterday" },
  { title: "Meeting notes", body: "Ship the beta on Friday", time: "Mon" },
] as const;

function NotesScreen() {
  return (
    <>
      <TopBar title="Notes" />
      <div class="aip-content aip-gap-sm">
        <div class="aip-row-between"><span class="aip-body-muted">Saved on this device with Room</span><SampleChip /></div>
        <For each={NOTES}>{(note) => (
          <PCard variant="outlined" class="aip-note">
            <span class="aip-row-between"><span class="aip-title-sm">{note.title}</span><span class="aip-label">{note.time}</span></span>
            <span class="aip-body-muted">{note.body}</span>
            <span class="aip-note-actions" aria-hidden="true"><Pencil size={14} /><Trash size={14} /></span>
          </PCard>
        )}</For>
      </div>
      <span class="aip-fab" aria-hidden="true"><Plus size={22} /></span>
    </>
  );
}

const CATALOG = [
  { title: "Compose toolkit", category: "UI", icon: Layers },
  { title: "Room storage", category: "Data", icon: Package },
  { title: "Navigation", category: "Architecture", icon: ChevronRight },
] as const;

function CatalogScreen() {
  return (
    <>
      <TopBar title="Catalog" />
      <div class="aip-content aip-gap-sm">
        <PTextField label="Search" placeholder="Search items" leading={<Search size={16} aria-hidden="true" />} />
        <div class="aip-row-between"><span class="aip-title-sm">3 items</span><SampleChip /></div>
        <For each={CATALOG}>{(item) => (
          <PCard variant="elevated" class="aip-card-row">
            <span class="aip-li-icon" aria-hidden="true"><item.icon size={16} /></span>
            <span class="aip-stack-xs aip-grow"><span class="aip-title-sm">{item.title}</span><PBadge label={item.category} tone="secondary" /></span>
            <ChevronRight size={16} aria-hidden="true" class="aip-muted-icon" />
          </PCard>
        )}</For>
      </div>
    </>
  );
}

function OnboardingScreen() {
  return (
    <>
      <TopBar title="Welcome" />
      <div class="aip-content aip-onboarding">
        <span class="aip-illustration" aria-hidden="true"><Sparkles size={40} /></span>
        <div class="aip-stack-sm">
          <span class="aip-headline">Welcome</span>
          <span class="aip-body">A short tour of this generated app.</span>
        </div>
        <span class="aip-dots" aria-hidden="true"><span class="on" /><span /><span /></span>
        <div class="aip-row-between aip-w-full">
          <PButton label="Skip" variant="text" />
          <PButton label="Next" />
        </div>
      </div>
    </>
  );
}

function LoginScreen() {
  return (
    <>
      <TopBar title="Sign in" />
      <div class="aip-content aip-gap-md">
        <div class="aip-stack-xs">
          <span class="aip-headline">Welcome back</span>
          <span class="aip-body-muted">Demo account: demo@example.com</span>
        </div>
        <PTextField label="Email" value="demo@example.com" leading={<Mail size={16} aria-hidden="true" />} focused />
        <PTextField label="Password" value="••••••••••••" leading={<ShieldCheck size={16} aria-hidden="true" />} supporting="In-memory fake. Not a real backend." />
        <PButton label="Sign in" block />
        <PButton label="Create an account" variant="text" block />
      </div>
    </>
  );
}

function RegisterScreen() {
  return (
    <>
      <TopBar title="Create account" back />
      <div class="aip-content aip-gap-md">
        <span class="aip-body-muted">Accounts exist only in memory for this session.</span>
        <PTextField label="Display name" value="Ada Lovelace" />
        <PTextField label="Email" value="ada@example.com" leading={<Mail size={16} aria-hidden="true" />} />
        <PTextField label="Password" value="••••••••" supporting="At least 8 characters" />
        <PButton label="Create account" block />
      </div>
    </>
  );
}

function ProfileScreen() {
  return (
    <>
      <TopBar title="Profile" />
      <div class="aip-content aip-gap-md">
        <div class="aip-profile-head">
          <PAvatar initials="DU" size="lg" />
          <div class="aip-stack-xs">
            <span class="aip-title">Demo user</span>
            <span class="aip-body-muted">demo@example.com</span>
          </div>
        </div>
        <PCard variant="filled" class="aip-card-list">
          <PListItem headline="Demo user" supporting="Display name" divider leading={<span class="aip-li-icon" aria-hidden="true"><Pencil size={16} /></span>} />
          <PListItem headline="demo@example.com" supporting="Email" leading={<span class="aip-li-icon" aria-hidden="true"><Mail size={16} /></span>} />
        </PCard>
        <PButton label="Edit profile" variant="outlined" block icon={<Pencil size={16} aria-hidden="true" />} />
        <PButton label="Sign out" variant="error" block icon={<LogOut size={16} aria-hidden="true" />} />
      </div>
    </>
  );
}

/**
 * Illustrative Material 3 rendering of the generated screens.
 * This is a web simulation, not a Compose/React Native/Flutter runtime: it uses the
 * same resolved tokens and the same copy as the generated sources, but layout and
 * typography are approximations.
 */
export function PreviewScreen(props: PreviewScreenProps) {
  const screen = () => props.screen ?? "welcome";
  const target = () => props.target ?? "android-compose";
  return (
    <figure class="aip-figure">
      <div class="aip-phone" classList={{ "aip-dark": props.mode === "dark" }} style={tokenStyle(props.tokens, props.mode)}
        role="img" aria-label={`Illustrative ${PREVIEW_SCREEN_LABELS[screen()]} screen of ${props.projectName} in ${props.mode} mode`}>
        <div class="aip-screen">
          <div class="aip-status" aria-hidden="true">
            <span>9:41</span>
            <span class="aip-camera" />
            <span class="aip-status-icons"><Signal size={12} /><Wifi size={12} /><BatteryFull size={14} /></span>
          </div>
          <div class="aip-app">
            {screen() === "dashboard" ? <DashboardScreen />
              : screen() === "settings" ? <SettingsScreen />
              : screen() === "notes" ? <NotesScreen />
              : screen() === "catalog" ? <CatalogScreen />
              : screen() === "onboarding" ? <OnboardingScreen />
              : screen() === "login" ? <LoginScreen />
              : screen() === "register" ? <RegisterScreen />
              : screen() === "profile" ? <ProfileScreen />
              : props.hasNavigation ? <WelcomeScreen projectName={props.projectName} target={target()} />
              : target() !== "android-compose" ? <TokensScreen projectName={props.projectName} target={target()} />
              : <HomeScreen projectName={props.projectName} />}
          </div>
          <Show when={(props.tabs?.length ?? 0) >= 2 && props.tabs!.some((tab) => tab.screen === screen())}>
            <BottomBar tabs={props.tabs!} current={screen()} />
          </Show>
          <div class="aip-gesture" aria-hidden="true"><span /></div>
        </div>
      </div>
      <Show when={props.caption}>
        <figcaption class="aip-caption">{props.caption}</figcaption>
      </Show>
    </figure>
  );
}
