import 'package:material_ui/material_ui.dart';

class LaunchbedAppBar extends StatelessWidget implements PreferredSizeWidget {
  const LaunchbedAppBar({
    super.key,
    required this.title,
    this.onBack,
  });

  final String title;
  final VoidCallback? onBack;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title),
      automaticallyImplyLeading: false,
      leading: onBack == null
          ? null
          : IconButton(
              tooltip: 'Navigate back',
              icon: const BackButtonIcon(),
              onPressed: onBack,
            ),
    );
  }
}
