import 'package:material_ui/material_ui.dart';

import '../../ui/components/app_bar.dart';
import '../../ui/components/button.dart';
import '../../ui/components/text_field.dart';
import '../auth/auth_validator.dart';
import '../auth/fake_auth_repository.dart';
import '../session.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onRegister});

  final VoidCallback onRegister;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  String _email = '';
  String _password = '';
  bool _submitted = false;
  String? _failure;

  void _submit() {
    setState(() => _submitted = true);
    if (AuthValidator.emailError(_email) != null || AuthValidator.passwordError(_password) != null) return;
    final result = SessionScope.of(context).signIn(_email, _password);
    if (result is AuthFailure) setState(() => _failure = result.message);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: const LaunchbedAppBar(title: 'Sign in'),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: scheme.secondaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Demo only. This screen talks to an in-memory fake, not a real backend.\n'
                'Try ${InMemoryAuthRepository.demoEmail} / ${InMemoryAuthRepository.demoPassword}',
                style: TextStyle(color: scheme.onSecondaryContainer),
              ),
            ),
          ),
          const SizedBox(height: 16),
          LaunchbedTextField(
            label: 'Email',
            value: _email,
            onChanged: (value) => setState(() => _email = value),
            error: _submitted ? AuthValidator.emailError(_email) : null,
          ),
          const SizedBox(height: 16),
          LaunchbedTextField(
            label: 'Password',
            value: _password,
            secure: true,
            onChanged: (value) => setState(() => _password = value),
            error: _submitted ? AuthValidator.passwordError(_password) : null,
          ),
          if (_failure != null) ...[
            const SizedBox(height: 12),
            Semantics(liveRegion: true, child: Text(_failure!, style: TextStyle(color: scheme.error))),
          ],
          const SizedBox(height: 16),
          LaunchbedButton(label: 'Sign in', onPressed: _submit),
          LaunchbedButton(label: 'Create an account', variant: LaunchbedButtonVariant.text, onPressed: widget.onRegister),
        ],
      ),
    );
  }
}
