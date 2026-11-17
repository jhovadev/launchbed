import 'package:material_ui/material_ui.dart';

import '../../ui/components/app_bar.dart';
import '../../ui/components/list_item.dart';
import '../notes/notes_repository.dart';
import 'note_editor_screen.dart';

String _preview(String body) {
  final line = body.split('\n').firstWhere((part) => part.trim().isNotEmpty, orElse: () => '');
  return line.length > 80 ? '${line.substring(0, 79)}…' : line;
}

/// Notes list saved on the device. Mirrors the Compose NotesScreen (Room) with shared_preferences.
class NotesScreen extends StatelessWidget {
  const NotesScreen({super.key});

  void _open(BuildContext context, [String? id]) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => NoteEditorScreen(noteId: id)));
  }

  @override
  Widget build(BuildContext context) {
    final notes = NotesScope.of(context).notes;
    final theme = Theme.of(context);
    return Scaffold(
      appBar: const LaunchbedAppBar(title: 'Notes'),
      floatingActionButton: FloatingActionButton(
        tooltip: 'New note',
        onPressed: () => _open(context),
        child: const Icon(Icons.add),
      ),
      body: notes.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('No notes yet', style: theme.textTheme.titleMedium),
                    const SizedBox(height: 8),
                    Text(
                      'Tap + to write your first note. Notes stay on this device.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              children: [
                Card.filled(
                  child: Column(
                    children: [
                      for (final note in notes)
                        LaunchbedListItem(
                          title: note.title.isEmpty ? 'Untitled' : note.title,
                          subtitle: _preview(note.body).isEmpty ? null : _preview(note.body),
                          onTap: () => _open(context, note.id),
                        ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
