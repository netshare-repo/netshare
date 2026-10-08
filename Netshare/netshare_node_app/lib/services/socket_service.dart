import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;
import 'api_service.dart';
import 'android_webrtc_service.dart';

class NodeSocketService {
  static socket_io.Socket? _socket;
  static bool _isConnected = false;
  static Timer? _heartbeatTimer;
  static String? _currentNodeId;
  static Function(String message)? onLog;
  static Function(bool isOnline)? onStatusChange;

  static bool get isConnected => _isConnected;

  /// Connect to the backend execution plane
  static Future<void> connect({
    required String serverUrl,
    String? apiKey,
    String? nodeId,
  }) async {
    if (_socket != null && _socket!.connected) return;

    final token = await ApiService.getToken();
    _currentNodeId = nodeId;

    final options = socket_io.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .enableAutoConnect()
        .enableReconnection()
        .setReconnectionDelay(2000)
        .setAuth({
          'token': token,
          'apiKey': apiKey,
          'nodeApiKey': apiKey,
          'nodeId': nodeId,
          'role': 'node',
        })
        .build();

    final socket = socket_io.io(serverUrl, options);
    _socket = socket;

    socket.onConnect((_) {
      _isConnected = true;
      onStatusChange?.call(true);
      onLog?.call("Connected to NetShare Execution Plane ($serverUrl)");
      _startHeartbeat();
    });

    socket.on('node_connect_ack', (data) {
      if (data is Map && data.containsKey('nodeId')) {
        _currentNodeId = data['nodeId'];
      }
      onLog?.call("Handshake confirmed by server: ${_currentNodeId ?? ''}");
    });

    AndroidWebRtcService.onLog = onLog;
    socket.on('secure_route:offer', (data) async {
      if (data is! Map) return;
      try {
        final offer = Map<String, dynamic>.from(data);
        onLog?.call('Received authenticated Android WebRTC offer');
        await AndroidWebRtcService.acceptOffer(offer, _emitSignaling);
      } catch (error) {
        onLog?.call('WebRTC offer rejected: $error');
      }
    });
    socket.on('secure_route:ice_candidate', (data) async {
      if (data is Map) {
        await AndroidWebRtcService.acceptIceCandidate(
          Map<String, dynamic>.from(data),
        );
      }
    });
    socket.on('secure_route:settled', (data) async {
      if (data is! Map) return;
      final sessionId = data['routingSessionId']?.toString();
      if (sessionId != null) {
        onLog?.call('Secure Android task settled exactly once');
        await AndroidWebRtcService.closeSession(sessionId);
      }
    });
    socket.on('secure_route:error', (data) {
      onLog?.call('Secure route error: $data');
    });

    socket.onDisconnect((reason) {
      _isConnected = false;
      onStatusChange?.call(false);
      onLog?.call("Disconnected from server: $reason");
      _stopHeartbeat();
    });

    socket.onConnectError((err) {
      onLog?.call("Connection error: $err");
    });
  }

  /// Start 10-second heartbeat loop
  static void _startHeartbeat() {
    _stopHeartbeat();
    _sendHeartbeat();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _sendHeartbeat();
    });
  }

  static void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  static void _sendHeartbeat() {
    if (_socket == null || !_socket!.connected) return;

    // Send only what we can honestly measure.
    // Android has no reliable userland API for CPU/memory.
    // Network metrics are only available during active task execution.
    final payload = {
      'nodeId': _currentNodeId,
      'status': 'active',
      'cpuUsage': null, // Unavailable on Android without platform channel
      'memoryUsage': null, // Unavailable on Android without platform channel
      'networkStatus': {
        'latencyMs': null, // Measured only during active tasks
        'uploadSpeedMbps': null, // Measured only during active tasks
        'downloadSpeedMbps': null, // Measured only during active tasks
        'packetLoss': null, // Measured only during active tasks
      },
      'timestamp': DateTime.now().toIso8601String(),
    };

    _socket!.emit('heartbeat', payload);
  }

  static void _emitSignaling(String event, Map<String, dynamic> payload) {
    final socket = _socket;
    if (socket == null || !socket.connected) {
      throw StateError('Socket signaling channel is unavailable');
    }
    socket.emit(event, payload);
  }

  /// Disconnect socket cleanly
  static Future<void> disconnect() async {
    _stopHeartbeat();
    await AndroidWebRtcService.closeAll();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
    onStatusChange?.call(false);
  }
}
