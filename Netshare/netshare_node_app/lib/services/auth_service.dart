import '../core/constants/api_constants.dart';
import 'api_service.dart';
import 'foreground_node_service.dart';

class AuthService {
  static Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String phone,
    required String password,
    String role = 'node_participant',
  }) async {
    final data = await ApiService.post(ApiConstants.register, {
      'name': name,
      'email': email,
      'phone': phone,
      'password': password,
      'role': role,
    });
    return data;
  }

  static Future<Map<String, dynamic>> verifySignupOtp({
    required String email,
    required String otp,
  }) async {
    final data = await ApiService.post(ApiConstants.verifySignupOtp, {
      'email': email,
      'otp': otp,
    });

    if (data['token'] != null) {
      await ApiService.saveToken(data['token']);
    }

    return data;
  }

  static Future<Map<String, dynamic>> resendSignupOtp({
    required String email,
  }) async {
    return await ApiService.post(ApiConstants.resendSignupOtp, {
      'email': email,
    });
  }

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final data = await ApiService.post(ApiConstants.login, {
      'email': email,
      'password': password,
    });

    if (data['token'] != null) {
      await ApiService.saveToken(data['token']);
    }

    return data;
  }

  static Future<Map<String, dynamic>> forgotPassword({
    required String email,
  }) async {
    return await ApiService.post(ApiConstants.forgotPassword, {
      'email': email,
    });
  }

  static Future<Map<String, dynamic>> verifyResetOtp({
    required String email,
    required String otp,
  }) async {
    return await ApiService.post(ApiConstants.verifyResetOtp, {
      'email': email,
      'otp': otp,
    });
  }

  static Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    return await ApiService.post(ApiConstants.resetPassword, {
      'email': email,
      'otp': otp,
      'newPassword': newPassword,
    });
  }

  static Future<Map<String, dynamic>> getMe() async {
    return ApiService.get(ApiConstants.me, auth: true);
  }

  static Future<void> logout() async {
    await ForegroundNodeService.stop();
    await ApiService.clearToken();
  }
}
