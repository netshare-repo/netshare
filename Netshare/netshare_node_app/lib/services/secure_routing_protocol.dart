import 'dart:convert';

const int secureRoutingProtocolVersion = 1;
const String secureRoutingDataChannelLabel = 'netshare-control';

enum SecureRouteState {
  negotiating,
  open,
  executing,
  resultSent,
  closed,
  failed,
}

class SecureRouteLifecycle {
  SecureRouteState _state = SecureRouteState.negotiating;
  SecureRouteState get state => _state;

  static const Map<SecureRouteState, Set<SecureRouteState>> _allowed = {
    SecureRouteState.negotiating: {
      SecureRouteState.open,
      SecureRouteState.failed,
      SecureRouteState.closed,
    },
    SecureRouteState.open: {
      SecureRouteState.executing,
      SecureRouteState.failed,
      SecureRouteState.closed,
    },
    SecureRouteState.executing: {
      SecureRouteState.resultSent,
      SecureRouteState.failed,
    },
    SecureRouteState.resultSent: {SecureRouteState.closed},
    SecureRouteState.closed: {},
    SecureRouteState.failed: {SecureRouteState.closed},
  };

  void transition(SecureRouteState next) {
    if (!_allowed[_state]!.contains(next)) {
      throw StateError('Invalid secure route transition: $_state -> $next');
    }
    _state = next;
  }
}

class SecureRoutingMessage {
  final int version;
  final String sessionId;
  final String type;
  final String messageId;
  final Map<String, dynamic> payload;
  final DateTime sentAt;

  const SecureRoutingMessage({
    required this.version,
    required this.sessionId,
    required this.type,
    required this.messageId,
    required this.payload,
    required this.sentAt,
  });

  static SecureRoutingMessage? parse(
    String raw, {
    required String expectedSessionId,
  }) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final map = Map<String, dynamic>.from(decoded);
      if (map['v'] != secureRoutingProtocolVersion ||
          map['sessionId'] != expectedSessionId ||
          map['type'] is! String ||
          map['msgId'] is! String ||
          map['sentAt'] is! String ||
          map['payload'] is! Map) {
        return null;
      }
      final sentAt = DateTime.tryParse(map['sentAt'] as String);
      if (sentAt == null) return null;
      return SecureRoutingMessage(
        version: map['v'] as int,
        sessionId: map['sessionId'] as String,
        type: map['type'] as String,
        messageId: map['msgId'] as String,
        payload: Map<String, dynamic>.from(map['payload'] as Map),
        sentAt: sentAt,
      );
    } catch (_) {
      return null;
    }
  }

  String encode() => jsonEncode({
    'v': version,
    'sessionId': sessionId,
    'type': type,
    'msgId': messageId,
    'payload': payload,
    'sentAt': sentAt.toUtc().toIso8601String(),
  });
}

class SecureRoutingProtocol {
  static int _sequence = 0;
  final Set<String> _seenMessageIds = <String>{};

  bool acceptOnce(String messageId) => _seenMessageIds.add(messageId);

  SecureRoutingMessage build(
    String sessionId,
    String type,
    Map<String, dynamic> payload,
  ) {
    _sequence += 1;
    final now = DateTime.now().toUtc();
    return SecureRoutingMessage(
      version: secureRoutingProtocolVersion,
      sessionId: sessionId,
      type: type,
      messageId: '${now.microsecondsSinceEpoch}-$_sequence',
      payload: payload,
      sentAt: now,
    );
  }

  void clear() => _seenMessageIds.clear();
}

class AuthorizedTaskRequest {
  final String taskId;
  final String routingSessionId;
  final String targetUrl;
  final String authorizedHost;
  final int authorizedPort;
  final String authorizedMethod;
  final int timeoutMs;
  final int executionLimit;
  final String serviceType;
  final String targetRegion;
  final Map<String, dynamic>? trafficPolicy;
  final PublicDataFetchAuthorization? publicDataFetch;
  final BrowserPageInspectAuthorization? browserPageInspect;

