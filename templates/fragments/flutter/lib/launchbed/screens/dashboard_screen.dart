import 'package:material_ui/material_ui.dart';

import '../../ui/components/app_bar.dart';
import '../../ui/components/badge.dart';
import '../../ui/components/list_item.dart';

class DashboardStat {
  const DashboardStat(this.label, this.value, this.icon);
  final String label;
  final String value;
  final IconData icon;
}

class DashboardActivity {
  const DashboardActivity(this.title, this.detail, this.time, this.icon);
  final String title;
  final String detail;
  final String time;
  final IconData icon;
}

// Placeholder values, identical to the Compose DashboardScreen. Replace with your own data.
const sampleStats = <DashboardStat>[
  DashboardStat('Tasks done', '8/12', Icons.check_circle),
  DashboardStat('Due today', '3', Icons.event),
  DashboardStat('Messages', '5', Icons.mail),
  DashboardStat('Streak', '4 days', Icons.star),
];

const sampleActivity = <DashboardActivity>[
  DashboardActivity('Design review', 'Moved to Done', '2h', Icons.check_circle),
  DashboardActivity('Weekly sync', 'Notes added', '5h', Icons.edit),
  DashboardActivity('Release 1.0', 'Build ready to test', '1d', Icons.build),
];

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Scaffold(
      appBar: const LaunchbedAppBar(title: 'Dashboard'),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(
                    header: true,
                    child: Text('Overview', style: theme.textTheme.headlineSmall?.copyWith(color: scheme.primary)),
                  ),
                  Text('Good to see you', style: TextStyle(color: scheme.onSurfaceVariant)),
                ],
              ),
              const LaunchbedBadge(label: 'Sample data'),
            ],
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.4,
            children: [
              for (final stat in sampleStats)
                Semantics(
                  label: '${stat.label}: ${stat.value}',
                  excludeSemantics: true,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: scheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Icon(stat.icon, color: scheme.primary),
                        Text(stat.value, style: theme.textTheme.titleLarge),
                        Text(stat.label, style: TextStyle(color: scheme.onSurfaceVariant)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Semantics(header: true, child: Text('Recent activity', style: theme.textTheme.titleMedium)),
          const SizedBox(height: 8),
          Card.outlined(
            child: Column(
              children: [
                for (final item in sampleActivity)
                  LaunchbedListItem(title: item.title, subtitle: '${item.detail} · ${item.time}'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
