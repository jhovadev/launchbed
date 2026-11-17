import 'dart:convert';

import 'package:material_ui/material_ui.dart';

import '../storage/key_value_store.dart';

class Note {
  const Note({required this.id, required this.title, required this.body, required this.updatedAt});

  final String id;
  final String title;
  final String body;

  /// Milliseconds since epoch.
  final int updatedAt;

  Map<String, Object?> toJson() => {'id': id, 'title': title, 'body': body, 'updatedAt': updatedAt};

  static Note? fromJson(Object? json) {
    if (json is! Map<String, Object?>) return null;
    final id = json['id'], title = json['title'], body = json['body'], updatedAt = json['updatedAt'];
    if (id is! String || title is! String || body is! String || updatedAt is! int) return null;
    return Note(id: id, title: title, body: body, updatedAt: updatedAt);
  }
}

/// Same rule as the Compose notes editor: a note needs a title or some text.
String? validateNote(String title, String body) =>
    title.trim().isEmpty && body.trim().isEmpty ? 'Write a title or some text' : null;

/// Notes kept as one JSON document in a [KeyValueStore] (shared_preferences on device).
/// Fine for hundreds of notes; move to drift or sqflite when you need queries or search.
class NotesRepository extends ChangeNotifier {
  NotesRepository(this._store, {int Function()? now, this.newId})
      : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  static const String storageKey = 'launchbed.notes.v1';

  final KeyValueStore _store;
  final int Function() _now;
  /// Id factory for tests; defaults to a time-based id.
  final String Function()? newId;
  int _counter = 0;
  List<Note> _notes = const [];

  /// Newest first.
  List<Note> get notes => _notes;

  Note? byId(String id) => _notes.where((note) => note.id == id).firstOrNull;

  Future<void> load() async {
    try {
      final data = jsonDecode(await _store.read(storageKey) ?? '[]');
      _notes = data is List ? data.map(Note.fromJson).whereType<Note>().toList() : [];
    } catch (_) {
      _notes = [];
    }
    _sort();
    notifyListeners();
  }

  Future<Note> save({String? id, required String title, required String body}) async {
    final problem = validateNote(title, body);
    if (problem != null) throw ArgumentError(problem);
    final note = Note(
      id: id ?? newId?.call() ?? '${_now().toRadixString(36)}-${(_counter++).toRadixString(36)}',
      title: title.trim(),
      body: body.trim(),
      updatedAt: _now(),
    );
    _notes = [note, ..._notes.where((existing) => existing.id != note.id)];
    await _commit();
    return note;
  }

  Future<void> remove(String id) async {
    _notes = _notes.where((note) => note.id != id).toList();
    await _commit();
  }

  void _sort() => _notes = [..._notes]..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

  Future<void> _commit() async {
    _sort();
    notifyListeners();
    await _store.write(storageKey, jsonEncode(_notes.map((note) => note.toJson()).toList()));
  }
}

/// Makes the [NotesRepository] available to the notes screens.
class NotesScope extends InheritedNotifier<NotesRepository> {
  const NotesScope({super.key, required NotesRepository notes, required super.child}) : super(notifier: notes);

  static NotesRepository of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<NotesScope>();
    assert(scope != null, 'NotesScope.of() called outside LaunchbedApp');
    return scope!.notifier!;
  }
}
