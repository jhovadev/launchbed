import 'package:material_ui/material_ui.dart';

import '../../ui/components/app_bar.dart';
import '../../ui/components/button.dart';
import '../../ui/components/text_field.dart';
import '../auth/auth_validator.dart';
import '../auth/fake_auth_repository.dart';
import '../session.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, required this.onDone});

  /// Called after a successful registration or when the user goes back to sign in.
  final VoidCallback onDone;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  String _displayName = '';
  String _email = '';
  String _password = '';
  String _confirm = '';
  bool _submitted = false;
  String? _failure;

  String? _show(String? message) => _submitted ? message : null;

  void _submit() {
    setState(() => _submitted = true);
    if (AuthValidator.emailError(_email) != null ||
        AuthValidator.passwordError(_password) != null ||
        AuthValidator.confirmPasswordError(_password, _confirm) != null) {
      return;
    }
    final result = SessionScope.of(context).register(_email, _password, _displayName);
    if (result is AuthFailure) {
      setState(() => _failure = result.message);
    } else {
      widget.onDone();
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: LaunchbedAppBar(title: 'Create account', onBack: widget.onDone),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Accounts exist only in memory for this session. This is not a real backend.',
            style: TextStyle(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          LaunchbedTextField(label: 'Display name', value: _displayName, onChanged: (v) => setState(() => _displayName = v)),
          const SizedBox(height: 16),
          LaunchbedTextField(
            label: 'Email',
            value: _email,
            onChanged: (v) => setState(() => _email = v),
            error: _show(AuthValidator.emailError(_email)),
          ),
          const SizedBox(height: 16),
          LaunchbedTextField(
            label: 'Password',
            value: _password,
            secure: true,
            onChanged: (v) => setState(() => _password = v),
            error: _show(AuthValidator.passwordError(_password)),
          ),
          const SizedBox(height: 16),
          LaunchbedTextField(
            label: 'Confirm password',
            value: _confirm,
            secure: true,
            onChanged: (v) => setState(() => _confirm = v),
            error: _show(AuthValidator.confirmPasswordError(_password, _confirm)),
          ),
          if (_failure != null) ...[
            const SizedBox(height: 12),
            Semantics(liveRegion: true, child: Text(_failure!, style: TextStyle(color: scheme.error))),
          ],
          const SizedBox(height: 16),
          LaunchbedButton(label: 'Create account', onPressed: _submit),
          LaunchbedButton(label: 'Already have an account', variant: LaunchbedButtonVariant.text, onPressed: widget.onDone),
        ],
      ),
    );
  }
}
