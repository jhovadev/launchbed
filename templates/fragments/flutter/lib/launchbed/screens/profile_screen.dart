import 'package:material_ui/material_ui.dart';

import '../../ui/components/app_bar.dart';
import '../../ui/components/avatar.dart';
import '../../ui/components/button.dart';
import '../../ui/components/list_item.dart';
import '../session.dart';
import 'profile_edit_screen.dart';

String _initials(String name) {
  final parts = name.split(RegExp(r'\s+')).where((part) => part.isNotEmpty);
  final letters = parts.map((part) => part[0]).join();
  return letters.isEmpty ? '?' : letters;
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final user = session.user;
    final theme = Theme.of(context);
    return Scaffold(
      appBar: const LaunchbedAppBar(title: 'Profile'),
      body: user == null
          ? const Center(child: Text('You are signed out.'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    LaunchbedAvatar(initials: _initials(user.displayName), label: user.displayName, size: LaunchbedAvatarSize.lg),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user.displayName, style: theme.textTheme.titleLarge),
                          Text(user.email, style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Card.filled(
                  child: Column(
                    children: [
                      LaunchbedListItem(title: user.displayName, subtitle: 'Display name'),
                      LaunchbedListItem(title: user.email, subtitle: 'Email'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                LaunchbedButton(
                  label: 'Edit profile',
                  variant: LaunchbedButtonVariant.outlined,
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => const ProfileEditScreen()),
                  ),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.error,
                    foregroundColor: theme.colorScheme.onError,
                  ),
                  onPressed: session.signOut,
                  child: const Text('Sign out'),
                ),
              ],
            ),
    );
  }
}
