/**
 * Screen packs for delegate targets (Expo, Flutter). They port ui/onboarding, ui/auth,
 * ui/profile and ui/dashboard on top of the official templates, using the component
 * registry and the compiled DTCG tokens. Static sources live in templates/fragments/{expo,flutter}
 * and are embedded by scripts/embed-templates.ts; the files that depend on the selected
 * add-ons (route gate, tabs, app shell) are generated here so every combination compiles.
 */
import { LaunchbedError, delegateTabs, type DelegateTab } from "@launchbed/schema";
import { FRAGMENT_FILES } from "./templates.generated";
import { componentSources, loadComponentCatalog } from "./components";
import { renderText } from "./render";
import { EXPO_PINS, FLUTTER_PINS } from "./versions";

export type ScreenPackTarget = "expo" | "flutter";

/** Add-ons that have an Expo and a Flutter port. Other ui/* packs stay Compose-only. */
export const DELEGATE_SCREEN_ADDONS = [
  "ui/navigation",
  "ui/onboarding",
  "ui/auth",
  "ui/profile",
  "ui/dashboard",
  "ui/notes",
  "ui/settings",
] as const;

/** Registry components the screen packs import. They are copied in and listed in launchbed.json. */
export const SCREEN_PACK_COMPONENTS = ["app-bar", "avatar", "badge", "button", "card", "list-item", "text-field"] as const;

/** Registry components only some screens need. */
const FEATURE_COMPONENTS: Partial<Record<keyof ScreenPackFeatures, readonly string[]>> = {
  settings: ["switch"],
};

export function screenPackComponents(features: ScreenPackFeatures): string[] {
  const names = new Set<string>(SCREEN_PACK_COMPONENTS);
  for (const [feature, components] of Object.entries(FEATURE_COMPONENTS)) {
    if (features[feature as keyof ScreenPackFeatures]) for (const name of components) names.add(name);
  }
  return [...names].sort();
}

/** Pinned packages the screen pack installs inside the generated project (exact versions). */
export const SCREEN_PACK_PACKAGES = {
  expo: [{ name: "@react-native-async-storage/async-storage", version: EXPO_PINS.asyncStorage }],
  flutter: [{ name: "shared_preferences", version: FLUTTER_PINS.sharedPreferences }],
} as const;

export interface ScreenPackFile {
  path: string;
  contents: string;
}

export interface ScreenPack {
  files: ScreenPackFile[];
  components: string[];
  features: ScreenPackFeatures;
}

export interface ScreenPackFeatures {
  onboarding: boolean;
  auth: boolean;
  profile: boolean;
  dashboard: boolean;
  notes: boolean;
  settings: boolean;
}

export type ScreenPackTab = DelegateTab;

export function screenPackFeatures(addonIds: readonly string[]): ScreenPackFeatures {
  const ids = new Set(addonIds);
  return {
    onboarding: ids.has("ui/onboarding"),
    auth: ids.has("ui/auth"),
    profile: ids.has("ui/profile"),
    dashboard: ids.has("ui/dashboard"),
    notes: ids.has("ui/notes"),
    settings: ids.has("ui/settings"),
  };
}

/** Bottom tabs shared by the Expo and Flutter shells (Compose uses topLevelDestinations). */
export function screenPackTabs(features: ScreenPackFeatures): ScreenPackTab[] {
  const ids = (["dashboard", "notes", "profile", "settings"] as const).filter((key) => features[key]).map((key) => `ui/${key}`);
  return delegateTabs(ids);
}

