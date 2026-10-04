import 'dart:async';
import 'package:http/http.dart' as http;

class TaskExecutionResult {
  final bool success;
  final int statusCode;
  final int latencyMs;
  final double bandwidthUsedMB;
  final double downloadBandwidthMB;
  final double uploadBandwidthMB;
  final int packetLoss;
  final int successRate;
  final Map<String, dynamic> resultData;

  TaskExecutionResult({
    required this.success,
    required this.statusCode,
    required this.latencyMs,
    required this.bandwidthUsedMB,
    required this.downloadBandwidthMB,
    required this.uploadBandwidthMB,
    required this.packetLoss,
    required this.successRate,
    required this.resultData,
  });

  Map<String, dynamic> toMap(String taskId) {
    return {
      'taskId': taskId,
      'success': success,
      'statusCode': statusCode,
      'latencyMs': latencyMs,
      'bandwidthUsedMB': bandwidthUsedMB,
      'downloadBandwidthMB': downloadBandwidthMB,
      'uploadBandwidthMB': uploadBandwidthMB,
      'packetLoss': packetLoss,
      'successRate': successRate,
      'resultData': resultData,
      'completedAt': DateTime.now().toIso8601String(),
    };
  }
}

class TaskExecutorService {
  /// Executes an HTTP Performance test on the target URL
  static Future<TaskExecutionResult> executeHttpPerformanceTest(
    String targetUrl, {
    int timeoutMs = 25000,
  }) async {
    final stopwatch = Stopwatch()..start();

    try {
      final uri = Uri.parse(targetUrl);
      final response = await http
          .get(uri, headers: {
            'User-Agent': 'NetShare-Mobile-Agent/1.0',
            'Accept': '*/*',
          })
          .timeout(Duration(milliseconds: timeoutMs));

      stopwatch.stop();
      final latencyMs = stopwatch.elapsedMilliseconds;
      final bodySizeBytes = response.bodyBytes.length;
      final sizeMB = bodySizeBytes / (1024 * 1024);
      final billedMB = sizeMB < 0.05 ? 0.05 : double.parse(sizeMB.toStringAsFixed(4));

      final isSuccess = response.statusCode >= 200 && response.statusCode < 400;

      return TaskExecutionResult(
        success: isSuccess,
        statusCode: response.statusCode,
        latencyMs: latencyMs,
        bandwidthUsedMB: billedMB,
        downloadBandwidthMB: billedMB,
        uploadBandwidthMB: 0.01,
        packetLoss: 0,
        successRate: isSuccess ? 100 : 50,
        resultData: {
          'statusCode': response.statusCode,
          'contentLengthBytes': bodySizeBytes,
          'latencyMs': latencyMs,
          'headers': response.headers.sublistSafe(),
        },
      );
    } catch (e) {
      stopwatch.stop();
      return TaskExecutionResult(
        success: false,
        statusCode: 500,
        latencyMs: stopwatch.elapsedMilliseconds,
        bandwidthUsedMB: 0.01,
        downloadBandwidthMB: 0.01,
        uploadBandwidthMB: 0.01,
        packetLoss: 100,
        successRate: 0,
        resultData: {'error': e.toString()},
      );
    }
  }

  /// Executes multiple ping probes to calculate average latency and packet loss
  static Future<TaskExecutionResult> executePingTest(
    String targetUrl, {
    int samples = 3,
  }) async {
    final latencies = <int>[];
    int failures = 0;

    for (int i = 0; i < samples; i++) {
      final sample = await executeHttpPerformanceTest(targetUrl, timeoutMs: 5000);
      if (sample.success) {
        latencies.add(sample.latencyMs);
      } else {
        failures++;
      }
      if (i < samples - 1) {
        await Future.delayed(const Duration(milliseconds: 100));
      }
    }

    final packetLoss = ((failures / samples) * 100).round();
    final avgLatency = latencies.isNotEmpty
        ? (latencies.reduce((a, b) => a + b) / latencies.length).round()
        : 500;

    return TaskExecutionResult(
      success: packetLoss < 100,
      statusCode: 200,
      latencyMs: avgLatency,
      bandwidthUsedMB: 0.05,
      downloadBandwidthMB: 0.05,
      uploadBandwidthMB: 0.02,
      packetLoss: packetLoss,
      successRate: 100 - packetLoss,
      resultData: {
        'samples': samples,
        'packetLossPercent': packetLoss,
        'avgLatencyMs': avgLatency,
      },
    );
  }
}

extension SafeMap on Map<String, String> {
  Map<String, String> sublistSafe() {
    final safe = <String, String>{};
    forEach((k, v) {
      if (['content-type', 'server', 'date'].contains(k.toLowerCase())) {
        safe[k] = v;
      }
    });
    return safe;
  }
}
