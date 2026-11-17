import 'package:material_ui/material_ui.dart';

enum LaunchbedAvatarSize { sm, md, lg }

class LaunchbedAvatar extends StatelessWidget {
  const LaunchbedAvatar({
    super.key,
    required this.initials,
    required this.label,
    this.size = LaunchbedAvatarSize.md,
  });

  final String initials;
  final String label;
  final LaunchbedAvatarSize size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final radius = switch (size) {
      LaunchbedAvatarSize.sm => 14.0,
      LaunchbedAvatarSize.md => 20.0,
      LaunchbedAvatarSize.lg => 32.0,
    };
    final text = initials.length > 2 ? initials.substring(0, 2) : initials;
    return Semantics(
      label: label,
      image: true,
      excludeSemantics: true,
      child: CircleAvatar(
        radius: radius,
        backgroundColor: scheme.primaryContainer,
        foregroundColor: scheme.onPrimaryContainer,
        child: Text(text.toUpperCase(), style: TextStyle(fontSize: radius * 0.7, fontWeight: FontWeight.w600)),
      ),
    );
  }
}
