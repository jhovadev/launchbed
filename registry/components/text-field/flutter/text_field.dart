import 'package:material_ui/material_ui.dart';

class LaunchbedTextField extends StatefulWidget {
  const LaunchbedTextField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.error,
    this.enabled = true,
  });

  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final String? error;
  final bool enabled;

  @override
  State<LaunchbedTextField> createState() => _LaunchbedTextFieldState();
}

class _LaunchbedTextFieldState extends State<LaunchbedTextField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
  }

  @override
  void didUpdateWidget(LaunchbedTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value && _controller.text != widget.value) {
      _controller.value = TextEditingValue(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      onChanged: widget.onChanged,
      enabled: widget.enabled,
      decoration: InputDecoration(
        labelText: labelForDecoration,
        errorText: widget.error,
        border: const OutlineInputBorder(),
      ),
    );
  }

  String get labelForDecoration => widget.label;
}
