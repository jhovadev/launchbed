import 'package:material_ui/material_ui.dart';

import '../../ui/components/app_bar.dart';
import '../../ui/components/launchbed_switch.dart';
import '../../ui/components/list_item.dart';
import '../config.dart';
import '../session.dart';

/// Settings saved on the device: appearance (applied app-wide), notifications preference, about.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final theme = Theme.of(context);
    Widget section(String title) => Padding(
          padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
          child: Text(title, style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
        );
    return Scaffold(
      appBar: const LaunchbedAppBar(title: 'Settings'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          section('Appearance'),
          Card.filled(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SegmentedButton<AppearancePreference>(
                    segments: const [
                      ButtonSegment(value: AppearancePreference.system, label: Text('System'), icon: Icon(Icons.brightness_auto)),
                      ButtonSegment(value: AppearancePreference.light, label: Text('Light'), icon: Icon(Icons.light_mode)),
                      ButtonSegment(value: AppearancePreference.dark, label: Text('Dark'), icon: Icon(Icons.dark_mode)),
                    ],
                    selected: {session.appearance},
                    onSelectionChanged: (selection) => session.setAppearance(selection.first),
                  ),
                  const SizedBox(height: 8),
                  Text('Saved on this device.', style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
          ),
          section('Notifications'),
          Card.filled(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LaunchbedSwitch(label: 'Enable notifications', checked: session.notifications, onChanged: session.setNotifications),
                  Text(
                    'A saved preference. Connect it to your notification service.',
                    style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          ),
          section('About'),
          const Card.filled(
            child: Column(
              children: [
                LaunchbedListItem(title: launchbedProjectName, subtitle: 'Version 1.0.0'),
                LaunchbedListItem(title: 'Built with Launchbed', subtitle: 'Flutter screen pack'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
