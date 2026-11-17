/// Minimal async key-value contract. [SharedPreferencesStore] implements it on device and
/// web; tests use [MemoryKeyValueStore]. Keep app code on this interface so the backend can
/// be swapped (flutter_secure_storage for secrets, drift/sqflite for larger data).
abstract interface class KeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// In-memory store for tests and previews.
class MemoryKeyValueStore implements KeyValueStore {
  MemoryKeyValueStore([Map<String, String>? initial]) : values = {...?initial};

  final Map<String, String> values;

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> delete(String key) async => values.remove(key);
}
