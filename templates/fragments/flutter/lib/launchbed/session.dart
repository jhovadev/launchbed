import 'package:material_ui/material_ui.dart';

import 'auth/fake_auth_repository.dart';

/// App session kept in memory: onboarding and sign-in reset when the app restarts.
/// Persist them (shared_preferences, flutter_secure_storage) when you replace the fake auth.
class Session extends ChangeNotifier {
  Session({InMemoryAuthRepository? auth}) : _auth = auth ?? InMemoryAuthRepository();

  final InMemoryAuthRepository _auth;
  bool _onboardingSeen = false;
  AuthUser? _user;

  bool get onboardingSeen => _onboardingSeen;
  AuthUser? get user => _user;

  void completeOnboarding() {
    _onboardingSeen = true;
    notifyListeners();
  }

  AuthResult signIn(String email, String password) => _apply(_auth.signIn(email, password));

  AuthResult register(String email, String password, String displayName) =>
      _apply(_auth.register(email, password, displayName));

  AuthResult updateProfile(String displayName) {
    final current = _user;
    if (current == null) return const AuthFailure('You are signed out');
    return _apply(_auth.updateProfile(current, displayName));
  }

  void signOut() {
    _user = null;
    notifyListeners();
  }

  AuthResult _apply(AuthResult result) {
    if (result is AuthSuccess) {
      _user = result.user;
      notifyListeners();
    }
    return result;
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
