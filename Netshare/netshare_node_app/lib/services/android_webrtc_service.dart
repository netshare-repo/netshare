import 'dart:async';

import 'package:flutter_webrtc/flutter_webrtc.dart';

import 'secure_routing_protocol.dart';
import 'task_executor_service.dart';
import 'vpn_service.dart';

typedef SignalingEmitter =
    void Function(String event, Map<String, dynamic> payload);

class AndroidWebRtcService {
  static final Map<String, _AndroidRoutePeer> _peers = {};
  static final Map<String, List<Map<String, dynamic>>> _pendingCandidates = {};
  static final Set<String> _executedTaskIds = <String>{};
  static void Function(String message)? onLog;

  static Future<void> acceptOffer(
    Map<String, dynamic> offer,
    SignalingEmitter emit,
  ) async {
    final sessionId = offer['routingSessionId']?.toString() ?? '';
    final authToken = offer['authToken']?.toString() ?? '';
    final sdp = offer['sdp']?.toString() ?? '';
    if (sessionId.isEmpty || authToken.isEmpty || sdp.isEmpty) {
      throw const FormatException('Incomplete secure route offer');
    }
    if (_peers.containsKey(sessionId)) {
      throw StateError('Secure route already exists for session $sessionId');
    }

    final rawIceServers = offer['iceServers'];
    final iceServers = rawIceServers is List
        ? rawIceServers
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList(growable: false)
        : <Map<String, dynamic>>[];

    final peerConnection = await createPeerConnection({
      'iceServers': iceServers,
      'sdpSemantics': 'unified-plan',
    });
    final peer = _AndroidRoutePeer(
      sessionId: sessionId,
      authToken: authToken,
      peerConnection: peerConnection,
      emit: emit,
    );
    _peers[sessionId] = peer;

    peerConnection.onIceCandidate = (candidate) {
      final value = candidate.candidate;
      if (value == null || value.isEmpty) return;
      emit('secure_route:ice_candidate', {
        'routingSessionId': sessionId,
        'authToken': peer.authToken,
        'candidate': value,
        'mid': candidate.sdpMid ?? '0',
        'sdpMLineIndex': candidate.sdpMLineIndex ?? 0,
      });
    };

    peerConnection.onDataChannel = (channel) {
      if (channel.label != secureRoutingDataChannelLabel) {
        channel.close();
        peer.fail('Unexpected DataChannel label');
        return;
      }
      peer.bindDataChannel(channel);
      onLog?.call('Secure DataChannel opened for session $sessionId');
    };

    peerConnection.onConnectionState = (state) {
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
          state == RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
        peer.fail('PeerConnection state: $state');
      }
    };

    try {
      await peerConnection.setRemoteDescription(
        RTCSessionDescription(sdp, 'offer'),
      );
      for (final pending in _pendingCandidates.remove(sessionId) ?? const []) {
        await peerConnection.addCandidate(
          RTCIceCandidate(
            pending['candidate']?.toString(),
            pending['mid']?.toString() ?? '0',
            (pending['sdpMLineIndex'] as num?)?.toInt() ?? 0,
          ),
        );
      }
      final answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      emit('secure_route:answer', {
        'routingSessionId': sessionId,
        'authToken': authToken,
        'sdp': answer.sdp,
      });
    } catch (_) {
      await closeSession(sessionId, notifyBackend: true);
      rethrow;
    }
  }

  static Future<void> acceptIceCandidate(Map<String, dynamic> data) async {
    final sessionId = data['routingSessionId']?.toString() ?? '';
    final candidate = data['candidate']?.toString() ?? '';
    if (sessionId.isEmpty || candidate.isEmpty) return;
    final peer = _peers[sessionId];
    if (peer == null) {
      _pendingCandidates.putIfAbsent(sessionId, () => []).add(data);
      return;
    }
    await peer.peerConnection.addCandidate(
      RTCIceCandidate(
        candidate,
        data['mid']?.toString() ?? '0',
        (data['sdpMLineIndex'] as num?)?.toInt() ?? 0,
      ),
    );
  }

  static Future<void> closeSession(
    String sessionId, {
    bool notifyBackend = false,
  }) async {
    final peer = _peers.remove(sessionId);
    _pendingCandidates.remove(sessionId);
    if (peer == null) return;
    if (notifyBackend) {
      peer.emit('webrtc:close', {
        'routingSessionId': sessionId,
        'authToken': peer.authToken,
        'reason': 'android_peer_closed',
      });
    }
    await peer.dispose();
  }

  static Future<void> closeAll() async {
    final ids = _peers.keys.toList(growable: false);
    for (final id in ids) {
      await closeSession(id, notifyBackend: true);
    }
    _pendingCandidates.clear();
  }

  static bool markTaskForExecution(String taskId) =>
      _executedTaskIds.add(taskId);
}

