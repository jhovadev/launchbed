import 'package:material_ui/material_ui.dart';


class LaunchbedSwitch extends StatelessWidget {
  const LaunchbedSwitch({
    super.key,
    required this.label,
    required this.checked,
    required this.onChanged,
    this.enabled = true,
  });

  final String label;
  final bool checked;
  final ValueChanged<bool> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label),
        Switch(value: checked, onChanged: enabled ? onChanged : null),
      ],
    );
  }
}

