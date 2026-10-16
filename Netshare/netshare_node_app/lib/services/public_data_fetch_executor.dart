import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'secure_routing_protocol.dart';
import 'vpn_service.dart';

typedef PublicDnsLookup = Future<List<InternetAddress>> Function(String host);

class PublicFetchCancellation {
  bool _cancelled = false;
  final List<void Function()> _closers = [];

  bool get isCancelled => _cancelled;

  void attach(void Function() close) {
    if (_cancelled) {
      close();
      return;
    }
    _closers.add(close);
  }

  void check() {
    if (_cancelled) {
      throw const PublicFetchFailure('Authorized route interrupted');
    }
  }

  void cancel() {
    if (_cancelled) return;
    _cancelled = true;
    for (final close in _closers) {
      close();
    }
    _closers.clear();
  }
}

class PublicFetchFailure implements Exception {
  final String message;
  const PublicFetchFailure(this.message);
  @override
  String toString() => message;
}

class PublicFetchResponse {
  final int statusCode;
  final String? contentType;
  final String? contentEncoding;
  final String? location;
  final int contentLength;
  final Stream<List<int>> body;
  final void Function() close;

  const PublicFetchResponse({
    required this.statusCode,
    required this.contentType,
    required this.contentEncoding,
    required this.location,
    required this.contentLength,
    required this.body,
    required this.close,
  });
}

abstract class PublicFetchTransport {
  Future<PublicFetchResponse> get(
    Uri uri,
    InternetAddress pinnedIp,
    Duration timeout,
    PublicFetchCancellation cancellation,
  );
}

/// TLS still uses the authorized URI host for SNI and certificate verification;
/// only the TCP destination is pinned to a public /32 installed in VpnService.
class AndroidPublicFetchTransport implements PublicFetchTransport {
  @override
  Future<PublicFetchResponse> get(
    Uri uri,
    InternetAddress pinnedIp,
    Duration timeout,
    PublicFetchCancellation cancellation,
  ) async {
    final client = HttpClient()
      ..findProxy = ((_) => 'DIRECT')
      ..autoUncompress = false
      ..connectionTimeout = timeout;
    client.connectionFactory = (url, proxyHost, proxyPort) {
      if (proxyHost != null ||
          proxyPort != null ||
          url.scheme != 'https' ||
          url.host != uri.host ||
          url.port != 443) {
        throw const PublicFetchFailure('Unauthorized socket destination');
      }
      return Socket.startConnect(pinnedIp, 443);
    };
    cancellation.attach(() => client.close(force: true));
    try {
      cancellation.check();
      final request = await client.getUrl(uri).timeout(timeout);
      request.followRedirects = false;
      request.persistentConnection = false;
      request.headers.set(
        HttpHeaders.acceptHeader,
        'application/json, text/plain, text/html',
      );
      request.headers.set(HttpHeaders.acceptEncodingHeader, 'identity');
      final response = await request.close().timeout(timeout);
      cancellation.check();
      return PublicFetchResponse(
        statusCode: response.statusCode,
        contentType: response.headers.value(HttpHeaders.contentTypeHeader),
        contentEncoding: response.headers.value(
          HttpHeaders.contentEncodingHeader,
        ),
        location: response.headers.value(HttpHeaders.locationHeader),
        contentLength: response.contentLength,
        body: response,
        close: () => client.close(force: true),
      );
    } catch (_) {
      client.close(force: true);
      rethrow;
    }
  }
}

abstract class PublicFetchVpn {
  Future<bool> ready(String sessionId);
  Future<Map<String, dynamic>> metrics();
  Stream<VpnState> get states;
}

class AndroidPublicFetchVpn implements PublicFetchVpn {
  @override
  Future<bool> ready(String sessionId) async {
    final status = await NetShareVpnBridge.getStatus();
    return status.isRunning &&
        status.state == VpnState.connected &&
        await NetShareVpnBridge.isNetworkReady() &&
        (await metrics())['routingSessionId'] == sessionId;
  }

  @override
  Future<Map<String, dynamic>> metrics() => NetShareVpnBridge.getTunMetrics();

  @override
  Stream<VpnState> get states =>
      NetShareVpnBridge.eventStream.map((e) => e.state);
}

class PublicDataFetchResult {
  final bool success;
  final int httpStatus;
  final String? content;
  final String? contentType;
  final String finalUrl;
  final int responseSizeBytes;
  final int ttfbMs;
  final int totalTimeMs;
  final double downloadMB;
  final double uploadMB;
  final String? error;
  final DateTime executedAt;

