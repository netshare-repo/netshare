import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/constants/api_constants.dart';
import 'api_service.dart';

class ClientApiException implements Exception {
  final int status;
  final String message;
  const ClientApiException(this.status, this.message);
  @override
  String toString() => message;
}

class ClientApi {
  final String role;
  final http.Client _http;
  final Future<String?> Function() tokenProvider;
  final String baseUrl;
  ClientApi({
    required this.role,
    http.Client? client,
    Future<String?> Function()? tokenProvider,
    String? baseUrl,
  }) : _http = client ?? http.Client(),
       tokenProvider = tokenProvider ?? ApiService.getToken,
       baseUrl = baseUrl ?? ApiConstants.baseUrl;
  static bool canUseClient(String role) =>
      role == 'platform_client' || role == 'both';
  void close() => _http.close();
  void requireClient() {
    if (!canUseClient(role)) {
      throw const ClientApiException(403, 'Platform Client role required.');
    }
  }

  Future<http.Response> _request(
    String method,
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    final token = await tokenProvider();
    if (token == null || token.isEmpty) {
      throw const ClientApiException(401, 'Sign in again to continue.');
    }
    final headers = {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
    final uri = Uri.parse('$baseUrl$path');
    final response =
        await (method == 'GET'
                ? _http.get(uri, headers: headers)
                : method == 'PUT'
                ? _http.put(uri, headers: headers, body: jsonEncode(body ?? {}))
                : _http.post(
                    uri,
                    headers: headers,
                    body: jsonEncode(body ?? {}),
                  ))
            .timeout(const Duration(seconds: 20));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      String message = response.statusCode == 401
          ? 'Session expired. Sign in again.'
          : 'Request failed (${response.statusCode}).';
      try {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        message =
            data['message']?.toString() ??
            (data['error'] is Map
                ? data['error']['message']?.toString()
                : null) ??
            message;
      } catch (_) {
        /* Non-JSON failures keep a safe message. */
      }
      throw ClientApiException(response.statusCode, message);
    }
    return response;
  }

  Future<Map<String, dynamic>> _json(
    String method,
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    final response = await _request(method, path, body);
    try {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw const ClientApiException(
        502,
        'Invalid server response. Please retry.',
      );
    }
  }

  Future<Map<String, dynamic>> dashboard() async {
    requireClient();
    return _json('GET', '/tasks/client/dashboard');
  }

  Future<Map<String, dynamic>> tasks() async {
    requireClient();
    return _json('GET', '/tasks/my-tasks');
  }

  Future<Map<String, dynamic>> task(String id) async {
    requireClient();
    return _json('GET', '/tasks/${Uri.encodeComponent(id)}');
  }

  Future<Map<String, dynamic>> regions() async {
    requireClient();
    return _json('GET', '/node/availability');
  }

  Future<Map<String, dynamic>> estimate(String region, int executions) async {
    requireClient();
    return _json('POST', '/tasks/estimate', {
      'targetRegion': region,
      'executionLimit': executions,
    });
  }

  Future<Map<String, dynamic>> submitTask(Map<String, dynamic> input) async {
    requireClient();
    return _json('POST', '/tasks', input);
  }

  Future<Map<String, dynamic>> rate(
    String id,
    int rating,
    String comment,
  ) async {
    requireClient();
    return _json('POST', '/tasks/${Uri.encodeComponent(id)}/rating', {
      'rating': rating,
      'comment': comment,
    });
  }

  Future<String> report(String id) async {
    requireClient();
    return (await _request(
      'GET',
      '/tasks/${Uri.encodeComponent(id)}/report.csv',
    )).body;
  }

  Future<Map<String, dynamic>> wallet() => _json('GET', '/wallet');
  Future<Map<String, dynamic>> history() =>
      _json('GET', '/wallet/transactions');
  Future<Map<String, dynamic>> topups() => _json('GET', '/wallet/top-ups');
  Future<Map<String, dynamic>> submitTopup(Map<String, dynamic> input) =>
      _json('POST', '/wallet/top-ups', input);
  Future<Map<String, dynamic>> notifications(int offset) =>
      _json('GET', '/notifications?offset=$offset');
  Future<Map<String, dynamic>> markRead(String id) =>
      _json('PUT', '/notifications/${Uri.encodeComponent(id)}/read');
  Future<Map<String, dynamic>> markAllRead() =>
      _json('PUT', '/notifications/read-all');
}
