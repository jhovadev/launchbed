import 'package:flutter_test/flutter_test.dart';
import 'package:{{dartPackage}}/launchbed/auth/auth_validator.dart';

void main() {
  group('AuthValidator', () {
    test('email', () {
      expect(AuthValidator.emailError(''), 'Enter an email address');
      expect(AuthValidator.emailError('not-an-email'), 'Enter a valid email address');
      expect(AuthValidator.emailError('  ada@example.com '), isNull);
    });

    test('password', () {
      expect(AuthValidator.passwordError(''), 'Enter a password');
      expect(AuthValidator.passwordError('short'), 'Use at least 8 characters');
      expect(AuthValidator.passwordError('long-enough'), isNull);
    });

    test('confirm password', () {
      expect(AuthValidator.confirmPasswordError('secret-123', ''), 'Confirm your password');
      expect(AuthValidator.confirmPasswordError('secret-123', 'other-123'), 'Passwords do not match');
      expect(AuthValidator.confirmPasswordError('secret-123', 'secret-123'), isNull);
    });
  });
}
