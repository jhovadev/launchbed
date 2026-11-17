import 'package:material_ui/material_ui.dart';

import 'auth/fake_auth_repository.dart';
import 'storage/key_value_store.dart';
import 'storage/session_state.dart';

export 'storage/session_state.dart' show AppearancePreference;

/// App session saved on the device: onboarding, the signed-in user and the settings survive
/// restarts (call [load] before runApp). Passwords are never stored; the fake auth itself
/// stays in memory.
class Session extends ChangeNotifier {
  Session({InMemoryAuthRepository? auth, KeyValueStore? store})
      : _auth = auth ?? InMemoryAuthRepository(),
        _store = store ?? MemoryKeyValueStore();

  final InMemoryAuthRepository _auth;
  final KeyValueStore _store;
  PersistedSession _state = const PersistedSession();

  bool get onboardingSeen => _state.onboardingSeen;
  AuthUser? get user => _state.user;
  AppearancePreference get appearance => _state.appearance;
  bool get notifications => _state.notifications;

  ThemeMode get themeMode => switch (_state.appearance) {
        AppearancePreference.system => ThemeMode.system,
        AppearancePreference.light => ThemeMode.light,
        AppearancePreference.dark => ThemeMode.dark,
      };

  /// Reads the saved session. Safe to skip in tests (defaults apply).
  Future<void> load() async {
    _state = await PersistedSession.load(_store);
    notifyListeners();
  }

  void completeOnboarding() => _update(onboardingSeen: true);

  AuthResult signIn(String email, String password) => _apply(_auth.signIn(email, password));

  AuthResult register(String email, String password, String displayName) =>
      _apply(_auth.register(email, password, displayName));

  AuthResult updateProfile(String displayName) {
    final current = _state.user;
    if (current == null) return const AuthFailure('You are signed out');
    return _apply(_auth.updateProfile(current, displayName));
  }

  void signOut() => _update(clearUser: true);

  void setAppearance(AppearancePreference appearance) => _update(appearance: appearance);

  void setNotifications(bool enabled) => _update(notifications: enabled);

  AuthResult _apply(AuthResult result) {
    if (result is AuthSuccess) _update(user: result.user);
    return result;
  }

  void _update({bool? onboardingSeen, AuthUser? user, bool clearUser = false, AppearancePreference? appearance, bool? notifications}) {
    _state = PersistedSession(
      onboardingSeen: onboardingSeen ?? _state.onboardingSeen,
      user: clearUser ? null : (user ?? _state.user),
      appearance: appearance ?? _state.appearance,
      notifications: notifications ?? _state.notifications,
    );
    notifyListeners();
    _state.save(_store).catchError((Object error) => debugPrint('Could not save the session: $error'));
  }
}

/// Makes the [Session] available to every screen below [LaunchbedApp].
class SessionScope extends InheritedNotifier<Session> {
  const SessionScope({super.key, required Session session, required super.child}) : super(notifier: session);

  static Session of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<SessionScope>();
    assert(scope != null, 'SessionScope.of() called outside LaunchbedApp');
    return scope!.notifier!;
  }
}
