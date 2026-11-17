import 'package:flutter_test/flutter_test.dart';
import 'package:{{dartPackage}}/launchbed/auth/fake_auth_repository.dart';
import 'package:{{dartPackage}}/launchbed/session.dart';
import 'package:{{dartPackage}}/launchbed/storage/key_value_store.dart';
import 'package:{{dartPackage}}/launchbed/storage/session_state.dart';
import 'package:{{dartPackage}}/launchbed/storage/shared_preferences_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('session survives a restart without storing the password', () async {
    final store = MemoryKeyValueStore();
    final first = Session(store: store);
    await first.load();
    first.completeOnboarding();
    first.signIn(InMemoryAuthRepository.demoEmail, InMemoryAuthRepository.demoPassword);
    first.setAppearance(AppearancePreference.dark);
    first.setNotifications(false);
    await Future<void>.delayed(Duration.zero);

    expect(store.values[PersistedSession.storageKey], isNot(contains(InMemoryAuthRepository.demoPassword)));

    final restarted = Session(store: store);
    await restarted.load();
    expect(restarted.onboardingSeen, isTrue);
    expect(restarted.user?.email, InMemoryAuthRepository.demoEmail);
    expect(restarted.appearance, AppearancePreference.dark);
    expect(restarted.notifications, isFalse);
    expect(restarted.updateProfile('Renamed'), isA<AuthSuccess>());

    restarted.signOut();
    await Future<void>.delayed(Duration.zero);
    final afterSignOut = Session(store: store);
    await afterSignOut.load();
    expect(afterSignOut.user, isNull);
    expect(afterSignOut.onboardingSeen, isTrue);
  });

  test('corrupt or unexpected data falls back to defaults', () {
    for (final raw in ['{oops', '[]', '{"onboardingSeen":"yes","user":{"email":1},"appearance":"neon"}']) {
      final state = PersistedSession.parse(raw);
      expect(state.onboardingSeen, isFalse);
      expect(state.user, isNull);
      expect(state.appearance, AppearancePreference.system);
      expect(state.notifications, isTrue);
    }
  });

  test('shared_preferences store round-trips values', () async {
    SharedPreferences.setMockInitialValues({});
    final store = SharedPreferencesStore();
    await store.write('k', 'v');
    expect(await store.read('k'), 'v');
    await store.delete('k');
    expect(await store.read('k'), isNull);
  });
}
