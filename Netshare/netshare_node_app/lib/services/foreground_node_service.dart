import 'dart:async';
import 'package:flutter/foundation.dart';
import 'socket_service.dart';
import 'node_service.dart';
import 'vpn_service.dart';
import '../core/constants/api_constants.dart';

class ForegroundNodeService {
  static bool _isRunning = false;
  static final ValueNotifier<bool> isRunningNotifier = ValueNotifier<bool>(
    false,
  );
  static final List<String> executionLogs = [];
  static final ValueNotifier<List<String>> logsNotifier =
      ValueNotifier<List<String>>([]);

  static bool get isRunning => _isRunning;

  /// Starts the node background worker & real-time connection
  static Future<void> start({String? customServerUrl, String? apiKey}) async {
    if (_isRunning) return;

    _isRunning = true;
    isRunningNotifier.value = true;
    _addLog("Starting NetShare Mobile Node Agent...");

    var vpnPermission = await NetShareVpnBridge.checkPermission();
    if (!vpnPermission) {
      _addLog('Android VPN permission is required for secure task routing.');
      vpnPermission = await NetShareVpnBridge.requestPermission();
    }
    if (!vpnPermission) {
      _isRunning = false;
      isRunningNotifier.value = false;
      _addLog('Node Agent start cancelled: VPN permission denied.');
      throw StateError('Android VPN permission is required');
    }

    try {
      // 1. Notify control plane that participation session is active
      await NodeService.startParticipation();
      _addLog("Participation session marked active in Control Plane.");
    } catch (e) {
      _addLog("Control plane start note: ${e.toString()}");
    }

    // Determine server URL (stripping '/api' from ApiConstants.baseUrl)
    final serverUrl =
        customServerUrl ?? ApiConstants.baseUrl.replaceAll('/api', '');

    NodeSocketService.onLog = (log) {
      _addLog(log);
    };

    NodeSocketService.onStatusChange = (isOnline) {
      _addLog(
        isOnline ? "Node Agent Status: ONLINE" : "Node Agent Status: OFFLINE",
      );
    };

    // 2. Connect real-time socket
    await NodeSocketService.connect(serverUrl: serverUrl, apiKey: apiKey);
  }

  /// Stops the node background worker and disconnects
  static Future<void> stop() async {
    if (!_isRunning) return;

    _addLog("Stopping NetShare Node Agent...");
    await NodeSocketService.disconnect();

    try {
      await NodeService.stopParticipation();
      _addLog("Participation session stopped in Control Plane.");
    } catch (e) {
      _addLog("Control plane stop note: ${e.toString()}");
    }

    _isRunning = false;
    isRunningNotifier.value = false;
    _addLog("Node Agent is now offline.");
  }

  static void _addLog(String message) {
    final timestamp = DateTime.now().toIso8601String().substring(11, 19);
    final entry = "[$timestamp] $message";
    executionLogs.insert(0, entry);
    if (executionLogs.length > 50) {
      executionLogs.removeLast();
    }
    logsNotifier.value = List<String>.from(executionLogs);
  }
}