const EXPO_FILES: Record<keyof ScreenPackFeatures | "core", readonly string[]> = {
  core: [
    "src/app/_layout.tsx",
    "src/app/explore.tsx",
    "src/launchbed/auth/fake-auth.ts",
    "src/launchbed/screens/Screen.tsx",
    "src/launchbed/screens/WelcomeScreen.tsx",
    "src/launchbed/session.tsx",
    "src/launchbed/storage/app-store.ts",
    "src/launchbed/storage/key-value.ts",
    "src/launchbed/storage/session-state.ts",
    "src/launchbed/storage/storage.test.js",
    "src/launchbed/theme.ts",
  ],
  onboarding: ["src/app/onboarding.tsx", "src/launchbed/screens/OnboardingScreen.tsx"],
  auth: [
    "src/app/login.tsx",
    "src/app/register.tsx",
    "src/launchbed/auth/auth.test.js",
    "src/launchbed/auth/validation.ts",
    "src/launchbed/screens/LoginScreen.tsx",
    "src/launchbed/screens/RegisterScreen.tsx",
  ],
  profile: [
    "src/app/(tabs)/profile.tsx",
    "src/app/profile-edit.tsx",
    "src/launchbed/screens/ProfileEditScreen.tsx",
    "src/launchbed/screens/ProfileScreen.tsx",
  ],
  dashboard: ["src/launchbed/screens/DashboardScreen.tsx"],
  notes: [
    "src/app/(tabs)/notes.tsx",
    "src/app/note.tsx",
    "src/launchbed/notes/notes-repository.ts",
    "src/launchbed/notes/notes-store.ts",
    "src/launchbed/notes/notes.test.js",
    "src/launchbed/screens/NoteEditorScreen.tsx",
    "src/launchbed/screens/NotesScreen.tsx",
  ],
  settings: ["src/app/(tabs)/settings.tsx", "src/launchbed/screens/SettingsScreen.tsx"],
};

const FLUTTER_FILES: Record<keyof ScreenPackFeatures | "core", readonly string[]> = {
  core: [
    "lib/launchbed/auth/fake_auth_repository.dart",
    "lib/launchbed/screens/welcome_screen.dart",
    "lib/launchbed/session.dart",
    "lib/launchbed/storage/key_value_store.dart",
    "lib/launchbed/storage/session_state.dart",
    "lib/launchbed/storage/shared_preferences_store.dart",
    "lib/launchbed/theme.dart",
    "test/session_persistence_test.dart",
  ],
  onboarding: ["lib/launchbed/screens/onboarding_screen.dart"],
  auth: [
    "lib/launchbed/auth/auth_validator.dart",
    "lib/launchbed/screens/login_screen.dart",
    "lib/launchbed/screens/register_screen.dart",
    "test/auth_validator_test.dart",
    "test/fake_auth_repository_test.dart",
  ],
  profile: ["lib/launchbed/screens/profile_edit_screen.dart", "lib/launchbed/screens/profile_screen.dart"],
  dashboard: ["lib/launchbed/screens/dashboard_screen.dart"],
  notes: [
    "lib/launchbed/notes/notes_repository.dart",
    "lib/launchbed/screens/note_editor_screen.dart",
    "lib/launchbed/screens/notes_screen.dart",
    "test/notes_repository_test.dart",
  ],
  settings: ["lib/launchbed/screens/settings_screen.dart"],
};

function fragment(target: ScreenPackTarget, path: string): string {
  const source = FRAGMENT_FILES[`${target}/${path}`];
  if (source === undefined) {
    throw new LaunchbedError("TEMPLATE_ERROR", `Screen pack fragment ${target}/${path} is missing.`);
  }
  return source;
}

function selectedPaths(table: Record<keyof ScreenPackFeatures | "core", readonly string[]>, features: ScreenPackFeatures): string[] {
  const paths = [...table.core];
  for (const key of ["onboarding", "auth", "profile", "dashboard", "notes", "settings"] as const) {
    if (features[key]) paths.push(...table[key]);
  }
  return paths;
}

function registryFiles(target: ScreenPackTarget, features: ScreenPackFeatures): ScreenPackFile[] {
  const catalog = loadComponentCatalog();
  const files: ScreenPackFile[] = [];
  for (const name of screenPackComponents(features)) {
    const contract = catalog.components.find((component) => component.name === name);
    const source = contract ? componentSources(contract).find((file) => file.target === target) : undefined;
    if (!source) {
      throw new LaunchbedError("TEMPLATE_ERROR", `Registry component ${name} has no ${target} source.`);
    }
    files.push({ path: source.destination, contents: source.content });
  }
  return files;
}

function usesScreenPack(addonIds: readonly string[]): boolean {
  return addonIds.includes("ui/navigation");
}

/* ------------------------------------------------------------------ */
/* Expo                                                               */
/* ------------------------------------------------------------------ */

