import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'vpn_service.dart';

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
  static const blockedHostnames = [
    'localhost',
    'metadata.google.internal',
    'metadata.gke.internal',
  ];

  static const blockedExactIps = [
    '127.0.0.1',
    '169.254.169.254',
    '::1',
    'fe80::1',
    '0.0.0.0',
  ];

  /// Checks if an IPv4 address is in private (RFC1918) or loopback/link-local ranges
  static bool isPrivateOrBlockedIp(String ip) {
    if (blockedExactIps.contains(ip)) return true;

    final parts = ip.split('.').map(int.tryParse).toList();
    if (parts.length != 4 || parts.any((p) => p == null || p < 0 || p > 255)) {
      return false; // not a standard IPv4
    }

    final p0 = parts[0]!;
    final p1 = parts[1]!;

    // 127.0.0.0/8 loopback
    if (p0 == 127) return true;
    // 10.0.0.0/8 RFC1918
    if (p0 == 10) return true;
    // 172.16.0.0/12 RFC1918
    if (p0 == 172 && p1 >= 16 && p1 <= 31) return true;
    // 192.168.0.0/16 RFC1918
    if (p0 == 192 && p1 == 168) return true;
    // 169.254.0.0/16 Link-local / metadata
    if (p0 == 169 && p1 == 254) return true;
    // 0.0.0.0/8
    if (p0 == 0) return true;

    return false;
  }

  /// Node-side validation before initiating any network request
  static Future<String?> validateTarget(
    String targetUrl, {
    String? authorizedHost,
    int? authorizedPort,
    String? authorizedMethod,
  }) async {
    Uri uri;
    try {
      uri = Uri.parse(targetUrl);
    } catch (_) {
      return 'Malformed target URL';
    }

    if (!['http', 'https'].contains(uri.scheme.toLowerCase())) {
      return 'Unsupported protocol ${uri.scheme}. Only HTTP/HTTPS permitted.';
    }

    final host = uri.host.toLowerCase();
    if (host.isEmpty) return 'Empty hostname in target URL';

    if (blockedHostnames.contains(host) || blockedExactIps.contains(host)) {
      return 'Target host is blocked (internal/loopback/cloud metadata)';
    }

    if (authorizedHost != null && host != authorizedHost.toLowerCase()) {
      return 'Target host does not match authorized host ($authorizedHost)';
    }

    final defaultPort = uri.scheme.toLowerCase() == 'https' ? 443 : 80;
    final port = uri.hasPort ? uri.port : defaultPort;
    final allowedPorts = authorizedPort != null ? [authorizedPort] : [80, 443, 8080, 8443];

    if (!allowedPorts.contains(port)) {
      return 'Unauthorized port $port';
    }

    // Check raw IP
    if (isPrivateOrBlockedIp(host)) {
      return 'Direct targeting of private/loopback/metadata IP is strictly blocked';
    }

    // DNS resolution anti-SSRF verification
    try {
      final lookup = await InternetAddress.lookup(host);
      if (lookup.isEmpty) return 'DNS resolution returned no addresses';

      for (final addr in lookup) {
        if (isPrivateOrBlockedIp(addr.address)) {
          return 'DNS rebinding guard: host resolves to private/reserved IP ${addr.address}';
        }
      }
    } catch (e) {
      return 'DNS lookup failed: $e';
    }

    return null; // Valid
  }

  /// Executes an HTTP Performance test on the target URL
  static Future<TaskExecutionResult> executeHttpPerformanceTest(
    String targetUrl, {
    int timeoutMs = 25000,
    String? authorizedHost,
    int? authorizedPort,
    String? authorizedMethod,
  }) async {
    // 1. Independent node-side target validation
    final validationError = await validateTarget(
      targetUrl,
      authorizedHost: authorizedHost,
      authorizedPort: authorizedPort,
      authorizedMethod: authorizedMethod,
    );

    if (validationError != null) {
      return TaskExecutionResult(
        success: false,
        statusCode: 403,
        latencyMs: 0,
        bandwidthUsedMB: 0.01,
        downloadBandwidthMB: 0.01,
        uploadBandwidthMB: 0.01,
        packetLoss: 100,
        successRate: 0,
        resultData: {'error': 'Security rejected target: $validationError'},
      );
    }

    final stopwatch = Stopwatch()..start();

    try {
      final uri = Uri.parse(targetUrl);
      final client = http.Client();

      // Query TUN metrics before request
      final tunBefore = await NetShareVpnBridge.getTunMetrics();

      final request = http.Request(authorizedMethod ?? 'GET', uri)
        ..headers['User-Agent'] = 'NetShare-Mobile-Agent/1.0'
        ..headers['Accept'] = '*/*';

      final streamedResponse = await client
          .send(request)
          .timeout(Duration(milliseconds: timeoutMs));

      final response = await http.Response.fromStream(streamedResponse);
      stopwatch.stop();

      // Query TUN metrics after request
      final tunAfter = await NetShareVpnBridge.getTunMetrics();

      final latencyMs = stopwatch.elapsedMilliseconds;
      final bodySizeBytes = response.bodyBytes.length;
      final sizeMB = bodySizeBytes / (1024 * 1024);
      final billedMB = sizeMB < 0.05 ? 0.05 : double.parse(sizeMB.toStringAsFixed(4));

      final isSuccess = response.statusCode >= 200 && response.statusCode < 400;

      final packetsInDelta =
          ((tunAfter['packetsIn'] as num?) ?? 0) - ((tunBefore['packetsIn'] as num?) ?? 0);
      final bytesInDelta =
          ((tunAfter['bytesIn'] as num?) ?? 0) - ((tunBefore['bytesIn'] as num?) ?? 0);

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
          'tunForwarding': {
            'active': tunAfter['state'] == 'connected',
            'packetsInDelta': packetsInDelta,
            'bytesInDelta': bytesInDelta,
            'packetsIn': tunAfter['packetsIn'],
            'bytesIn': tunAfter['bytesIn'],
          },
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
    String? authorizedHost,
    int? authorizedPort,
  }) async {
    final latencies = <int>[];
    int failures = 0;

    for (int i = 0; i < samples; i++) {
      final sample = await executeHttpPerformanceTest(
        targetUrl,
        timeoutMs: 5000,
        authorizedHost: authorizedHost,
        authorizedPort: authorizedPort,
      );
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
