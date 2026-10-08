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
  final int? packetLoss;
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

    final method = (authorizedMethod ?? 'GET').toUpperCase();
    if (!['GET', 'HEAD'].contains(method)) {
      return 'Unauthorized HTTP method $method. Only GET/HEAD permitted.';
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
    final allowedPorts = authorizedPort != null
        ? [authorizedPort]
        : [80, 443, 8080, 8443];

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

  /// Resolves the already-authorized target to the public IPv4 addresses that
  /// may be installed as task-specific /32 routes in Android VpnService.
  static Future<List<String>> resolveAuthorizedIpv4(
    String targetUrl, {
    required String authorizedHost,
    required int authorizedPort,
    required String authorizedMethod,
  }) async {
    final error = await validateTarget(
      targetUrl,
      authorizedHost: authorizedHost,
      authorizedPort: authorizedPort,
      authorizedMethod: authorizedMethod,
    );
    if (error != null) throw StateError(error);

    final addresses = await InternetAddress.lookup(authorizedHost);
    final ipv4 = addresses
        .where((address) => address.type == InternetAddressType.IPv4)
        .map((address) => address.address)
        .toSet()
        .toList(growable: false);
    if (ipv4.isEmpty) {
      throw StateError('Authorized host has no supported public IPv4 address');
    }
    return ipv4;
  }

  /// Validate every redirect against both SSRF policy and the immutable task
  /// authorization envelope. Cross-host/port redirects are never followed.
  static Future<String?> validateRedirect(
    String originalUrl,
    String redirectLocation, {
    required String authorizedHost,
    required int authorizedPort,
    String authorizedMethod = 'GET',
  }) async {
    Uri resolved;
    try {
      resolved = Uri.parse(originalUrl).resolve(redirectLocation);
    } catch (_) {
      return 'Invalid redirect URL';
    }

    final error = await validateTarget(
      resolved.toString(),
      authorizedHost: authorizedHost,
      authorizedPort: authorizedPort,
      authorizedMethod: authorizedMethod,
    );
    return error == null ? null : 'Unsafe redirect blocked: $error';
  }

  /// Executes an HTTP Performance test on the target URL
  static Future<TaskExecutionResult> executeHttpPerformanceTest(
    String targetUrl, {
    int timeoutMs = 25000,
    String? authorizedHost,
    int? authorizedPort,
    String? authorizedMethod,
    int maxRedirects = 3,
    bool requireTunForwarding = false,
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
        bandwidthUsedMB: 0,
        downloadBandwidthMB: 0,
        uploadBandwidthMB: 0,
        packetLoss: null,
        successRate: 0,
        resultData: {'error': 'Security rejected target: $validationError'},
      );
    }

    if (requireTunForwarding) {
      final status = await NetShareVpnBridge.getStatus();
      if (!status.isRunning || status.state != VpnState.connected) {
        return TaskExecutionResult(
          success: false,
          statusCode: 503,
          latencyMs: 0,
          bandwidthUsedMB: 0,
          downloadBandwidthMB: 0,
          uploadBandwidthMB: 0,
          packetLoss: null,
          successRate: 0,
          resultData: const {
            'error': 'Authorized VpnService route is not active',
          },
        );
      }
    }

    final stopwatch = Stopwatch()..start();

    final client = http.Client();
    try {
      var uri = Uri.parse(targetUrl);
      var redirectCount = 0;
      final method = (authorizedMethod ?? 'GET').toUpperCase();

      // Query TUN metrics before request
      final tunBefore = await NetShareVpnBridge.getTunMetrics();

      late http.Response response;
      while (true) {
        final request = http.Request(method, uri)
          ..followRedirects = false
          ..maxRedirects = 0
          ..headers['User-Agent'] = 'NetShare-Mobile-Agent/1.0'
          ..headers['Accept'] = '*/*';

        final streamedResponse = await client
            .send(request)
            .timeout(Duration(milliseconds: timeoutMs));

        final location = streamedResponse.headers['location'];
        final isRedirect =
            const [
              301,
              302,
              303,
              307,
              308,
            ].contains(streamedResponse.statusCode) &&
            location != null;

        if (!isRedirect) {
          response = await http.Response.fromStream(
            streamedResponse,
          ).timeout(Duration(milliseconds: timeoutMs));
          break;
        }

        await streamedResponse.stream.drain<void>().timeout(
          Duration(milliseconds: timeoutMs),
        );
        if (redirectCount >= maxRedirects) {
          return TaskExecutionResult(
            success: false,
            statusCode: 310,
            latencyMs: stopwatch.elapsedMilliseconds,
            bandwidthUsedMB: 0,
            downloadBandwidthMB: 0,
            uploadBandwidthMB: 0,
            packetLoss: null,
            successRate: 0,
            resultData: const {'error': 'Exceeded maximum redirect limit'},
          );
        }

        final redirectError = await validateRedirect(
          uri.toString(),
          location,
          authorizedHost: authorizedHost!,
          authorizedPort: authorizedPort!,
          authorizedMethod: method,
        );
        if (redirectError != null) {
          return TaskExecutionResult(
            success: false,
            statusCode: 403,
            latencyMs: stopwatch.elapsedMilliseconds,
            bandwidthUsedMB: 0,
            downloadBandwidthMB: 0,
            uploadBandwidthMB: 0,
            packetLoss: null,
            successRate: 0,
            resultData: {'error': redirectError},
          );
        }

        uri = uri.resolve(location);
        redirectCount += 1;
      }
      stopwatch.stop();

      // Query TUN metrics after request
      final tunAfter = await NetShareVpnBridge.getTunMetrics();

      final latencyMs = stopwatch.elapsedMilliseconds;
      final bodySizeBytes = response.bodyBytes.length;
      final sizeMB = bodySizeBytes / (1024 * 1024);

      final packetsInDelta =
          ((tunAfter['packetsIn'] as num?) ?? 0) -
          ((tunBefore['packetsIn'] as num?) ?? 0);
      final bytesInDelta =
          ((tunAfter['bytesIn'] as num?) ?? 0) -
          ((tunBefore['bytesIn'] as num?) ?? 0);
      final bytesOutDelta =
          ((tunAfter['bytesOut'] as num?) ?? 0) -
          ((tunBefore['bytesOut'] as num?) ?? 0);
      final downloadMB = requireTunForwarding
          ? bytesOutDelta.clamp(0, double.infinity) / (1024 * 1024)
          : sizeMB;
      final uploadMB = requireTunForwarding
          ? bytesInDelta.clamp(0, double.infinity) / (1024 * 1024)
          : 0.0;

      final tunConfirmed = packetsInDelta > 0 && bytesInDelta > 0;
      final isSuccess =
          response.statusCode >= 200 &&
          response.statusCode < 400 &&
          (!requireTunForwarding || tunConfirmed);

      return TaskExecutionResult(
        success: isSuccess,
        statusCode: response.statusCode,
        latencyMs: latencyMs,
        bandwidthUsedMB: downloadMB,
        downloadBandwidthMB: downloadMB,
        uploadBandwidthMB: uploadMB,
        packetLoss: null,
        successRate: isSuccess ? 100 : 0,
        resultData: {
          'statusCode': response.statusCode,
          'contentLengthBytes': bodySizeBytes,
          'latencyMs': latencyMs,
          'packetLossMeasured': false,
          'headers': response.headers.sublistSafe(),
          'tunForwarding': {
            'active': tunAfter['state'] == 'connected',
            'confirmed': tunConfirmed,
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
        bandwidthUsedMB: 0,
        downloadBandwidthMB: 0,
        uploadBandwidthMB: 0,
        packetLoss: null,
        successRate: 0,
        resultData: {'error': e.toString()},
      );
    } finally {
      client.close();
    }
  }

  /// Execute the server-authorized count under one total deadline. Task replay
  /// protection remains outside this batch, so duplicate envelopes never rerun it.
  static Future<TaskExecutionResult> executeRequestBatch({
    required int executionLimit,
    required int timeoutMs,
    required Future<TaskExecutionResult> Function(int remainingMs) execute,
  }) async {
    if (executionLimit < 1 || executionLimit > 100 || timeoutMs <= 0) {
      throw const FormatException('Invalid execution count or deadline');
    }
    final elapsed = Stopwatch()..start();
    final results = <TaskExecutionResult>[];
    String? error;
    for (var index = 0; index < executionLimit; index++) {
      final remaining = timeoutMs - elapsed.elapsedMilliseconds;
      if (remaining <= 0) {
        error = 'Task deadline exceeded';
        break;
      }
      try {
        final result = await execute(
          remaining,
        ).timeout(Duration(milliseconds: remaining));
        results.add(result);
        if (!result.success) {
          error =
              result.resultData['error']?.toString() ??
              'Authorized request failed';
          break;
        }
      } catch (failure) {
        error = failure.toString();
        break;
      }
    }
    elapsed.stop();
    final completed = results.where((result) => result.success).length;
    final success = error == null && completed == executionLimit;
    final download = results.fold<double>(
      0,
      (total, result) => total + result.downloadBandwidthMB,
    );
    final upload = results.fold<double>(
      0,
      (total, result) => total + result.uploadBandwidthMB,
    );
    return TaskExecutionResult(
      success: success,
      statusCode: results.isEmpty ? 500 : results.last.statusCode,
      latencyMs: results.isEmpty
          ? 0
          : (results.fold<int>(0, (total, result) => total + result.latencyMs) /
                    results.length)
                .round(),
      bandwidthUsedMB: download,
      downloadBandwidthMB: download,
      uploadBandwidthMB: upload,
      packetLoss: null,
      successRate: (completed / executionLimit * 100).round(),
      resultData: {
        'requestedExecutions': executionLimit,
        'attemptedExecutions': results.length,
        'completedExecutions': completed,
        'totalDurationMs': elapsed.elapsedMilliseconds,
        'packetLossMeasured': false,
        if (results.isNotEmpty) 'lastResponse': results.last.resultData,
        'error': ?error,
      },
    );
  }

  /// HTTP probe failures are request failures, not measured IP packet loss.
  static Future<TaskExecutionResult> executePingTest(
    String targetUrl, {
    int samples = 3,
    String? authorizedHost,
    int? authorizedPort,
  }) async {
    final latencies = <int>[];
    if (samples < 1 || samples > 100) {
      throw const FormatException('Invalid probe count');
    }
    int failures = 0;
    double downloaded = 0, uploaded = 0;

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
      downloaded += sample.downloadBandwidthMB;
      uploaded += sample.uploadBandwidthMB;
      if (i < samples - 1) {
        await Future.delayed(const Duration(milliseconds: 100));
      }
    }

    final packetLoss = ((failures / samples) * 100).round();
    final avgLatency = latencies.isNotEmpty
        ? (latencies.reduce((a, b) => a + b) / latencies.length).round()
        : 0;

    return TaskExecutionResult(
      success: packetLoss < 100,
      statusCode: failures == samples ? 500 : 200,
      latencyMs: avgLatency,
      bandwidthUsedMB: downloaded,
      downloadBandwidthMB: downloaded,
      uploadBandwidthMB: uploaded,
      packetLoss: null,
      successRate: 100 - packetLoss,
      resultData: {
        'samples': samples,
        'requestFailureRatePercent': packetLoss,
        'packetLossMeasured': false,
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
