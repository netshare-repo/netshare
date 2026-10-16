import 'dart:async';
import 'dart:io';

import 'public_data_fetch_executor.dart';
import 'secure_routing_protocol.dart';

typedef BrowserDnsLookup = Future<List<InternetAddress>> Function(String host);

/// This service is deliberately closed until Android has a verifiable browser
/// egress boundary. Do not turn this into a configuration setting: changing an
/// environment variable must never permit Chromium to fall back to the device
/// network outside the assigned task route.
const bool browserPageInspectNetworkedRenderingAvailable = false;

class BrowserPageInspectFailure implements Exception {
  final String message;
  const BrowserPageInspectFailure(this.message);

  @override
  String toString() => message;
}

class BrowserPageInspectCancellation {
  bool _cancelled = false;
  bool get isCancelled => _cancelled;

  void cancel() => _cancelled = true;

  void check() {
    if (_cancelled) {
      throw const BrowserPageInspectFailure('Authorized route interrupted');
    }
  }
}

enum BrowserResourceKind { navigation, redirect, subresource, serviceWorker }

/// Describes an allowed request after DNS answers are pinned to routes already
/// installed for the task. It does not open a socket.
class AuthorizedBrowserResource {
  final Uri uri;
  final List<InternetAddress> pinnedIps;
  final BrowserResourceKind kind;

  const AuthorizedBrowserResource({
    required this.uri,
    required this.pinnedIps,
    required this.kind,
  });
}

/// Models the required native WebView/Chromium request broker. All request
/// kinds, including redirects and service-worker fetches, use this same policy.
/// Its production egress latch is false until native code proves that every
/// browser request has no physical-network fallback.
class BrowserResourceBroker {
  final BrowserDnsLookup dnsLookup;
  final bool taskScopedEgressEnforced;

  BrowserResourceBroker({
    BrowserDnsLookup? dnsLookup,
    this.taskScopedEgressEnforced = false,
  }) : dnsLookup = dnsLookup ?? InternetAddress.lookup;

  Future<AuthorizedBrowserResource> authorize({
    required Uri uri,
    required BrowserPageInspectAuthorization authorization,
    required BrowserResourceKind kind,
    required Iterable<String> installedIps,
    Duration timeout = const Duration(seconds: 5),
  }) async {
    // Check this before DNS so an unavailable native policy can never leak a
    // browser lookup or socket onto the physical network.
    if (!taskScopedEgressEnforced) {
      throw const BrowserPageInspectFailure(
        'Browser network policy is unavailable; rendering is blocked',
      );
    }
    final source = Uri.tryParse(authorization.targetUrl);
    if (source == null) {
      throw const BrowserPageInspectFailure('Invalid browser task target');
    }
    final authorizationError = PublicDataFetchExecutor.validateUrl(
      uri,
      authorizedHost: source.host,
      authorizedPort: 443,
    );
    if (authorizationError != null || !_sameOrigin(source, uri)) {
      throw const BrowserPageInspectFailure(
        'Browser resource escaped the authorized HTTPS origin',
      );
    }

    List<InternetAddress> answers;
    try {
      answers = await dnsLookup(uri.host).timeout(timeout);
    } on TimeoutException {
      throw const BrowserPageInspectFailure('Browser DNS lookup timed out');
    } catch (error) {
      if (error is BrowserPageInspectFailure) rethrow;
      throw const BrowserPageInspectFailure('Browser DNS lookup failed');
    }
    final installed = installedIps.toSet();
    if (answers.isEmpty ||
        answers.any(
          (ip) =>
              ip.type != InternetAddressType.IPv4 ||
              !PublicDataFetchExecutor.isPublicAddress(ip) ||
              !installed.contains(ip.address),
        )) {
      throw const BrowserPageInspectFailure(
        'Browser DNS destination is not an installed public task route',
      );
    }
    return AuthorizedBrowserResource(uri: uri, pinnedIps: answers, kind: kind);
  }

  static bool _sameOrigin(Uri first, Uri second) =>
      first.scheme == 'https' &&
      second.scheme == 'https' &&
      first.host.toLowerCase() == second.host.toLowerCase() &&
      first.port == second.port;
}

