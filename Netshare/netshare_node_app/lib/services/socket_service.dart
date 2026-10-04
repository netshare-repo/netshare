import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;
import 'api_service.dart';
import 'task_executor_service.dart';

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

    socket.on('task_assigned', (data) async {
      if (data is Map) {
        onLog?.call("Received task: ${data['taskId']} (${data['taskType']})");
        await _handleTaskExecution(Map<String, dynamic>.from(data));
      }
    });

    socket.on('task_completed_ack', (data) {
      if (data is Map) {
        onLog?.call("Reward settled: +${data['rewardEarned']} credits");
      }
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

  /// Handle incoming task execution on mobile edge
  static Future<void> _handleTaskExecution(Map<String, dynamic> task) async {
    final taskId = task['taskId']?.toString() ?? '';
    final target = task['target']?.toString() ?? '';
    final taskType = task['taskType']?.toString() ?? 'performance_testing';

    if (taskId.isEmpty || target.isEmpty) return;

    // 1. Notify server task started
    _socket?.emit('task_started', {'taskId': taskId});

    // 2. Execute task using edge executor
    TaskExecutionResult result;
    if (taskType.toLowerCase().contains('ping')) {
      result = await TaskExecutorService.executePingTest(target);
    } else {
      result = await TaskExecutorService.executeHttpPerformanceTest(target);
    }

    onLog?.call("Task completed: ${result.statusCode}, Latency: ${result.latencyMs}ms, Size: ${result.bandwidthUsedMB}MB");

    // 3. Send results back to control plane
    _socket?.emit('task_completed', result.toMap(taskId));
  }

  /// Disconnect socket cleanly
  static void disconnect() {
    _stopHeartbeat();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
    onStatusChange?.call(false);
  }
}
