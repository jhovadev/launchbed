import 'package:material_ui/material_ui.dart';


enum LaunchbedButtonVariant { filled, outlined, text }
enum LaunchbedButtonSize { sm, md, lg }

class LaunchbedButton extends StatelessWidget {
  const LaunchbedButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = LaunchbedButtonVariant.filled,
    this.size = LaunchbedButtonSize.md,
    this.enabled = true,
  });

  final String label;
  final VoidCallback onPressed;
  final LaunchbedButtonVariant variant;
  final LaunchbedButtonSize size;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final child = Text(label);
    final onPressedCb = enabled ? onPressed : null;
    switch (variant) {
      case LaunchbedButtonVariant.outlined:
        return OutlinedButton(onPressed: onPressedCb, child: child);
      case LaunchbedButtonVariant.text:
        return TextButton(onPressed: onPressedCb, child: child);
      case LaunchbedButtonVariant.filled:
        return FilledButton(onPressed: onPressedCb, child: child);
    }
  }
}

