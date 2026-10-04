import '../core/constants/api_constants.dart';
import 'api_service.dart';

class WalletService {
  static Future<Map<String, dynamic>> getWallet() {
    return ApiService.get(ApiConstants.wallet, auth: true);
  }

  static Future<Map<String, dynamic>> getTransactions() {
    return ApiService.get(ApiConstants.transactions, auth: true);
  }
}