/// Screenshot capture is intentionally only a preparation seam. It records no
/// pixels and has no DataChannel byte path. Phase 12C must add a private,
/// task-bound artifact upload grant before a successful task may return one.
class BrowserScreenshotCapturePreparation {
  const BrowserScreenshotCapturePreparation();

  BrowserScreenshotPlan prepare(BrowserPageInspectAuthorization authorization) =>
      BrowserScreenshotPlan(
        captureRequested: authorization.captureScreenshot,
        dataChannelTransferAllowed: false,
        artifactReference: null,
      );
}

class BrowserScreenshotPlan {
  final bool captureRequested;
  final bool dataChannelTransferAllowed;
  final Map<String, dynamic>? artifactReference;

  const BrowserScreenshotPlan({
    required this.captureRequested,
    required this.dataChannelTransferAllowed,
    required this.artifactReference,
  });
}

/// The controlled rendering boundary. It deliberately has no WebView instance
/// while [browserPageInspectNetworkedRenderingAvailable] is false. A future
/// implementation may call it only after native Android enforces every
/// Chromium request through [BrowserResourceBroker] and the task TUN route.
class ControlledAndroidBrowserRenderer {
  final BrowserResourceBroker broker;

  const ControlledAndroidBrowserRenderer(this.broker);

  Future<void> render(BrowserPageInspectAuthorization authorization) async {
    if (!browserPageInspectNetworkedRenderingAvailable ||
        !broker.taskScopedEgressEnforced) {
      throw const BrowserPageInspectFailure(
        'Networked browser rendering is blocked until task-scoped egress is enforceable',
      );
    }
    // Intentionally no fallback WebView or direct HttpClient path exists here.
    throw const BrowserPageInspectFailure(
      'Controlled Android browser renderer is not enabled',
    );
  }
}

class BrowserPageInspectResult {
  final bool success;
  final String finalUrl;
  final int httpStatus;
  final String? pageTitle;
  final BrowserViewport viewport;
  final String? textContent;
  final int textSizeBytes;
  final Map<String, dynamic>? screenshotArtifact;
  final int resourceCount;
  final int blockedResourceCount;
  final int transferredBytes;
  final int ttfbMs;
  final int pageLoadTimeMs;
  final int totalTimeMs;
  final String? error;
  final DateTime executedAt;

  const BrowserPageInspectResult({
    required this.success,
    required this.finalUrl,
    required this.httpStatus,
    required this.pageTitle,
    required this.viewport,
    required this.textContent,
    required this.textSizeBytes,
    required this.screenshotArtifact,
    required this.resourceCount,
    required this.blockedResourceCount,
    required this.transferredBytes,
    required this.ttfbMs,
    required this.pageLoadTimeMs,
    required this.totalTimeMs,
    required this.error,
    required this.executedAt,
  });

  Map<String, dynamic> toPayload({
    required String taskId,
    required String sessionId,
    required String nodeId,
    required String targetRegion,
  }) => {
    'contractVersion': BrowserPageInspectAuthorization.version,
    'serviceType': BrowserPageInspectAuthorization.serviceType,
    'taskId': taskId,
    'routingSessionId': sessionId,
    'nodeId': nodeId,
    'executedAt': executedAt.toUtc().toIso8601String(),
    'success': success,
    'successRate': success ? 100 : 0,
    'statusCode': httpStatus,
    'latencyMs': totalTimeMs,
    'bandwidthUsedMB': 0,
    'uploadBandwidthMB': 0,
    'packetLoss': null,
    'targetRegion': targetRegion,
    'resultData': {
      'schemaVersion': BrowserPageInspectAuthorization.version,
      'finalUrl': finalUrl,
      'httpStatus': httpStatus,
      'pageTitle': pageTitle,
      'viewport': viewport.toPayload(),
      'textContent': textContent,
      'textSizeBytes': textSizeBytes,
      'screenshotArtifact': screenshotArtifact,
      'resourceCount': resourceCount,
      'blockedResourceCount': blockedResourceCount,
      'transferredBytes': transferredBytes,
      'ttfbMs': ttfbMs,
      'pageLoadTimeMs': pageLoadTimeMs,
      'totalTimeMs': totalTimeMs,
      'error': error,
    },
  };
}