  const AuthorizedTaskRequest({
    required this.taskId,
    required this.routingSessionId,
    required this.targetUrl,
    required this.authorizedHost,
    required this.authorizedPort,
    required this.authorizedMethod,
    required this.timeoutMs,
    this.executionLimit = 1,
    this.serviceType = 'performance_testing',
    this.targetRegion = '',
    this.trafficPolicy,
    this.publicDataFetch,
    this.browserPageInspect,
  });

  factory AuthorizedTaskRequest.fromMessage(SecureRoutingMessage message) {
    if (message.type != 'task_request') {
      throw const FormatException('Expected task_request');
    }
    final p = message.payload;
    final taskId = p['taskId']?.toString() ?? '';
    final sessionId = p['routingSessionId']?.toString() ?? '';
    final targetUrl = p['targetUrl']?.toString() ?? '';
    final host = p['authorizedHost']?.toString().toLowerCase() ?? '';
    final port = (p['authorizedPort'] as num?)?.toInt();
    final method = p['authorizedMethod']?.toString().toUpperCase() ?? '';
    final timeout = (p['timeoutMs'] as num?)?.toInt() ?? 25000;
    final count = p['executionLimit'] ?? 1;
    final serviceType = p['serviceType']?.toString() ?? 'performance_testing';
    final targetRegion = p['targetRegion']?.toString() ?? '';
    final isPublicFetch = serviceType == 'PUBLIC_DATA_FETCH';
    final isBrowserInspect = serviceType == 'BROWSER_PAGE_INSPECT';
    if (isPublicFetch &&
        (taskId.isEmpty ||
            sessionId.isEmpty ||
            targetUrl.isEmpty ||
            host.isEmpty ||
            port != 443 ||
            method != 'GET' ||
            p.keys.any(
              (key) => !const {
                'taskId',
                'routingSessionId',
                'targetUrl',
                'authorizedHost',
                'authorizedPort',
                'authorizedMethod',
                'serviceType',
                'targetRegion',
                'executionLimit',
                'timeoutMs',
                'trafficPolicy',
                'issuedAt',
                'publicDataFetch',
              }.contains(key),
            ))) {
      throw const FormatException('Invalid public fetch authorization');
    }
    final fetchAuthorization = isPublicFetch
        ? PublicDataFetchAuthorization.fromPayload(p, message.sessionId)
        : null;
    final browserAuthorization = isBrowserInspect
        ? BrowserPageInspectAuthorization.fromPayload(p, message.sessionId)
        : null;

    if (taskId.isEmpty ||
        sessionId != message.sessionId ||
        targetUrl.isEmpty ||
        host.isEmpty ||
        port == null ||
        method != 'GET' ||
        !const {
          'accessibility_testing',
          'performance_testing',
          'localization_testing',
          'PUBLIC_DATA_FETCH',
          'BROWSER_PAGE_INSPECT',
        }.contains(serviceType) ||
        timeout <= 0 ||
        timeout > 30000 ||
        count is! int ||
        count < 1 ||
        count > 100) {
      throw const FormatException('Invalid task authorization envelope');
    }
    if (isPublicFetch && (count != 1 || port != 443)) {
      throw const FormatException('Invalid public fetch execution or port');
    }
    if (isBrowserInspect && (count != 1 || port != 443)) {
      throw const FormatException('Invalid browser inspection execution or port');
    }

    return AuthorizedTaskRequest(
      taskId: taskId,
      routingSessionId: sessionId,
      targetUrl: targetUrl,
      authorizedHost: host,
      authorizedPort: port,
      authorizedMethod: method,
      timeoutMs: timeout,
      executionLimit: count,
      serviceType: serviceType,
      targetRegion: targetRegion,
      trafficPolicy: p['trafficPolicy'] is Map
          ? Map<String, dynamic>.from(p['trafficPolicy'] as Map)
          : null,
      publicDataFetch: fetchAuthorization,
      browserPageInspect: browserAuthorization,
    );
  }
}

