import 'package:shared_preferences/shared_preferences.dart';

import 'key_value_store.dart';

/// Device storage backed by shared_preferences (SharedPreferences on Android, NSUserDefaults
/// on iOS, localStorage on web). Unencrypted: never store passwords or tokens here.
class SharedPreferencesStore implements KeyValueStore {
  Future<SharedPreferences> get _prefs => SharedPreferences.getInstance();

  @override
  Future<String?> read(String key) async => (await _prefs).getString(key);

  @override
  Future<void> write(String key, String value) async {
    await (await _prefs).setString(key, value);
  }

  @override
  Future<void> delete(String key) async {
    await (await _prefs).remove(key);
  }
}
