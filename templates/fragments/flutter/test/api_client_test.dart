import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:{{dartPackage}}/launchbed/network/api_client.dart';

void main() {
  final mock = MockClient((request) async {
    switch (request.url.path) {
      case '/v1/items':
        return http.Response('[{"id":1}]', 200);
      case '/v1/echo':
        return http.Response(request.body, 201);
      case '/v1/bad-json':
        return http.Response('{oops', 200);
      case '/v1/down':
        throw http.ClientException('offline', request.url);
      default:
        return http.Response('missing', 404);
    }
  });

  test('joins the base URL and parses JSON', () async {
    final client = ApiClient(baseUrl: 'https://api.example.test/v1', client: mock);
    final result = await client.getJson('/items');
    expect(result, isA<ApiSuccess<Object?>>());
    expect((result as ApiSuccess<Object?>).value, [
      {'id': 1},
    ]);
    final echoed = await client.postJson('echo', {'name': 'A'});
    expect((echoed as ApiSuccess<Object?>).status, 201);
    expect(echoed.value, {'name': 'A'});
  });

  test('maps HTTP errors, network errors, invalid JSON and timeouts', () async {
    final client = ApiClient(baseUrl: 'https://api.example.test/v1/', client: mock);
    final missing = await client.getText('nope');
    expect(missing, isA<ApiHttpError<String>>());
    expect((missing as ApiHttpError<String>).status, 404);
    expect(await client.getJson('down'), isA<ApiNetworkError<Object?>>());
    expect(await client.getJson('bad-json'), isA<ApiNetworkError<Object?>>());

    final slow = ApiClient(
      baseUrl: 'https://api.example.test/',
      timeout: const Duration(milliseconds: 10),
      client: MockClient((_) => Completer<http.Response>().future),
    );
    expect(await slow.getText('slow'), isA<ApiTimeout<String>>());
  });
}