/// Immutable server authorization for the disabled Phase 12 browser service.
/// The executor treats this as a server-supplied policy, never client input.
class BrowserPageInspectAuthorization {
  static const String serviceType = 'BROWSER_PAGE_INSPECT';
  static const int version = 1;
  static const int maxTextBytes = 32 * 1024;
  static const int maxScreenshotBytes = 2 * 1024 * 1024;
  static const int maxResources = 64;
  static const int maxTotalBytes = 8 * 1024 * 1024;

  final String taskId;
  final String routingSessionId;
  final String targetUrl;
  final String targetRegion;
  final BrowserViewport viewport;
  final int pageLoadTimeoutMs;
  final int allowedTextBytes;
  final bool captureScreenshot;

  const BrowserPageInspectAuthorization({
    required this.taskId,
    required this.routingSessionId,
    required this.targetUrl,
    required this.targetRegion,
    required this.viewport,
    required this.pageLoadTimeoutMs,
    required this.allowedTextBytes,
    required this.captureScreenshot,
  });

  factory BrowserPageInspectAuthorization.fromPayload(
    Map<String, dynamic> outer,
    String sessionId,
  ) {
    const outerFields = {
      'taskId',
      'routingSessionId',
      'targetUrl',
      'authorizedHost',
      'authorizedPort',
      'authorizedMethod',
      'serviceType',
      'targetRegion',
      'executionLimit',
      'timeoutMs',
      'trafficPolicy',
      'issuedAt',
      'browserPageInspect',
    };
    if (outer.keys.any((key) => !outerFields.contains(key))) {
      throw const FormatException('Invalid browser inspection authorization');
    }
    final raw = outer['browserPageInspect'];
    if (raw is! Map) {
      throw const FormatException('Missing browser inspection contract');
    }
    final p = Map<String, dynamic>.from(raw);
    const fields = {
      'contractVersion',
      'serviceType',
      'taskId',
      'routingSessionId',
      'targetUrl',
      'targetRegion',
      'method',
      'viewport',
      'pageLoadTimeoutMs',
      'maxTextBytes',
      'captureScreenshot',
      'maxScreenshotBytes',
      'maxResources',
      'maxTotalBytes',
      'resourcePolicy',
      'scriptPolicy',
      'credentials',
      'redirectPolicy',
    };
    final rawViewport = p['viewport'];
    if (rawViewport is! Map) {
      throw const FormatException('Missing browser viewport contract');
    }
    final viewport = BrowserViewport.fromPayload(rawViewport);
    final pageLoadTimeout = p['pageLoadTimeoutMs'];
    final allowedTextBytes = p['maxTextBytes'];
    final outerTimeout = outer['timeoutMs'];
    if (p['contractVersion'] != version ||
        p['serviceType'] != serviceType ||
        p['taskId'] is! String ||
        p['routingSessionId'] is! String ||
        p['targetUrl'] is! String ||
        p['targetRegion'] is! String ||
        p['taskId'] != outer['taskId'] ||
        p['routingSessionId'] != sessionId ||
        p['targetUrl'] != outer['targetUrl'] ||
        p['targetRegion'] != outer['targetRegion'] ||
        p['method'] != 'GET' ||
        outer['authorizedMethod'] != 'GET' ||
        outer['authorizedPort'] != 443 ||
        outer['executionLimit'] != 1 ||
        pageLoadTimeout is! int ||
        pageLoadTimeout < 1000 ||
        pageLoadTimeout > 20000 ||
        outerTimeout is! int ||
        pageLoadTimeout > outerTimeout ||
        allowedTextBytes is! int ||
        allowedTextBytes < 0 ||
        allowedTextBytes > maxTextBytes ||
        p['captureScreenshot'] is! bool ||
        p['maxScreenshotBytes'] != maxScreenshotBytes ||
        p['maxResources'] != maxResources ||
        p['maxTotalBytes'] != maxTotalBytes ||
        p['resourcePolicy'] != 'intercept-all-public-https-or-fail-closed' ||
        p['scriptPolicy'] != 'disabled-no-client-script' ||
        p['credentials'] != 'omit' ||
        p['redirectPolicy'] != 'same-origin-https-only' ||
        p.keys.any((key) => !fields.contains(key))) {
      throw const FormatException('Invalid browser inspection v1 contract');
    }
    return BrowserPageInspectAuthorization(
      taskId: p['taskId'] as String,
      routingSessionId: sessionId,
      targetUrl: p['targetUrl'] as String,
      targetRegion: p['targetRegion'] as String,
      viewport: viewport,
      pageLoadTimeoutMs: pageLoadTimeout,
      allowedTextBytes: allowedTextBytes,
      captureScreenshot: p['captureScreenshot'] as bool,
    );
  }
}

