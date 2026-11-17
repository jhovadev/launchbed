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

export type ScreenPackTarget = "expo" | "flutter";

/** Add-ons that have an Expo and a Flutter port. Other ui/* packs stay Compose-only. */
export const DELEGATE_SCREEN_ADDONS = ["ui/navigation", "ui/onboarding", "ui/auth", "ui/profile", "ui/dashboard"] as const;

/** Registry components the screen packs import. They are copied in and listed in launchbed.json. */
export const SCREEN_PACK_COMPONENTS = ["app-bar", "avatar", "badge", "button", "card", "list-item", "text-field"] as const;

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
}

export type ScreenPackTab = DelegateTab;

export function screenPackFeatures(addonIds: readonly string[]): ScreenPackFeatures {
  const ids = new Set(addonIds);
  return {
    onboarding: ids.has("ui/onboarding"),
    auth: ids.has("ui/auth"),
    profile: ids.has("ui/profile"),
    dashboard: ids.has("ui/dashboard"),
  };
}

/** Bottom tabs shared by the Expo and Flutter shells (Compose uses topLevelDestinations). */
export function screenPackTabs(features: ScreenPackFeatures): ScreenPackTab[] {
  return delegateTabs([...(features.dashboard ? ["ui/dashboard"] : []), ...(features.profile ? ["ui/profile"] : [])]);
}

const EXPO_FILES: Record<keyof ScreenPackFeatures | "core", readonly string[]> = {
  core: [
    "src/app/_layout.tsx",
    "src/app/explore.tsx",
    "src/launchbed/auth/fake-auth.ts",
    "src/launchbed/screens/Screen.tsx",
    "src/launchbed/screens/WelcomeScreen.tsx",
    "src/launchbed/session.tsx",
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
};

const FLUTTER_FILES: Record<keyof ScreenPackFeatures | "core", readonly string[]> = {
  core: [
    "lib/launchbed/auth/fake_auth_repository.dart",
    "lib/launchbed/screens/welcome_screen.dart",
    "lib/launchbed/session.dart",
    "lib/launchbed/theme.dart",
    "lib/main.dart",
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
  for (const key of ["onboarding", "auth", "profile", "dashboard"] as const) {
    if (features[key]) paths.push(...table[key]);
  }
  return paths;
}

function registryFiles(target: ScreenPackTarget): ScreenPackFile[] {
  const catalog = loadComponentCatalog();
  const files: ScreenPackFile[] = [];
  for (const name of SCREEN_PACK_COMPONENTS) {
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
  const gated = features.onboarding || features.auth;
  const lines = [
    'import { Redirect } from "expo-router";',
    ...(gated ? ['import { useSession } from "../launchbed/session";'] : []),
    "",
    "// Route gate: onboarding first, then sign-in, then the tabs. Generated by Launchbed from the selected add-ons.",
    "export default function Index() {",
  ];
  if (gated) lines.push("  const session = useSession();");
  if (features.onboarding) lines.push('  if (!session.onboardingSeen) return <Redirect href="/onboarding" />;');
  if (features.auth) lines.push('  if (!session.user) return <Redirect href="/login" />;');
  lines.push('  return <Redirect href="/home" />;', "}", "");
  return lines.join("\n");
}

const EXPO_TAB_SYMBOLS: Record<ScreenPackTab["id"], { ios: string; android: string }> = {
  home: { ios: "house.fill", android: "home" },
  profile: { ios: "person.crop.circle", android: "person" },
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
        tabBarActiveTintColor: colors.onSecondaryContainer,
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
    ...registryFiles("expo"),
  );
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), components: [...SCREEN_PACK_COMPONENTS], features };
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
  imports.push("import 'session.dart';", "import 'theme.dart';");
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
  const LaunchbedApp({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      session: session,
      child: MaterialApp(
        title: launchbedProjectName,
        theme: launchbedTheme(Brightness.light),
        darkTheme: launchbedTheme(Brightness.dark),
        home: const LaunchbedGate(),
      ),
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
  if (features.profile) imports.push("import 'screens/profile_screen.dart';");
  const icons: Record<ScreenPackTab["id"], { icon: string; selected: string }> = {
    home: { icon: "Icons.home_outlined", selected: "Icons.home" },
    profile: { icon: "Icons.person_outline", selected: "Icons.person" },
  };
  const pages = tabs.map((tab) => (tab.id === "home" ? `      ${homeWidget},` : "      ProfileScreen(),"));
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
    if (features.profile) {
      steps.push(
        "    await tester.tap(find.text('Profile').last);",
        "    await tester.pumpAndSettle();",
        "    expect(find.text('Edit profile'), findsOneWidget);",
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
    { path: "test/app_flow_test.dart", contents: flutterFlowTest(features, tabs, options.dartPackage) },
    ...registryFiles("flutter"),
  );
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), components: [...SCREEN_PACK_COMPONENTS], features };
}
