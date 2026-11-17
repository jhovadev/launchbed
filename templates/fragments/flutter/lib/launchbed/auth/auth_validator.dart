/// Same rules and messages as the Compose AuthValidator, so every target behaves alike.
class AuthValidator {
  AuthValidator._();

  static final RegExp _email = RegExp(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

  static String? emailError(String email) {
    final value = email.trim();
    if (value.isEmpty) return 'Enter an email address';
    if (!_email.hasMatch(value)) return 'Enter a valid email address';
    return null;
  }

  static String? passwordError(String password) {
    if (password.isEmpty) return 'Enter a password';
    if (password.length < 8) return 'Use at least 8 characters';
    return null;
  }

  static String? confirmPasswordError(String password, String confirm) {
    if (confirm.isEmpty) return 'Confirm your password';
    if (confirm != password) return 'Passwords do not match';
    return null;
  }
}