class BrowserViewport {
  final int width;
  final int height;
  final num deviceScaleFactor;

  const BrowserViewport({
    required this.width,
    required this.height,
    required this.deviceScaleFactor,
  });

  Map<String, dynamic> toPayload() => {
    'width': width,
    'height': height,
    'deviceScaleFactor': deviceScaleFactor,
  };

  factory BrowserViewport.fromPayload(Map raw) {
    const fields = {'width', 'height', 'deviceScaleFactor'};
    final width = raw['width'];
    final height = raw['height'];
    final scale = raw['deviceScaleFactor'];
    if (raw.keys.any((key) => !fields.contains(key)) ||
        width is! int ||
        height is! int ||
        width < 320 ||
        width > 1920 ||
        height < 320 ||
        height > 2160 ||
        scale is! num ||
        ![1, 1.5, 2].contains(scale)) {
      throw const FormatException('Invalid browser viewport');
    }
    return BrowserViewport(
      width: width,
      height: height,
      deviceScaleFactor: scale,
    );
  }
}

class PublicDataFetchAuthorization {
  static const int version = 1;
  static const int maxBytes = 16 * 1024;
  static const Set<String> mediaTypes = {
    'application/json',
    'text/html',
    'text/plain',
  };

  final String taskId;
  final String routingSessionId;
  final String targetUrl;

  const PublicDataFetchAuthorization({
    required this.taskId,
    required this.routingSessionId,
    required this.targetUrl,
  });

  factory PublicDataFetchAuthorization.fromPayload(
    Map<String, dynamic> outer,
    String sessionId,
  ) {
    final raw = outer['publicDataFetch'];
    if (raw is! Map) {
      throw const FormatException('Missing public fetch contract');
    }
    final p = Map<String, dynamic>.from(raw);
    final accepted = p['acceptedMediaTypes'];
    if (p['contractVersion'] != version ||
        p['serviceType'] != 'PUBLIC_DATA_FETCH' ||
        p['taskId'] != outer['taskId'] ||
        p['routingSessionId'] != sessionId ||
        p['targetUrl'] != outer['targetUrl'] ||
        p['method'] != 'GET' ||
        outer['authorizedMethod'] != 'GET' ||
        p['maxResponseBytes'] != maxBytes ||
        accepted is! List ||
        accepted.length != mediaTypes.length ||
        accepted.toSet().length != mediaTypes.length ||
        accepted.toSet().difference(mediaTypes).isNotEmpty ||
        p.keys.any(
          (key) => !const {
            'contractVersion',
            'serviceType',
            'taskId',
            'routingSessionId',
            'targetUrl',
            'method',
            'maxResponseBytes',
            'acceptedMediaTypes',
            'redirectPolicy',
            'credentials',
          }.contains(key),
        ) ||
        p['redirectPolicy'] != 'same-origin-https-only' ||
        p['credentials'] != 'omit') {
      throw const FormatException('Invalid public fetch v1 contract');
    }
    return PublicDataFetchAuthorization(
      taskId: p['taskId'] as String,
      routingSessionId: sessionId,
      targetUrl: p['targetUrl'] as String,
    );
  }
}
