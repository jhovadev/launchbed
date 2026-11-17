import 'dart:convert';

import '../auth/fake_auth_repository.dart';
import 'key_value_store.dart';

enum AppearancePreference { system, light, dark }

/// What survives an app restart. Never includes passwords.
class PersistedSession {
  const PersistedSession({
    this.onboardingSeen = false,
    this.user,
    this.appearance = AppearancePreference.system,
    this.notifications = true,
  });

  static const String storageKey = 'launchbed.session.v1';

  final bool onboardingSeen;
  final AuthUser? user;
  final AppearancePreference appearance;
  final bool notifications;

  Map<String, Object?> toJson() => {
        'onboardingSeen': onboardingSeen,
        'user': user == null ? null : {'email': user!.email, 'displayName': user!.displayName},
        'appearance': appearance.name,
        'notifications': notifications,
      };

  /// Validates stored JSON field by field; anything unexpected falls back to the default.
  static PersistedSession parse(String? raw) {
    if (raw == null || raw.isEmpty) return const PersistedSession();
    Object? data;
    try {
      data = jsonDecode(raw);
    } on FormatException {
      return const PersistedSession();
    }
    if (data is! Map<String, Object?>) return const PersistedSession();
    final user = data['user'];
    final storedAppearance = data['appearance'];
    final appearance = AppearancePreference.values.where((value) => value.name == storedAppearance);
    return PersistedSession(
      onboardingSeen: data['onboardingSeen'] == true,
      user: user is Map<String, Object?> && user['email'] is String && user['displayName'] is String
          ? AuthUser(email: user['email']! as String, displayName: user['displayName']! as String)
          : null,
      appearance: appearance.isEmpty ? AppearancePreference.system : appearance.first,
      notifications: data['notifications'] is bool ? data['notifications']! as bool : true,
    );
  }

  static Future<PersistedSession> load(KeyValueStore store) async {
    try {
      return parse(await store.read(storageKey));
    } catch (_) {
      return const PersistedSession();
    }
  }

  Future<void> save(KeyValueStore store) => store.write(storageKey, jsonEncode(toJson()));
}