class BrowserPageInspectExecutor {
  final BrowserResourceBroker broker;
  final BrowserScreenshotCapturePreparation screenshotPreparation;

  BrowserPageInspectExecutor({
    BrowserResourceBroker? broker,
    BrowserScreenshotCapturePreparation? screenshotPreparation,
  }) : broker = broker ?? BrowserResourceBroker(),
       screenshotPreparation =
           screenshotPreparation ?? const BrowserScreenshotCapturePreparation();

  Future<BrowserPageInspectResult> execute(
    AuthorizedTaskRequest task, {
    required String nodeId,
    required BrowserPageInspectCancellation cancellation,
  }) async {
    final timer = Stopwatch()..start();
    final authorization = task.browserPageInspect;
    final fallbackViewport = authorization?.viewport ??
        const BrowserViewport(width: 1365, height: 768, deviceScaleFactor: 1);
    BrowserPageInspectResult failure(String message) {
      final elapsed = timer.elapsedMilliseconds.clamp(0, 30000);
      return BrowserPageInspectResult(
        success: false,
        finalUrl: task.targetUrl,
        httpStatus: 0,
        pageTitle: null,
        viewport: fallbackViewport,
        textContent: null,
        textSizeBytes: 0,
        screenshotArtifact: null,
        resourceCount: 0,
        blockedResourceCount: 0,
        transferredBytes: 0,
        ttfbMs: 0,
        pageLoadTimeMs: 0,
        totalTimeMs: elapsed,
        error: _safeError(message),
        executedAt: DateTime.now().toUtc(),
      );
    }

    try {
      cancellation.check();
      if (task.serviceType != BrowserPageInspectAuthorization.serviceType ||
          authorization == null ||
          nodeId.isEmpty ||
          task.executionLimit != 1 ||
          task.authorizedMethod != 'GET' ||
          task.authorizedPort != 443 ||
          task.routingSessionId != authorization.routingSessionId ||
          task.taskId != authorization.taskId ||
          task.targetUrl != authorization.targetUrl ||
          task.targetRegion != authorization.targetRegion) {
        throw const BrowserPageInspectFailure(
          'Invalid browser task, node, or routing-session binding',
        );
      }
      final uri = Uri.tryParse(task.targetUrl);
      if (uri == null ||
          PublicDataFetchExecutor.validateUrl(
                uri,
                authorizedHost: task.authorizedHost,
                authorizedPort: task.authorizedPort,
              ) !=
              null) {
        throw const BrowserPageInspectFailure('Browser target authorization rejected');
      }
      cancellation.check();
      screenshotPreparation.prepare(authorization);
      if (!browserPageInspectNetworkedRenderingAvailable ||
          !broker.taskScopedEgressEnforced) {
        throw const BrowserPageInspectFailure(
          'Networked browser rendering is blocked until every WebView request is confined to the authorized TUN route',
        );
      }
      await ControlledAndroidBrowserRenderer(broker).render(authorization);
      throw const BrowserPageInspectFailure('Controlled browser returned no result');
    } on BrowserPageInspectFailure catch (error) {
      return failure(error.message);
    } catch (_) {
      return failure('Browser inspection failed closed');
    }
  }

  static String _safeError(String value) {
    final withoutBearer = value.replaceAll(
      RegExp(r'Bearer\s+[^\s,;]+', caseSensitive: false),
      'Bearer [redacted]',
    );
    final redacted = withoutBearer
        .replaceAllMapped(
          RegExp(
            r'([?&](?:token|api[_-]?key|password|secret|credential|signature|auth)[^=]*=)[^&#\s]+',
            caseSensitive: false,
          ),
          (match) => '${match.group(1)}[redacted]',
        )
        .replaceAll(RegExp(r'[\x00-\x08\x0B\x0C\x0E-\x1F]'), ' ');
    return redacted.length <= 500 ? redacted : redacted.substring(0, 500);
  }
}
