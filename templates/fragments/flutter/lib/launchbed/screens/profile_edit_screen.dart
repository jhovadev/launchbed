import 'package:material_ui/material_ui.dart';

import '../../ui/components/app_bar.dart';
import '../../ui/components/button.dart';
import '../../ui/components/text_field.dart';
import '../auth/fake_auth_repository.dart';
import '../session.dart';

class ProfileEditScreen extends StatefulWidget {
  const ProfileEditScreen({super.key});

  @override
  State<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends State<ProfileEditScreen> {
  String? _displayName;
  String? _failure;

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final displayName = _displayName ?? session.user?.displayName ?? '';
    return Scaffold(
      appBar: LaunchbedAppBar(title: 'Edit profile', onBack: () => Navigator.of(context).pop()),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          LaunchbedTextField(label: 'Display name', value: displayName, onChanged: (v) => setState(() => _displayName = v)),
          if (_failure != null) Text(_failure!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          const SizedBox(height: 16),
          LaunchbedButton(
            label: 'Save',
            onPressed: () {
              final result = session.updateProfile(displayName);
              if (result is AuthFailure) {
                setState(() => _failure = result.message);
              } else {
                Navigator.of(context).pop();
              }
            },
          ),
        ],
      ),
    );
  }
}
