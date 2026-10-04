import '../core/constants/api_constants.dart';
import 'api_service.dart';

class NodeService {
  static Future<Map<String, dynamic>> registerNode({
    required String deviceName,
    required String deviceId,
    required String region,
    required int bandwidthLimitMB,
    required int speedCapMbps,
    required int maxConcurrentTasks,
  }) {
    return ApiService.post(
      ApiConstants.registerNode,
      {
        'deviceName': deviceName,
        'deviceId': deviceId,
        'region': region,
        'bandwidthLimitMB': bandwidthLimitMB,
        'speedCapMbps': speedCapMbps,
        'maxConcurrentTasks': maxConcurrentTasks,
      },
      auth: true,
    );
  }

  static Future<Map<String, dynamic>> getMyNode() {
    return ApiService.get(ApiConstants.myNode, auth: true);
  }

  static Future<Map<String, dynamic>> updateSettings({
    required String region,
    required int bandwidthLimitMB,
    required int speedCapMbps,
    required int maxConcurrentTasks,
  }) {
    return ApiService.put(
      ApiConstants.nodeSettings,
      {
        'region': region,
        'bandwidthLimitMB': bandwidthLimitMB,
        'speedCapMbps': speedCapMbps,
        'maxConcurrentTasks': maxConcurrentTasks,
      },
      auth: true,
    );
  }

  static Future<Map<String, dynamic>> startParticipation() {
    return ApiService.put(ApiConstants.startNode, {}, auth: true);
  }

  static Future<Map<String, dynamic>> stopParticipation() {
    return ApiService.put(ApiConstants.stopNode, {}, auth: true);
  }

  static Future<Map<String, dynamic>> getAssignedTask() {
    return ApiService.get(ApiConstants.assignedTask, auth: true);
  }
}