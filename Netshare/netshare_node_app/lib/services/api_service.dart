import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/api_constants.dart';

class ApiService {
  static const _timeout = Duration(seconds: 20);

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
  }

  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
  }

  static Future<Map<String, String>> _headers({bool auth = false}) async {
    final headers = {'Content-Type': 'application/json'};

    if (auth) {
      final token = await getToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    return headers;
  }

  static Future<Map<String, dynamic>> get(
    String endpoint, {
    bool auth = false,
  }) async {
    return _request(
      http.get(
        Uri.parse(ApiConstants.baseUrl + endpoint),
        headers: await _headers(auth: auth),
      ),
    );
  }

  static Future<Map<String, dynamic>> post(
    String endpoint,
    Map<String, dynamic> body, {
    bool auth = false,
  }) async {
    return _request(
      http.post(
        Uri.parse(ApiConstants.baseUrl + endpoint),
        headers: await _headers(auth: auth),
        body: jsonEncode(body),
      ),
    );
  }

  static Future<Map<String, dynamic>> put(
    String endpoint,
    Map<String, dynamic> body, {
    bool auth = false,
  }) async {
    return _request(
      http.put(
        Uri.parse(ApiConstants.baseUrl + endpoint),
        headers: await _headers(auth: auth),
        body: jsonEncode(body),
      ),
    );
  }

  static Future<Map<String, dynamic>> _request(
    Future<http.Response> request,
  ) async {
    try {
      return _handleResponse(await request.timeout(_timeout));
    } on TimeoutException {
      throw Exception(
        'Cannot reach the NetShare backend at ${ApiConstants.baseUrl}. '
        'Check the development endpoint and network connection.',
      );
    } on http.ClientException {
      throw Exception(
        'Cannot reach the NetShare backend at ${ApiConstants.baseUrl}. '
        'Check the development endpoint and network connection.',
      );
    }
  }

  static Map<String, dynamic> _handleResponse(http.Response response) {
    Map<String, dynamic> data;
    try {
      data = response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>
          : {};
    } catch (_) {
      throw Exception('Invalid server response (${response.statusCode})');
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    }

    throw Exception(
      data['message'] ??
          (data['error'] is Map ? data['error']['message'] : null) ??
          'Request failed (${response.statusCode})',
    );
  }
}
