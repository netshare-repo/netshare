import '../core/constants/api_constants.dart';
import 'api_service.dart';

class UserService {
  static Future<Map<String, dynamic>> getProfile() {
    return ApiService.get(ApiConstants.profile, auth: true);
  }

  static Future<Map<String, dynamic>> updateProfile({
    required String name,
    required String phone,
    String profileImage = '',
  }) {
    return ApiService.put(
      ApiConstants.profile,
      {
        'name': name,
        'phone': phone,
        'profileImage': profileImage,
      },
      auth: true,
    );
  }

  static Future<Map<String, dynamic>> changePassword({
    required String oldPassword,
    required String newPassword,
  }) {
    return ApiService.put(
      ApiConstants.changePassword,
      {
        'oldPassword': oldPassword,
        'newPassword': newPassword,
      },
      auth: true,
    );
  }
}