class _AndroidRoutePeer {
  final String sessionId;
  final String authToken;
  final RTCPeerConnection peerConnection;
  final SignalingEmitter emit;
  final SecureRoutingProtocol protocol = SecureRoutingProtocol();
  final SecureRouteLifecycle lifecycle = SecureRouteLifecycle();
  RTCDataChannel? dataChannel;
  bool disposed = false;
  bool taskInProgress = false;

  _AndroidRoutePeer({
    required this.sessionId,
    required this.authToken,
    required this.peerConnection,
    required this.emit,
  });

  void bindDataChannel(RTCDataChannel channel) {
    dataChannel = channel;
    lifecycle.transition(SecureRouteState.open);
    channel.onMessage = (message) {
      if (message.isBinary || message.text.length > 1024 * 1024) {
        fail('Binary or oversized DataChannel message rejected');
        return;
      }
      unawaited(_handleMessage(message.text));
    };
    channel.onDataChannelState = (state) {
      if (state == RTCDataChannelState.RTCDataChannelClosed && !disposed) {
        fail('DataChannel closed before route completion');
      }
    };
  }

  Future<void> _handleMessage(String raw) async {
    final message = SecureRoutingMessage.parse(
      raw,
      expectedSessionId: sessionId,
    );
    if (message == null || !protocol.acceptOnce(message.messageId)) return;

    if (message.type == 'ping') {
      await send('pong', {'echo': message.messageId});
      return;
    }
    if (message.type != 'task_request') return;

    AuthorizedTaskRequest task;
    try {
      task = AuthorizedTaskRequest.fromMessage(message);
    } catch (error) {
      await send('task_result', _failurePayload('', 403, error.toString()));
      return;
    }

    if (taskInProgress ||
        !AndroidWebRtcService.markTaskForExecution(task.taskId)) {
      await send('ack', {
        'receivedMsgId': message.messageId,
        'duplicate': true,
      });
      return;
    }
    taskInProgress = true;
    lifecycle.transition(SecureRouteState.executing);
    await send('ack', {'receivedMsgId': message.messageId});

    try {
      final targetError = await TaskExecutorService.validateTarget(
        task.targetUrl,
        authorizedHost: task.authorizedHost,
        authorizedPort: task.authorizedPort,
        authorizedMethod: task.authorizedMethod,
      );
      if (targetError != null) {
        await send(
          'task_result',
          _failurePayload(task.taskId, 403, targetError),
        );
        lifecycle.transition(SecureRouteState.resultSent);
        return;
      }

      if (!await NetShareVpnBridge.checkPermission()) {
        await send(
          'task_result',
          _failurePayload(
            task.taskId,
            503,
            'Android VPN permission is not granted',
          ),
        );
        lifecycle.transition(SecureRouteState.resultSent);
        return;
      }

      final authorizedIps = await TaskExecutorService.resolveAuthorizedIpv4(
        task.targetUrl,
        authorizedHost: task.authorizedHost,
        authorizedPort: task.authorizedPort,
        authorizedMethod: task.authorizedMethod,
      );

      await NetShareVpnBridge.stopService().catchError(
        (_) => <String, dynamic>{},
      );
      await NetShareVpnBridge.startService(
        sessionName: 'NetShare-$sessionId',
        routingSessionId: sessionId,
        authorizedHost: task.authorizedHost,
        authorizedPort: task.authorizedPort,
        authorizedMethod: task.authorizedMethod,
        authorizedIps: authorizedIps,
      );
      await _waitForVpn();

      final result = await TaskExecutorService.executeRequestBatch(
        executionLimit: task.executionLimit,
        timeoutMs: task.timeoutMs,
        execute: (remainingMs) =>
            TaskExecutorService.executeHttpPerformanceTest(
              task.targetUrl,
              timeoutMs: remainingMs,
              authorizedHost: task.authorizedHost,
              authorizedPort: task.authorizedPort,
              authorizedMethod: task.authorizedMethod,
              requireTunForwarding: true,
            ),
      );
      final payload = result.toMap(task.taskId)
        ..['routingSessionId'] = sessionId;
      await send('task_result', payload);
      lifecycle.transition(SecureRouteState.resultSent);
    } catch (error) {
      await send(
        'task_result',
        _failurePayload(task.taskId, 500, error.toString()),
      );
      if (lifecycle.state == SecureRouteState.executing) {
        lifecycle.transition(SecureRouteState.resultSent);
      }
    } finally {
      await NetShareVpnBridge.stopService().catchError(
        (_) => <String, dynamic>{},
      );
      taskInProgress = false;
    }
  }

