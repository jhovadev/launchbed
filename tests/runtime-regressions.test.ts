import { describe, expect, test } from 'bun:test';
import { materializeProject, generateProject } from '@android-initializr/generator';
import { baseRequest } from './fixtures';

function generatedText(preset: string, path: string): string {
  const project=materializeProject(baseRequest({preset}));
  const bytes=project.files.get(path);
  if (!bytes) throw new Error(`Missing generated artifact: ${path}`);
  return new TextDecoder().decode(bytes);
}
const navRoot='app/src/main/java/com/example/demo/ui/navigation/AppRoot.kt';

describe('F1.6A generated runtime readiness', () => {
  test('local-notes launches Notes, not an unreachable Welcome screen', () => {
    const app=generatedText('local-notes',navRoot);
    expect(app).toContain('rememberNavBackStack(AppRoute.Notes)');
    expect(app).toContain('entry<AppRoute.Notes>');
    expect(app).toContain('entry<AppRoute.NoteEditor>');
  });

  test('catalog-ui now launches a registered Catalog destination', () => {
    const app=generatedText('catalog-ui',navRoot);
    expect(app).toContain('rememberNavBackStack(AppRoute.Catalog)');
    expect(app).toContain('entry<AppRoute.Catalog> { CatalogScreen() }');
    expect(app).toContain('import com.example.demo.ui.catalog.CatalogScreen');
  });

  test('compose-minimal does not receive Compose UI-test dependencies', () => {
    const build=generatedText('compose-minimal','app/build.gradle.kts');
    expect(build).not.toContain('composeuitestjunit4');
    expect(build).not.toContain('composeuitestmanifest');
    const files=materializeProject(baseRequest({preset:'compose-minimal'})).plan.files;
    expect(files.some((file)=>file.path.startsWith('app/src/androidTest/'))).toBe(false);
  });

  test('compose-starter includes real instrumented screen test sources', () => {
    const files=materializeProject(baseRequest({preset:'compose-starter'})).plan.files.map((f)=>f.path);
    expect(files).toContain('app/src/androidTest/java/com/example/demo/ui/navigation/NavigationSmokeTest.kt');
    expect(files).toContain('app/src/androidTest/java/com/example/demo/ui/dashboard/DashboardScreenTest.kt');
    expect(files).toContain('app/src/androidTest/java/com/example/demo/ui/settings/SettingsScreenTest.kt');
  });

  test('local-notes includes Room in-memory, reopen and Flow tests', () => {
    const dao=generatedText('local-notes','app/src/androidTest/java/com/example/demo/data/local/NoteDaoTest.kt');
    expect(dao).toContain('observesInsertedNotes');
    expect(dao).toContain('fileDatabasePersistsAcrossCloseAndReopen');
    const paths=materializeProject(baseRequest({preset:'local-notes'})).plan.files.map((f)=>f.path);
    expect(paths).toContain('app/src/androidTest/java/com/example/demo/feature/notes/NotesScreenTest.kt');
    expect(dao).toContain('withTimeout(10_000L)');
  });

  test('Room + navigation adds test JUnit dependency once', () => {
    const build=generatedText('local-notes','app/build.gradle.kts');
    expect(build.match(/androidTestImplementation\(libs\.androidxtestextjunit\)/g)?.length).toBe(1);
    expect(build).toContain('androidTestImplementation(platform(libs.androidx.compose.bom))');
  });

  test('Navigation smoke tests use the SemanticsNodeInteraction.assertExists member', () => {
    for (const preset of ['compose-starter', 'local-notes']) {
      const navTest = generatedText(
        preset,
        'app/src/androidTest/java/com/example/demo/ui/navigation/NavigationSmokeTest.kt',
      );
      expect(navTest).not.toContain('import androidx.compose.ui.test.assertExists');
      expect(navTest).toContain('composeRule.onRoot().assertExists()');
    }
  });

  test('generator remains deterministic with instrumented tests', () => {
    const config=baseRequest({preset:'catalog-ui'});
    expect(Buffer.from(generateProject(config).zip).equals(Buffer.from(generateProject(config).zip))).toBe(true);
  });
});
