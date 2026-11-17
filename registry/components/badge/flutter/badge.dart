import 'package:material_ui/material_ui.dart';


enum LaunchbedBadgeVariant { neutral, accent }

class LaunchbedBadge extends StatelessWidget {
  const LaunchbedBadge({
    super.key,
    required this.label,
    this.variant = LaunchbedBadgeVariant.neutral,
  });

  final String label;
  final LaunchbedBadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bg = variant == LaunchbedBadgeVariant.accent ? scheme.primary : scheme.surfaceContainerHighest;
    final fg = variant == LaunchbedBadgeVariant.accent ? scheme.onPrimary : scheme.onSurfaceVariant;
    return Semantics(
      label: label,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
        child: Text(label, style: TextStyle(color: fg)),
      ),
    );
  }
}

