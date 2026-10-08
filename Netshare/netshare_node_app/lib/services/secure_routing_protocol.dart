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

  const AuthorizedTaskRequest({
    required this.taskId,
    required this.routingSessionId,
    required this.targetUrl,
    required this.authorizedHost,
    required this.authorizedPort,
    required this.authorizedMethod,
    required this.timeoutMs,
    this.executionLimit = 1,
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

    if (taskId.isEmpty ||
        sessionId != message.sessionId ||
        targetUrl.isEmpty ||
        host.isEmpty ||
        port == null ||
        !const {'GET', 'HEAD'}.contains(method) ||
        timeout <= 0 ||
        timeout > 30000 ||
        count is! int ||
        count < 1 ||
        count > 100) {
      throw const FormatException('Invalid task authorization envelope');
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
    );
  }
}