function expoGate(features: ScreenPackFeatures): string {
  const lines = [
    'import { Redirect } from "expo-router";',
    'import { useSession } from "../launchbed/session";',
    "",
    "// Route gate: onboarding first, then sign-in, then the tabs. Generated by Launchbed from the selected add-ons.",
    "export default function Index() {",
    "  const session = useSession();",
    "  // Wait until the saved session has been read from the device.",
    "  if (!session.ready) return null;",
  ];
  if (features.onboarding) lines.push('  if (!session.onboardingSeen) return <Redirect href="/onboarding" />;');
  if (features.auth) lines.push('  if (!session.user) return <Redirect href="/login" />;');
  lines.push('  return <Redirect href="/home" />;', "}", "");
  return lines.join("\n");
}

const EXPO_TAB_SYMBOLS: Record<ScreenPackTab["id"], { ios: string; android: string }> = {
  home: { ios: "house.fill", android: "home" },
  notes: { ios: "note.text", android: "edit_note" },
  profile: { ios: "person.crop.circle", android: "person" },
  settings: { ios: "gearshape", android: "settings" },
};

function expoTabsLayout(tabs: readonly ScreenPackTab[]): string {
  const screens = tabs
    .map((tab) => {
      const symbol = EXPO_TAB_SYMBOLS[tab.id];
      return `      <Tabs.Screen
        name="${tab.id}"
        options={{
          title: "${tab.label}",
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: "${symbol.ios}", android: "${symbol.android}", web: "${symbol.android}" }} tintColor={color} size={24} />
          ),
        }}
      />`;
    })
    .join("\n");
  return `import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useAppColors } from "../../launchbed/theme";

// Bottom tabs generated by Launchbed. The bar is hidden when there is a single destination.
export default function TabsLayout() {
  const colors = useAppColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // onSurface, not primary: imported themes do not guarantee primary-on-surface contrast.
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: ${tabs.length >= 2 ? "{ backgroundColor: colors.surface }" : '{ display: "none" }'},
      }}
    >
${screens}
    </Tabs>
  );
}
`;
}

function expoHomeTab(features: ScreenPackFeatures): string {
  return features.dashboard
    ? `import { DashboardScreen } from "../../launchbed/screens/DashboardScreen";

export default function HomeTab() {
  return <DashboardScreen />;
}
`
    : `import { WelcomeScreen } from "../../launchbed/screens/WelcomeScreen";

export default function HomeTab() {
  return <WelcomeScreen />;
}
`;
}

export function expoScreenPack(options: { addonIds: readonly string[]; projectName: string }): ScreenPack | null {
  if (!usesScreenPack(options.addonIds)) return null;
  const features = screenPackFeatures(options.addonIds);
  const tabs = screenPackTabs(features);
  const files: ScreenPackFile[] = selectedPaths(EXPO_FILES, features).map((path) => ({ path, contents: fragment("expo", path) }));
  files.push(
    { path: "src/launchbed/config.ts", contents: `// Generated by Launchbed.\nexport const PROJECT_NAME = ${JSON.stringify(options.projectName)};\n` },
    { path: "src/app/index.tsx", contents: expoGate(features) },
    { path: "src/app/(tabs)/_layout.tsx", contents: expoTabsLayout(tabs) },
    { path: "src/app/(tabs)/home.tsx", contents: expoHomeTab(features) },
    ...registryFiles("expo", features),
  );
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), components: screenPackComponents(features), features };
}

/* ------------------------------------------------------------------ */
/* Flutter                                                            */
/* ------------------------------------------------------------------ */

function dartString(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll("$", "\\$")}'`;
}

