import 'package:material_ui/material_ui.dart';


class LaunchbedCard extends StatelessWidget {
  const LaunchbedCard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: child,
      ),
    );
  }
}

