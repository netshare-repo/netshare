import 'api_service.dart';

class TaskService {
  static Future<Map<String, dynamic>> startTask(String taskId) {
    return ApiService.put('/api/tasks/$taskId/start', {}, auth: true);
  }

  static Future<Map<String, dynamic>> completeTask({
    required String taskId,
    int bandwidthUsedMB = 50,
    int latencyMs = 120,
    int successRate = 100,
  }) {
    return ApiService.put(
      '/api/tasks/$taskId/complete',
      {
        'bandwidthUsedMB': bandwidthUsedMB,
        'latencyMs': latencyMs,
        'successRate': successRate,
      },
      auth: true,
    );
  }

  static Future<Map<String, dynamic>> failTask({
    required String taskId,
    required String reason,
  }) {
    return ApiService.put(
      '/api/tasks/$taskId/fail',
      {'reason': reason},
      auth: true,
    );
  }
}