  const PublicDataFetchResult({
    required this.success,
    required this.httpStatus,
    required this.content,
    required this.contentType,
    required this.finalUrl,
    required this.responseSizeBytes,
    required this.ttfbMs,
    required this.totalTimeMs,
    required this.downloadMB,
    required this.uploadMB,
    required this.error,
    required this.executedAt,
  });

  Map<String, dynamic> toPayload({
    required String taskId,
    required String sessionId,
    required String nodeId,
    required String targetRegion,
  }) => {
    'contractVersion': PublicDataFetchAuthorization.version,
    'serviceType': 'PUBLIC_DATA_FETCH',
    'taskId': taskId,
    'routingSessionId': sessionId,
    'nodeId': nodeId,
    'executedAt': executedAt.toUtc().toIso8601String(),
    'success': success,
    'successRate': success ? 100 : 0,
    'statusCode': httpStatus,
    'latencyMs': totalTimeMs,
    'bandwidthUsedMB': downloadMB,
    'uploadBandwidthMB': uploadMB,
    'packetLoss': null,
    'targetRegion': targetRegion,
    'resultData': {
      'schemaVersion': PublicDataFetchAuthorization.version,
      'finalUrl': finalUrl,
      'contentType': contentType,
      'content': content,
      'responseSizeBytes': responseSizeBytes,
      'httpStatus': httpStatus,
      'ttfbMs': ttfbMs,
      'totalTimeMs': totalTimeMs,
      'error': error,
    },
  };
}

class PublicDataFetchExecutor {
  final PublicDnsLookup dnsLookup;
  final PublicFetchTransport transport;
  final PublicFetchVpn vpn;

  PublicDataFetchExecutor({
    PublicDnsLookup? dnsLookup,
    PublicFetchTransport? transport,
    PublicFetchVpn? vpn,
  }) : dnsLookup = dnsLookup ?? InternetAddress.lookup,
       transport = transport ?? AndroidPublicFetchTransport(),
       vpn = vpn ?? AndroidPublicFetchVpn();

  static String? validateUrl(
    Uri uri, {
    required String authorizedHost,
    required int authorizedPort,
  }) {
    if (uri.toString().length > 2048 ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        uri.host.toLowerCase() != authorizedHost.toLowerCase() ||
        uri.port != 443 ||
        authorizedPort != 443 ||
        uri.userInfo.isNotEmpty ||
        uri.hasFragment ||
        InternetAddress.tryParse(uri.host) != null ||
        RegExp(
          r'(^|\.)(localhost|local|internal|lan|home|onion)$',
          caseSensitive: false,
        ).hasMatch(uri.host) ||
        uri.queryParameters.keys.any(
          (key) => RegExp(
            r'(token|api[_-]?key|password|secret|credential|signature|auth|session|cookie)',
            caseSensitive: false,
          ).hasMatch(key),
        )) {
      return 'Public HTTPS target authorization rejected';
    }
    return null;
  }

  static bool isPublicAddress(InternetAddress address) {
    final bytes = address.rawAddress;
    if (address.type == InternetAddressType.IPv4 && bytes.length == 4) {
      final a = bytes[0], b = bytes[1];
      return !(a == 0 ||
          a == 10 ||
          a == 127 ||
          a >= 224 ||
          (a == 100 && b >= 64 && b <= 127) ||
          (a == 169 && b == 254) ||
          (a == 172 && b >= 16 && b <= 31) ||
          (a == 192 && (b == 168 || b == 0)) ||
          (a == 198 && (b == 18 || b == 19)) ||
          (a == 203 && b == 0 && bytes[2] == 113) ||
          (a == 198 && b == 51 && bytes[2] == 100) ||
          (a == 192 && b == 0 && bytes[2] == 2));
    }
    if (address.type == InternetAddressType.IPv6 && bytes.length == 16) {
      // Global unicast only. Exclude documentation, transition and mapped ranges.
      return (bytes[0] & 0xe0) == 0x20 &&
          !(bytes[0] == 0x20 &&
              bytes[1] == 0x01 &&
              (bytes[2] == 0x0d && bytes[3] == 0xb8 || bytes[2] == 0x00)) &&
          !(bytes[0] == 0x20 && bytes[1] == 0x02);
    }
    return false;
  }

