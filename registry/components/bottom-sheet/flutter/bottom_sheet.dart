import 'package:material_ui/material_ui.dart';

/// Shows a modal bottom sheet with a drag handle, a [title] and the content from [builder].
/// The Future completes (with the value passed to Navigator.pop, or null) when the sheet closes,
/// which is the Flutter equivalent of onDismiss.
Future<T?> showLaunchbedBottomSheet<T>(
  BuildContext context, {
  required String title,
  required WidgetBuilder builder,
}) {
  return showModalBottomSheet<T>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          Semantics(
            header: true,
            child: Text(title, style: Theme.of(context).textTheme.titleLarge),
          ),
          builder(context),
        ],
      ),
    ),
  );
}
