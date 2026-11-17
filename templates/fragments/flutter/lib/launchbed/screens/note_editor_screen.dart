import 'package:material_ui/material_ui.dart';

import '../../ui/components/app_bar.dart';
import '../../ui/components/button.dart';
import '../notes/notes_repository.dart';

/// Create or edit a note. Without [noteId] it creates a new one.
class NoteEditorScreen extends StatefulWidget {
  const NoteEditorScreen({super.key, this.noteId});

  final String? noteId;

  @override
  State<NoteEditorScreen> createState() => _NoteEditorScreenState();
}

class _NoteEditorScreenState extends State<NoteEditorScreen> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  String? _error;
  bool _loaded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loaded) return;
    final id = widget.noteId;
    final note = id == null ? null : NotesScope.of(context).byId(id);
    _title.text = note?.title ?? '';
    _body.text = note?.body ?? '';
    _loaded = true;
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final problem = validateNote(_title.text, _body.text);
    setState(() => _error = problem);
    if (problem != null) return;
    await NotesScope.of(context).save(id: widget.noteId, title: _title.text, body: _body.text);
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _delete() async {
    final id = widget.noteId;
    if (id != null) await NotesScope.of(context).remove(id);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: LaunchbedAppBar(title: widget.noteId == null ? 'New note' : 'Edit note', onBack: () => Navigator.of(context).pop()),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: _title, decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          TextField(
            controller: _body,
            minLines: 6,
            maxLines: 12,
            decoration: const InputDecoration(labelText: 'Note', alignLabelWithHint: true, border: OutlineInputBorder()),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          LaunchbedButton(label: 'Save', onPressed: _save),
          if (widget.noteId != null) ...[
            const SizedBox(height: 8),
            LaunchbedButton(label: 'Delete', variant: LaunchbedButtonVariant.outlined, onPressed: _delete),
          ],
        ],
      ),
    );
  }
}