function flutterApp(features: ScreenPackFeatures): string {
  const imports = ["import 'package:material_ui/material_ui.dart';", "", "import 'app_shell.dart';", "import 'config.dart';"];
  if (features.auth) imports.push("import 'screens/login_screen.dart';", "import 'screens/register_screen.dart';");
  if (features.onboarding) imports.push("import 'screens/onboarding_screen.dart';");
  if (features.notes) imports.push("import 'notes/notes_repository.dart';");
  imports.push("import 'session.dart';");
  if (features.notes) imports.push("import 'storage/key_value_store.dart';");
  imports.push("import 'theme.dart';");
  const gate: string[] = [];
  if (features.onboarding || features.auth) gate.push("    final session = SessionScope.of(context);");
  if (features.onboarding) {
    gate.push("    if (!session.onboardingSeen) {", "      return OnboardingScreen(onFinished: session.completeOnboarding);", "    }");
  }
  if (features.auth) {
    gate.push(
      "    if (session.user == null) {",
      "      return LoginScreen(",
      "        onRegister: () => Navigator.of(context).push(",
      "          MaterialPageRoute<void>(",
      "            builder: (routeContext) => RegisterScreen(onDone: () => Navigator.of(routeContext).pop()),",
      "          ),",
      "        ),",
      "      );",
      "    }",
    );
  }
  gate.push("    return const AppShell();");
  return `${imports.join("\n")}

/// Root widget generated by Launchbed: Material 3 theme from the DTCG tokens and a
/// route gate (onboarding first, then sign-in, then the tabs) driven by [Session].
class LaunchbedApp extends StatelessWidget {
${features.notes ? `  LaunchbedApp({super.key, required this.session, NotesRepository? notes})
      : notes = notes ?? NotesRepository(MemoryKeyValueStore());

  final Session session;
  final NotesRepository notes;` : `  const LaunchbedApp({super.key, required this.session});

  final Session session;`}

  @override
  Widget build(BuildContext context) {
    final app = ListenableBuilder(
      listenable: session,
      builder: (context, _) => MaterialApp(
        title: launchbedProjectName,
        theme: launchbedTheme(Brightness.light),
        darkTheme: launchbedTheme(Brightness.dark),
        themeMode: session.themeMode,
        home: const LaunchbedGate(),
      ),
    );
    return SessionScope(
      session: session,
      child: ${features.notes ? "NotesScope(notes: notes, child: app)" : "app"},
    );
  }
}

class LaunchbedGate extends StatelessWidget {
  const LaunchbedGate({super.key});

  @override
  Widget build(BuildContext context) {
${gate.join("\n")}
  }
}
`;
}

function flutterShell(features: ScreenPackFeatures, tabs: readonly ScreenPackTab[]): string {
  const homeImport = features.dashboard ? "import 'screens/dashboard_screen.dart';" : "import 'screens/welcome_screen.dart';";
  const homeWidget = features.dashboard ? "DashboardScreen()" : "WelcomeScreen()";
  const imports = ["import 'package:material_ui/material_ui.dart';", "", homeImport];
  if (features.notes) imports.push("import 'screens/notes_screen.dart';");
  if (features.profile) imports.push("import 'screens/profile_screen.dart';");
  if (features.settings) imports.push("import 'screens/settings_screen.dart';");
  const icons: Record<ScreenPackTab["id"], { icon: string; selected: string }> = {
    home: { icon: "Icons.home_outlined", selected: "Icons.home" },
    notes: { icon: "Icons.edit_note_outlined", selected: "Icons.edit_note" },
    profile: { icon: "Icons.person_outline", selected: "Icons.person" },
    settings: { icon: "Icons.settings_outlined", selected: "Icons.settings" },
  };
  const widgets: Record<ScreenPackTab["id"], string> = {
    home: homeWidget,
    notes: "NotesScreen()",
    profile: "ProfileScreen()",
    settings: "SettingsScreen()",
  };
  const pages = tabs.map((tab) => `      ${widgets[tab.id]},`);
  const destinations = tabs.map(
    (tab) =>
      `          NavigationDestination(icon: Icon(${icons[tab.id].icon}), selectedIcon: Icon(${icons[tab.id].selected}), label: ${dartString(tab.label)}),`,
  );
  const body =
    tabs.length >= 2
      ? `    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: const [
${destinations.join("\n")}
        ],
      ),
    );`
      : "    return _pages.first;";
  return `${imports.join("\n")}

/// Top-level destinations generated by Launchbed. A bottom NavigationBar is shown only
/// when there are at least two of them.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
${tabs.length >= 2 ? "  int _index = 0;\n" : ""}
  static const List<Widget> _pages = [
${pages.join("\n")}
  ];

  @override
  Widget build(BuildContext context) {
${body}
  }
}
`;
}

function flutterMain(features: ScreenPackFeatures): string {
  const imports = ["import 'package:material_ui/material_ui.dart';", "", "import 'launchbed/app.dart';"];
  if (features.notes) imports.push("import 'launchbed/notes/notes_repository.dart';");
  imports.push("import 'launchbed/session.dart';", "import 'launchbed/storage/shared_preferences_store.dart';");
  const body = [
    "  WidgetsFlutterBinding.ensureInitialized();",
    "  final store = SharedPreferencesStore();",
    "  final session = Session(store: store);",
    "  await session.load();",
  ];
  if (features.notes) body.push("  final notes = NotesRepository(store);", "  await notes.load();");
  body.push(`  runApp(LaunchbedApp(session: session${features.notes ? ", notes: notes" : ""}));`);
  return `${imports.join("\n")}

/// Generated by Launchbed: restores the saved session (shared_preferences) before the first frame.
Future<void> main() async {
${body.join("\n")}
}
`;
}

