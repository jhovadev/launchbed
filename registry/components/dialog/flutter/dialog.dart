import 'package:material_ui/material_ui.dart';

/// Shows a confirmation dialog. Resolves to true when the user confirms.
Future<bool> showLaunchbedDialog(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  String dismissLabel = 'Cancel',
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(dismissLabel)),
        TextButton(onPressed: () => Navigator.of(context).pop(true), child: Text(confirmLabel)),
      ],
    ),
  );
  return result ?? false;
}
