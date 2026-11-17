/// In-memory fake. This is not a security boundary and must not be presented as real
/// authentication. Replace it with a backend-backed repository (Firebase, Supabase, or
/// your own API) when you ship.
class AuthUser {
  const AuthUser({required this.email, required this.displayName});

  final String email;
  final String displayName;
}

sealed class AuthResult {
  const AuthResult();
}

class AuthSuccess extends AuthResult {
  const AuthSuccess(this.user);
  final AuthUser user;
}

class AuthFailure extends AuthResult {
  const AuthFailure(this.message);
  final String message;
}

class InMemoryAuthRepository {
  InMemoryAuthRepository() {
    _accounts[demoEmail] = (password: demoPassword, user: const AuthUser(email: demoEmail, displayName: 'Demo user'));
  }

  static const String demoEmail = 'demo@example.com';
  static const String demoPassword = 'demo-password';

  final Map<String, ({String password, AuthUser user})> _accounts = {};

  AuthResult signIn(String email, String password) {
    final account = _accounts[email.trim().toLowerCase()];
    if (account == null || account.password != password) {
      return const AuthFailure('Email or password is not recognized');
    }
    return AuthSuccess(account.user);
  }

  AuthResult register(String email, String password, String displayName) {
    final key = email.trim().toLowerCase();
    if (_accounts.containsKey(key)) {
      return const AuthFailure('An account with this email already exists');
    }
    final name = displayName.trim().isEmpty ? email.trim() : displayName.trim();
    final user = AuthUser(email: email.trim(), displayName: name);
    _accounts[key] = (password: password, user: user);
    return AuthSuccess(user);
  }

  AuthResult updateProfile(AuthUser current, String displayName) {
    final key = current.email.toLowerCase();
    final account = _accounts[key];
    if (account == null) return const AuthFailure('You are signed out');
    final name = displayName.trim().isEmpty ? current.displayName : displayName.trim();
    final user = AuthUser(email: current.email, displayName: name);
    _accounts[key] = (password: account.password, user: user);
    return AuthSuccess(user);
  }
}
