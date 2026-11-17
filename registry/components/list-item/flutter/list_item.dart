import 'package:material_ui/material_ui.dart';


class LaunchbedListItem extends StatelessWidget {
  const LaunchbedListItem({
    super.key,
    required this.title,
    this.subtitle,
    this.onTap,
    this.enabled = true,
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(title),
      subtitle: subtitle == null ? null : Text(subtitle!),
      onTap: enabled ? onTap : null,
      enabled: enabled,
    );
  }
}

