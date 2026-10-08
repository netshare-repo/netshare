import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/api_constants.dart';

class ApiService {
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
    final headers = {
      'Content-Type': 'application/json',
    };

    if (auth) {
      final token = await getToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    return headers;
  }

  static Future<Map<String, dynamic>> get(String endpoint, {bool auth = false}) async {
    final response = await http.get(
      Uri.parse(ApiConstants.baseUrl + endpoint),
      headers: await _headers(auth: auth),
    ).timeout(const Duration(seconds: 20));

    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> post(
    String endpoint,
    Map<String, dynamic> body, {
    bool auth = false,
  }) async {
    final response = await http.post(
      Uri.parse(ApiConstants.baseUrl + endpoint),
      headers: await _headers(auth: auth),
      body: jsonEncode(body),
    ).timeout(const Duration(seconds: 20));

    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> put(
    String endpoint,
    Map<String, dynamic> body, {
    bool auth = false,
  }) async {
    final response = await http.put(
      Uri.parse(ApiConstants.baseUrl + endpoint),
      headers: await _headers(auth: auth),
      body: jsonEncode(body),
    ).timeout(const Duration(seconds: 20));

    return _handleResponse(response);
  }

  static Map<String, dynamic> _handleResponse(http.Response response) {
    Map<String, dynamic> data;
    try { data = response.body.isNotEmpty ? jsonDecode(response.body) as Map<String, dynamic> : {}; }
    catch (_) { throw Exception('Invalid server response (${response.statusCode})'); }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    }

    throw Exception(data['message'] ?? (data['error'] is Map ? data['error']['message'] : null) ?? 'Request failed (${response.statusCode})');
  }
}