  Future<void> _waitForVpn() async {
    for (var attempt = 0; attempt < 50; attempt += 1) {
      final status = await NetShareVpnBridge.getStatus();
      if (status.state == VpnState.connected && status.isRunning) return;
      if (status.state == VpnState.revoked) {
        throw StateError('Android VPN permission was revoked');
      }
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    throw TimeoutException('VpnService did not become ready');
  }

  Map<String, dynamic> _failurePayload(
    String taskId,
    int statusCode,
    String message,
  ) => {
    'taskId': taskId,
    'success': false,
    'statusCode': statusCode,
    'latencyMs': 0,
    'bandwidthUsedMB': 0,
    'downloadBandwidthMB': 0,
    'uploadBandwidthMB': 0,
    'packetLoss': 100,
    'successRate': 0,
    'resultData': {'error': message},
    'completedAt': DateTime.now().toUtc().toIso8601String(),
  };

  Future<void> send(String type, Map<String, dynamic> payload) async {
    final channel = dataChannel;
    if (channel == null) throw StateError('DataChannel is unavailable');
    final envelope = protocol.build(sessionId, type, payload);
    channel.send(RTCDataChannelMessage(envelope.encode()));
  }

  void fail(String reason) {
    if (disposed) return;
    if (lifecycle.state != SecureRouteState.failed &&
        lifecycle.state != SecureRouteState.closed) {
      lifecycle.transition(SecureRouteState.failed);
    }
    AndroidWebRtcService.onLog?.call('Secure route failure: $reason');
    emit('webrtc:close', {
      'routingSessionId': sessionId,
      'authToken': authToken,
      'reason': reason,
    });
    unawaited(AndroidWebRtcService.closeSession(sessionId));
  }

  Future<void> dispose() async {
    if (disposed) return;
    disposed = true;
    if (lifecycle.state == SecureRouteState.executing) {
      lifecycle.transition(SecureRouteState.failed);
    }
    if (lifecycle.state != SecureRouteState.closed) {
      lifecycle.transition(SecureRouteState.closed);
    }
    await NetShareVpnBridge.stopService().catchError(
      (_) => <String, dynamic>{},
    );
    try {
      await dataChannel?.close();
    } catch (_) {}
    try {
      await peerConnection.close();
    } catch (_) {}
    try {
      await peerConnection.dispose();
    } catch (_) {}
    protocol.clear();
  }
}
