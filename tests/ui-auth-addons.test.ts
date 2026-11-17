import { describe, expect, test } from "bun:test";
import { generateProject, materializeProject } from "@launchbed/generator";
import { ALL_ADDONS, ALL_PRESETS, findAddon, isGeneratable } from "@launchbed/catalog";
import { baseRequest } from "./fixtures";

function text(files: Map<string, Uint8Array>, path: string): string {
  const bytes = files.get(path);
  if (!bytes) throw new Error(`Missing ${path}`);
  return new TextDecoder().decode(bytes);
}

describe("ui/onboarding, ui/auth and ui/profile", () => {
  test("catalog marks the new addons and app-starter as generatable", () => {
    for (const id of ["ui/onboarding", "ui/auth", "ui/profile"]) {
      const addon = findAddon(id);
      expect(addon).toBeDefined();
      expect(isGeneratable(addon!)).toBe(true);
    }
    expect(ALL_ADDONS.some((addon) => addon.id === "ui/login")).toBe(false);
    expect(ALL_ADDONS.some((addon) => addon.id === "ui/register")).toBe(false);
    const preset = ALL_PRESETS.find((item) => item.id === "app-starter");
    expect(preset?.status).toBe("beta");
    expect(ALL_PRESETS.some((item) => item.id === "auth-ui")).toBe(false);
  });

  test("onboarding persists a DataStore flag and starts at Onboarding until seen", async () => {
    const project = await materializeProject(baseRequest({ addons: ["ui/onboarding"] }));
    const paths = project.plan.files.map((file) => file.path);
    expect(paths.some((path) => path.endsWith("/ui/onboarding/OnboardingScreen.kt"))).toBe(true);
    expect(paths.some((path) => path.endsWith("/ui/onboarding/OnboardingStore.kt"))).toBe(true);
    const start = text(project.files, "app/src/main/java/com/example/demo/ui/navigation/StartRoute.kt");
    expect(start).toContain("OnboardingStore.seen");
    expect(start).toContain("return AppRoute.Onboarding");
    expect(start).toContain("return AppRoute.Welcome");
    const app = text(project.files, "app/src/main/java/com/example/demo/ui/navigation/AppRoot.kt");
    expect(app).toContain("rememberStartRoute()");
    expect(app).toContain("OnboardingScreen(onFinished = { backStack.replaceRoot(AppRoute.Welcome) })");
    const gradle = text(project.files, "app/build.gradle.kts");
    expect(gradle).toContain("implementation(libs.datastorepreferences)");
    expect(gradle).toContain("implementation(libs.lifecycleruntimecompose)");
  });

  test("auth ships an in-memory fake, validation unit tests and no real backend", async () => {
    const project = await materializeProject(baseRequest({ addons: ["ui/auth"] }));
    const login = text(project.files, "app/src/main/java/com/example/demo/ui/auth/LoginScreen.kt");
    expect(login).toContain("in-memory fake, not a real backend");
    expect(login).toContain("InMemoryAuthRepository.DEMO_EMAIL");
    const repo = text(project.files, "app/src/main/java/com/example/demo/ui/auth/AuthRepository.kt");
    expect(repo).toContain("class InMemoryAuthRepository");
    expect(repo).not.toContain("firebase");
    expect(repo).not.toContain("supabase");
    const docs = text(project.files, "docs/AUTH.md");
    expect(docs).toContain("in-memory");
    expect(docs).toContain("Firebase");
    expect(docs).toContain("demo@example.com");
    const start = text(project.files, "app/src/main/java/com/example/demo/ui/navigation/StartRoute.kt");
    expect(start).toContain("AuthRepositoryHolder");
    expect(start).toContain("return AppRoute.Login");
    const app = text(project.files, "app/src/main/java/com/example/demo/ui/navigation/AppRoot.kt");
    expect(app).toContain("LoginScreen(");
    expect(app).toContain("RegisterScreen(");
    const unit = text(project.files, "app/src/test/java/com/example/demo/ui/auth/AuthValidatorTest.kt");
    expect(unit).toContain("fun rejectsMalformedEmail()");
  });

  test("profile depends on auth and can sign out back to login", async () => {
    const project = await materializeProject(baseRequest({ addons: ["ui/profile"] }));
    expect(project.plan.request.addons).toContain("ui/auth");
    const app = text(project.files, "app/src/main/java/com/example/demo/ui/navigation/AppRoot.kt");
    expect(app).toContain("ProfileScreen(");
    expect(app).toContain("backStack.replaceRoot(AppRoute.Login)");
  });

  test("app-starter starts at onboarding, then login, then dashboard", async () => {
    const project = await materializeProject(baseRequest({ preset: "app-starter" }));
    const start = text(project.files, "app/src/main/java/com/example/demo/ui/navigation/StartRoute.kt");
    expect(start.indexOf("return AppRoute.Onboarding")).toBeLessThan(start.indexOf("return AppRoute.Login"));
    expect(start).toContain("return AppRoute.Dashboard");
    const app = text(project.files, "app/src/main/java/com/example/demo/ui/navigation/AppRoot.kt");
    expect(app).toContain("backStack.replaceRoot(AppRoute.Login)");
    expect(app).toContain("backStack.replaceRoot(AppRoute.Dashboard)");
  });

  test("generated zips are deterministic and leave the minimal template untouched", async () => {
    const request = baseRequest({ addons: ["ui/onboarding", "ui/auth", "ui/profile"] });
    const first = await generateProject(request);
    const second = await generateProject(baseRequest({ addons: ["ui/profile", "ui/auth", "ui/onboarding"] }));
    expect(Buffer.from(first.zip).equals(Buffer.from(second.zip))).toBe(true);
    const minimal = await materializeProject(baseRequest());
    expect([...minimal.files.keys()].some((path) => path.includes("/ui/auth/") || path.includes("/ui/onboarding/"))).toBe(false);
  });
});