function flutterFlowTest(features: ScreenPackFeatures, tabs: readonly ScreenPackTab[], dartPackage: string): string {
  const steps: string[] = [];
  if (features.onboarding) {
    steps.push(
      "    expect(find.text('Welcome'), findsWidgets);",
      "    await tester.tap(find.text('Skip'));",
      "    await tester.pumpAndSettle();",
    );
  }
  if (features.auth) {
    steps.push(
      "    expect(find.text('Sign in'), findsWidgets);",
      "    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));",
      "    await tester.pumpAndSettle();",
      "    expect(find.text('Enter an email address'), findsOneWidget);",
      "    await tester.enterText(find.widgetWithText(TextField, 'Email'), 'demo@example.com');",
      "    await tester.enterText(find.widgetWithText(TextField, 'Password'), 'demo-password');",
      "    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));",
      "    await tester.pumpAndSettle();",
    );
  }
  steps.push(features.dashboard ? "    expect(find.text('Overview'), findsOneWidget);" : "    expect(find.text('Welcome'), findsWidgets);");
  if (tabs.length >= 2) {
    steps.push("    expect(find.byType(NavigationBar), findsOneWidget);");
    if (features.notes) {
      steps.push(
        "    await tester.tap(find.text('Notes').last);",
        "    await tester.pumpAndSettle();",
        "    expect(find.text('No notes yet'), findsOneWidget);",
        "    await tester.tap(find.byTooltip('New note'));",
        "    await tester.pumpAndSettle();",
        "    await tester.enterText(find.widgetWithText(TextField, 'Title'), 'Groceries');",
        "    await tester.tap(find.widgetWithText(FilledButton, 'Save'));",
        "    await tester.pumpAndSettle();",
        "    expect(find.text('Groceries'), findsOneWidget);",
      );
    }
    if (features.profile) {
      steps.push(
        "    await tester.tap(find.text('Profile').last);",
        "    await tester.pumpAndSettle();",
        "    expect(find.text('Edit profile'), findsOneWidget);",
      );
    }
    if (features.settings) {
      steps.push(
        "    await tester.tap(find.text('Settings').last);",
        "    await tester.pumpAndSettle();",
        "    await tester.tap(find.text('Dark'));",
        "    await tester.pumpAndSettle();",
        "    expect(tester.widget<MaterialApp>(find.byType(MaterialApp)).themeMode, ThemeMode.dark);",
      );
    }
  } else {
    steps.push("    expect(find.byType(NavigationBar), findsNothing);");
  }
  return `import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:${dartPackage}/launchbed/app.dart';
import 'package:${dartPackage}/launchbed/session.dart';

void main() {
  testWidgets('generated flow reaches the home tab', (tester) async {
    await tester.pumpWidget(LaunchbedApp(session: Session()));
    await tester.pumpAndSettle();
${steps.join("\n")}
  });
}
`;
}

export function flutterScreenPack(options: {
  addonIds: readonly string[];
  projectName: string;
  dartPackage: string;
}): ScreenPack | null {
  if (!usesScreenPack(options.addonIds)) return null;
  const features = screenPackFeatures(options.addonIds);
  const tabs = screenPackTabs(features);
  const vars = { dartPackage: options.dartPackage };
  const files: ScreenPackFile[] = selectedPaths(FLUTTER_FILES, features).map((path) => ({
    path,
    contents: path.startsWith("test/") ? renderText(fragment("flutter", path), vars, `flutter screen pack ${path}`) : fragment("flutter", path),
  }));
  files.push(
    { path: "lib/launchbed/config.dart", contents: `// Generated by Launchbed.\nconst String launchbedProjectName = ${dartString(options.projectName)};\n` },
    { path: "lib/launchbed/app.dart", contents: flutterApp(features) },
    { path: "lib/launchbed/app_shell.dart", contents: flutterShell(features, tabs) },
    { path: "lib/main.dart", contents: flutterMain(features) },
    { path: "test/app_flow_test.dart", contents: flutterFlowTest(features, tabs, options.dartPackage) },
    ...registryFiles("flutter", features),
  );
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), components: screenPackComponents(features), features };
}
