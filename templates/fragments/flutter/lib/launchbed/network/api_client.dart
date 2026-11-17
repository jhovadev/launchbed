import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// Outcome of a request: no exceptions leak to the UI layer.
sealed class ApiResult<T> {
  const ApiResult();
}

class ApiSuccess<T> extends ApiResult<T> {
  const ApiSuccess(this.value, this.status);
  final T value;
  final int status;
}

class ApiHttpError<T> extends ApiResult<T> {
  const ApiHttpError(this.status, this.body);
  final int status;
  final String body;
}

class ApiNetworkError<T> extends ApiResult<T> {
  const ApiNetworkError(this.message);
  final String message;
}

class ApiTimeout<T> extends ApiResult<T> {
  const ApiTimeout();
}

/// Provider-neutral HTTP client on package:http. No base URL, API key or backend is
/// bundled: pass your own base URL and keep secrets on your server.
class ApiClient {
  ApiClient({required String baseUrl, http.Client? client, this.timeout = const Duration(seconds: 15)})
      : _base = Uri.parse(baseUrl.endsWith('/') ? baseUrl : '$baseUrl/'),
        _client = client ?? http.Client();

  final Uri _base;
  final http.Client _client;
  final Duration timeout;

  Uri _resolve(String path) => _base.resolve(path.startsWith('/') ? path.substring(1) : path);

  Future<ApiResult<String>> getText(String path) => _send(() => _client.get(_resolve(path), headers: {'Accept': 'application/json'}));

  Future<ApiResult<Object?>> getJson(String path) async => _decode(await getText(path));

  Future<ApiResult<Object?>> postJson(String path, Object? body) async => _decode(await _send(
        () => _client.post(
          _resolve(path),
          headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
          body: jsonEncode(body),
        ),
      ));

  void close() => _client.close();

  Future<ApiResult<String>> _send(Future<http.Response> Function() call) async {
    try {
      final response = await call().timeout(timeout);
      final ok = response.statusCode >= 200 && response.statusCode < 300;
      return ok ? ApiSuccess(response.body, response.statusCode) : ApiHttpError(response.statusCode, response.body);
    } on TimeoutException {
      return const ApiTimeout();
    } on http.ClientException catch (error) {
      return ApiNetworkError(error.message);
    }
  }

  ApiResult<Object?> _decode(ApiResult<String> result) {
    return switch (result) {
      ApiSuccess(:final value, :final status) => _parse(value, status),
      ApiHttpError(:final status, :final body) => ApiHttpError(status, body),
      ApiNetworkError(:final message) => ApiNetworkError(message),
      ApiTimeout() => const ApiTimeout(),
    };
  }

  ApiResult<Object?> _parse(String body, int status) {
    try {
      return ApiSuccess(body.isEmpty ? null : jsonDecode(body), status);
    } on FormatException {
      return const ApiNetworkError('The response was not valid JSON');
    }
  }
}
