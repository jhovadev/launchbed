import 'package:flutter_test/flutter_test.dart';
import 'package:{{dartPackage}}/launchbed/auth/fake_auth_repository.dart';
import 'package:{{dartPackage}}/launchbed/session.dart';

void main() {
  test('demo account signs in, wrong password fails', () {
    final auth = InMemoryAuthRepository();
    expect(auth.signIn(InMemoryAuthRepository.demoEmail, InMemoryAuthRepository.demoPassword), isA<AuthSuccess>());
    final failure = auth.signIn(InMemoryAuthRepository.demoEmail, 'wrong-password');
    expect(failure, isA<AuthFailure>());
    expect((failure as AuthFailure).message, 'Email or password is not recognized');
  });

  test('register rejects duplicates; session tracks profile updates and sign out', () {
    final session = Session();
    expect(session.register('Ada@Example.com', 'secret-123', 'Ada'), isA<AuthSuccess>());
    expect(session.user?.displayName, 'Ada');
    expect(session.register('ada@example.com', 'secret-123', 'Ada'), isA<AuthFailure>());
    session.updateProfile('Ada Lovelace');
    expect(session.user?.displayName, 'Ada Lovelace');
    session.signOut();
    expect(session.user, isNull);
  });
}
