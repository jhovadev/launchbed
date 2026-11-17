import 'package:flutter_test/flutter_test.dart';
import 'package:{{dartPackage}}/launchbed/notes/notes_repository.dart';
import 'package:{{dartPackage}}/launchbed/storage/key_value_store.dart';

NotesRepository _repository(KeyValueStore store) {
  var clock = 1000;
  var id = 0;
  return NotesRepository(store, now: () => clock += 10, newId: () => 'note-${++id}');
}

void main() {
  test('creates, lists newest first, updates and deletes', () async {
    final notes = _repository(MemoryKeyValueStore());
    await notes.load();
    final first = await notes.save(title: 'Groceries', body: 'Milk');
    final second = await notes.save(title: 'Ideas', body: '');
    expect(notes.notes.map((note) => note.id), [second.id, first.id]);
    await notes.save(id: first.id, title: 'Groceries', body: 'Milk, eggs');
    expect(notes.notes.first.body, 'Milk, eggs');
    await notes.remove(second.id);
    expect(notes.notes.map((note) => note.id), [first.id]);
  });

  test('persists across restarts and ignores corrupt data', () async {
    final store = MemoryKeyValueStore();
    final notes = _repository(store);
    await notes.load();
    await notes.save(title: 'Kept', body: 'after restart');
    final restarted = _repository(store);
    await restarted.load();
    expect(restarted.notes.single.title, 'Kept');

    final corrupt = _repository(MemoryKeyValueStore({NotesRepository.storageKey: '{oops'}));
    await corrupt.load();
    expect(corrupt.notes, isEmpty);
  });

  test('rejects empty notes like the Compose editor', () async {
    expect(validateNote(' ', ''), 'Write a title or some text');
    expect(validateNote('', 'x'), isNull);
    final notes = _repository(MemoryKeyValueStore());
    expect(() => notes.save(title: '', body: ' '), throwsArgumentError);
  });
}