  Future<List<InternetAddress>> resolveRouteIps(
    Uri uri, {
    required String authorizedHost,
    required int authorizedPort,
    Duration timeout = const Duration(seconds: 5),
  }) async {
    final error = validateUrl(
      uri,
      authorizedHost: authorizedHost,
      authorizedPort: authorizedPort,
    );
    if (error != null) throw PublicFetchFailure(error);
    final answers = await dnsLookup(uri.host).timeout(timeout);
    if (answers.isEmpty || answers.any((ip) => !isPublicAddress(ip))) {
      throw const PublicFetchFailure('DNS resolved to an unsafe destination');
    }
    final ipv4 = answers
        .where((ip) => ip.type == InternetAddressType.IPv4)
        .toList();
    if (ipv4.isEmpty) {
      throw const PublicFetchFailure(
        'Authorized host has no routed public IPv4 address',
      );
    }
    return ipv4;
  }

  Future<PublicDataFetchResult> execute(
    AuthorizedTaskRequest task, {
    required String nodeId,
    required List<String> installedIps,
    required PublicFetchCancellation cancellation,
  }) async {
    final timer = Stopwatch()..start();
    var uri = Uri.parse(task.targetUrl);
    var ttfbMs = 0;
    final deadline = Timer(
      Duration(milliseconds: task.timeoutMs),
      cancellation.cancel,
    );
    Future<T> beforeDeadline<T>(Future<T> operation) async {
      final remaining = task.timeoutMs - timer.elapsedMilliseconds;
      if (remaining <= 0) throw TimeoutException('Task deadline exceeded');
      final value = await operation.timeout(Duration(milliseconds: remaining));
      cancellation.check();
      return value;
    }

    StreamSubscription<VpnState>? vpnEvents;
    PublicDataFetchResult failure(String message, {int status = 0}) {
      final elapsed = timer.elapsedMilliseconds.clamp(0, 300000);
      return PublicDataFetchResult(
        success: false,
        httpStatus: status,
        content: null,
        contentType: null,
        finalUrl: uri.toString(),
        responseSizeBytes: 0,
        ttfbMs: ttfbMs.clamp(0, elapsed),
        totalTimeMs: elapsed,
        downloadMB: 0,
        uploadMB: 0,
        error: message.length > 500 ? message.substring(0, 500) : message,
        executedAt: DateTime.now().toUtc(),
      );
    }

    try {
      if (task.serviceType != 'PUBLIC_DATA_FETCH' ||
          task.publicDataFetch == null ||
          nodeId.isEmpty ||
          task.executionLimit != 1 ||
          task.authorizedMethod != 'GET' ||
          task.routingSessionId != task.publicDataFetch!.routingSessionId) {
        throw const PublicFetchFailure('Invalid public fetch task binding');
      }
      if (installedIps.isEmpty ||
          !await beforeDeadline(vpn.ready(task.routingSessionId))) {
        throw const PublicFetchFailure('Authorized TUN route is unavailable');
      }
      vpnEvents = vpn.states.listen((state) {
        if (state != VpnState.connected) cancellation.cancel();
      }, onError: (_) => cancellation.cancel());
      final before = await beforeDeadline(vpn.metrics());
      if (!_activeMetrics(before, task.routingSessionId)) {
        throw const PublicFetchFailure('TUN session binding is unavailable');
      }
      for (var redirects = 0; redirects <= 3; redirects++) {
        cancellation.check();
        final dnsRemaining = task.timeoutMs - timer.elapsedMilliseconds;
        if (dnsRemaining <= 0) {
          throw const PublicFetchFailure('Task deadline exceeded');
        }
        final ips = await resolveRouteIps(
          uri,
          authorizedHost: task.authorizedHost,
          authorizedPort: task.authorizedPort,
          timeout: Duration(milliseconds: dnsRemaining),
        );
        if (ips.any((ip) => !installedIps.contains(ip.address))) {
          throw const PublicFetchFailure(
            'DNS changed outside installed TUN routes',
          );
        }
        if (!await beforeDeadline(vpn.ready(task.routingSessionId))) {
          throw const PublicFetchFailure(
            'Authorized TUN route was interrupted',
          );
        }
        final remaining = task.timeoutMs - timer.elapsedMilliseconds;
        if (remaining <= 0) {
          throw const PublicFetchFailure('Task deadline exceeded');
        }
        final response = await transport.get(
          uri,
          ips.first,
          Duration(milliseconds: remaining),
          cancellation,
        );
        try {
          cancellation.check();
          ttfbMs = timer.elapsedMilliseconds;
          final location = response.location;
          if ({301, 302, 303, 307, 308}.contains(response.statusCode)) {
            if (location == null || redirects == 3) {
              throw const PublicFetchFailure(
                'Redirect limit or location rejected',
              );
            }
            final next = uri.resolve(location);
            if (next.scheme != uri.scheme ||
                next.host != uri.host ||
                next.port != uri.port ||
                validateUrl(
                      next,
                      authorizedHost: task.authorizedHost,
                      authorizedPort: task.authorizedPort,
                    ) !=
                    null) {
              throw const PublicFetchFailure('Unsafe redirect rejected');
            }
            uri = next;
            continue;
          }
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return failure(
              'HTTP ${response.statusCode}',
              status: response.statusCode >= 400 ? response.statusCode : 0,
            );
          }
          final contentType = response.contentType;
          if (response.contentEncoding != null &&
              response.contentEncoding!.toLowerCase().trim() != 'identity') {
            throw const PublicFetchFailure('Encoded response body rejected');
          }
          final mediaType = contentType?.split(';').first.trim().toLowerCase();
          if (contentType == null ||
              contentType.length > 100 ||
              !PublicDataFetchAuthorization.mediaTypes.contains(mediaType) ||
              (contentType.contains(';') &&
                  !RegExp(
                    r'^\s*(application/json|text/html|text/plain)\s*;\s*charset=utf-8\s*$',
                    caseSensitive: false,
                  ).hasMatch(contentType))) {
            throw const PublicFetchFailure('Unsupported response content type');
          }
          if (response.contentLength > PublicDataFetchAuthorization.maxBytes) {
            throw const PublicFetchFailure('Response body exceeds 16 KiB');
          }
          final bytes = BytesBuilder(copy: false);
          await for (final chunk in response.body) {
            cancellation.check();
            if (bytes.length + chunk.length >
                PublicDataFetchAuthorization.maxBytes) {
              throw const PublicFetchFailure('Response body exceeds 16 KiB');
            }
            bytes.add(chunk);
          }
          cancellation.check();
          final bodyBytes = bytes.takeBytes();
          String content;
          try {
            content = utf8.decode(bodyBytes);
          } on FormatException {
            throw const PublicFetchFailure('Invalid UTF-8 response');
          }
          if (content.runes.any(
            (rune) =>
                rune == 0 ||
                (rune < 32 && rune != 9 && rune != 10 && rune != 13),
          )) {
            throw const PublicFetchFailure('Binary response rejected');
          }
          if (mediaType == 'application/json') {
            try {
              jsonDecode(content);
            } on FormatException {
              throw const PublicFetchFailure('Invalid JSON response');
            }
          }
          if (!await beforeDeadline(vpn.ready(task.routingSessionId))) {
            throw const PublicFetchFailure(
              'Authorized TUN route was interrupted',
            );
          }
          final after = await beforeDeadline(vpn.metrics());
          if (!_activeMetrics(after, task.routingSessionId)) {
            throw const PublicFetchFailure('TUN session binding changed');
          }
          final inBytes = _delta(after, before, 'bytesIn');
          final outBytes = _delta(after, before, 'bytesOut');
          if (inBytes <= 0 ||
              outBytes <= 0 ||
              _delta(after, before, 'packetsIn') <= 0 ||
              _delta(after, before, 'packetsOut') <= 0) {
            throw const PublicFetchFailure(
              'Authorized TUN forwarding was not confirmed',
            );
          }
          final elapsed = timer.elapsedMilliseconds.clamp(0, 300000);
          return PublicDataFetchResult(
            success: true,
            httpStatus: response.statusCode,
            content: content,
            contentType: contentType,
            finalUrl: uri.toString(),
            responseSizeBytes: bodyBytes.length,
            ttfbMs: ttfbMs.clamp(0, elapsed),
            totalTimeMs: elapsed,
            downloadMB: outBytes / (1024 * 1024),
            uploadMB: inBytes / (1024 * 1024),
            error: null,
            executedAt: DateTime.now().toUtc(),
          );
        } finally {
          response.close();
        }
      }
      return failure('Redirect limit exceeded');
    } on PublicFetchFailure catch (error) {
      return failure(error.message);
    } on TimeoutException {
      return failure('Task deadline exceeded');
    } catch (_) {
      return failure(
        cancellation.isCancelled
            ? 'Authorized route interrupted'
            : 'Public HTTPS request failed',
      );
    } finally {
      deadline.cancel();
      await vpnEvents?.cancel();
      timer.stop();
    }
  }

  static bool _activeMetrics(Map<String, dynamic> values, String sessionId) =>
      values['state'] == 'connected' && values['routingSessionId'] == sessionId;

  static int _delta(
    Map<String, dynamic> after,
    Map<String, dynamic> before,
    String key,
  ) =>
      ((after[key] as num?)?.toInt() ?? 0) -
      ((before[key] as num?)?.toInt() ?? 0);
}
