import '../core/constants/api_constants.dart';
import 'api_service.dart';

class MarketplaceService {
  static Future<Map<String, dynamic>> getProducts() {
    return ApiService.get(ApiConstants.marketplaceProducts, auth: true);
  }

  static Future<Map<String, dynamic>> getProductById(String productId) {
    return ApiService.get(
      '${ApiConstants.marketplaceProducts}/$productId',
      auth: true,
    );
  }

  static Future<Map<String, dynamic>> createOrder(String productId) {
    return ApiService.post(
      ApiConstants.marketplaceOrders,
      {
        'productId': productId,
      },
      auth: true,
    );
  }

  static Future<Map<String, dynamic>> getMyOrders() {
    return ApiService.get(ApiConstants.myMarketplaceOrders, auth: true);
  }
}