import 'package:flutter_test/flutter_test.dart';
import 'package:{{dartPackage}}/launchbed/storage/key_value_store.dart';
import 'package:{{dartPackage}}/launchbed/storage/shared_preferences_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  for (final entry in <String, KeyValueStore Function()>{
    'memory': MemoryKeyValueStore.new,
    'shared_preferences': () {
      SharedPreferences.setMockInitialValues({});
      return SharedPreferencesStore();
    },
  }.entries) {
    test('${entry.key} store: set, overwrite, read and delete', () async {
      final store = entry.value();
      expect(await store.read('theme'), isNull);
      await store.write('theme', 'dark');
      await store.write('theme', 'light');
      expect(await store.read('theme'), 'light');
      await store.delete('theme');
      expect(await store.read('theme'), isNull);
    });
  }
}
