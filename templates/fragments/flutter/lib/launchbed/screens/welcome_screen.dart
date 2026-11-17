import 'package:material_ui/material_ui.dart';

import '../../ui/components/app_bar.dart';
import '../../ui/components/card.dart';
import '../config.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: const LaunchbedAppBar(title: launchbedProjectName),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Semantics(header: true, child: Text('Welcome', style: theme.textTheme.headlineMedium)),
          const SizedBox(height: 16),
          const LaunchbedCard(
            child: Text('Built with Flutter and Launchbed design tokens. Add screens under lib/launchbed/screens.'),
          ),
        ],
      ),
    );
  }
}
