import 'dart:async';
import 'package:flutter/services.dart';

/// Represents the status of the Android VpnService.
enum VpnState { disconnected, connecting, connected, revoked, unknown }

/// Model for the detailed VPN status returned by the bridge.
class VpnStatus {
  final VpnState state;
  final bool hasPermission;
  final String routingScope;
  final bool isRunning;

  const VpnStatus({
    required this.state,
    required this.hasPermission,
    required this.routingScope,
    required this.isRunning,
  });

  factory VpnStatus.fromMap(Map<dynamic, dynamic> map) {
    return VpnStatus(
      state: _parseState(map['status']?.toString()),
      hasPermission: map['hasPermission'] == true,
      routingScope: map['routingScope']?.toString() ?? '10.254.1.0/24',
      isRunning: map['isRunning'] == true,
    );
  }

  static VpnState _parseState(String? str) {
    switch (str?.toLowerCase()) {
      case 'connected':
        return VpnState.connected;
      case 'connecting':
        return VpnState.connecting;
      case 'revoked':
        return VpnState.revoked;
      case 'disconnected':
      case 'idle':
        return VpnState.disconnected;
      default:
        return VpnState.unknown;
    }
  }

  @override
  String toString() =>
      'VpnStatus(state: $state, hasPermission: $hasPermission, routingScope: $routingScope, isRunning: $isRunning)';
}

/// Event streamed from native VpnService on state changes.
class VpnEvent {
  final VpnState state;
  final String routingScope;

  const VpnEvent({required this.state, required this.routingScope});

  factory VpnEvent.fromMap(Map<dynamic, dynamic> map) {
    return VpnEvent(
      state: VpnStatus._parseState(map['state']?.toString()),
      routingScope: map['routingScope']?.toString() ?? '10.254.1.0/24',
    );
  }

  @override
  String toString() => 'VpnEvent(state: $state, routingScope: $routingScope)';
}

/// Flutter Platform-Channel Bridge for NetShare Android VpnService.
///
/// Implements SRS SI-4 and OE-5: controlled traffic forwarding through Android
/// devices without unrestricted device proxying.
class NetShareVpnBridge {
  static const MethodChannel _channel = MethodChannel('io.netshare.node/vpn');
  static const EventChannel _eventChannel = EventChannel(
    'io.netshare.node/vpn_events',
  );

  static Stream<VpnEvent>? _eventStream;

  /// Check if the app currently has Android VPN permission.
  static Future<bool> checkPermission() async {
    try {
      final bool? result = await _channel.invokeMethod<bool>('checkPermission');
      return result ?? false;
    } on PlatformException catch (_) {
      // Non-Android platforms return false
      return false;
    }
  }

  /// Request VPN permission from the user via Android system dialog.
  ///
  /// Returns `true` if granted, `false` if denied or cancelled by user.
  static Future<bool> requestPermission() async {
    try {
      final bool? result = await _channel.invokeMethod<bool>(
        'requestPermission',
      );
      return result ?? false;
    } on PlatformException catch (_) {
      return false;
    }
  }

  /// Start the NetShare VpnService with controlled routing scope.
  ///
  /// Strict security policy:
  /// - Only the designated testing subnet (default: 10.254.1.0/24) is routed.
  /// - Never routes 0.0.0.0/0 (no unrestricted proxy/VPN behavior).
  /// - Runs with foreground notification to survive background & screen lock.
  static Future<Map<String, dynamic>> startService({
    String sessionName = 'NetShareControlledRouting',
    String virtualIp = '10.254.1.2',
    String subnetRoute = '10.254.1.0',
    int prefixLength = 24,
    String? routingSessionId,
    String? authorizedHost,
    int? authorizedPort,
    String authorizedMethod = 'GET',
    List<String> authorizedIps = const [],
  }) async {
    try {
      final Map<dynamic, dynamic>? result = await _channel
          .invokeMethod<Map<dynamic, dynamic>>('startService', {
            'sessionName': sessionName,
            'virtualIp': virtualIp,
            'subnetRoute': subnetRoute,
            'prefixLength': prefixLength,
            'routingSessionId': routingSessionId,
            'authorizedHost': authorizedHost,
            'authorizedPort': authorizedPort,
            'authorizedMethod': authorizedMethod,
            'authorizedIps': authorizedIps,
          });
      return Map<String, dynamic>.from(result ?? {});
    } on PlatformException catch (e) {
      throw Exception('Failed to start VpnService: ${e.message}');
    }
  }

  /// Stop the NetShare VpnService.
  static Future<Map<String, dynamic>> stopService() async {
    try {
      final Map<dynamic, dynamic>? result = await _channel
          .invokeMethod<Map<dynamic, dynamic>>('stopService');
      return Map<String, dynamic>.from(result ?? {});
    } on PlatformException catch (e) {
      throw Exception('Failed to stop VpnService: ${e.message}');
    }
  }

  /// Get current status of the VPN service and permission state.
  static Future<VpnStatus> getStatus() async {
    try {
      final Map<dynamic, dynamic>? result = await _channel
          .invokeMethod<Map<dynamic, dynamic>>('getStatus');
      return VpnStatus.fromMap(result ?? {});
    } on PlatformException catch (_) {
      return const VpnStatus(
        state: VpnState.disconnected,
        hasPermission: false,
        routingScope: '10.254.1.0/24',
        isRunning: false,
      );
    }
  }

  /// Get real-time TUN forwarding throughput metrics (packets/bytes in/out).
  static Future<Map<String, dynamic>> getTunMetrics() async {
    try {
      final Map<dynamic, dynamic>? result = await _channel
          .invokeMethod<Map<dynamic, dynamic>>('getTunMetrics');
      return Map<String, dynamic>.from(result ?? {});
    } on PlatformException catch (_) {
      return {
        'bytesIn': 0,
        'bytesOut': 0,
        'packetsIn': 0,
        'packetsOut': 0,
        'state': 'disconnected',
        'routingScope': '10.254.1.0/24',
      };
    }
  }

  /// Stream of real-time VPN status changes (e.g. connected, revoked, disconnected).
  static Stream<VpnEvent> get eventStream {
    _eventStream ??= _eventChannel.receiveBroadcastStream().map(
      (event) => VpnEvent.fromMap(Map<dynamic, dynamic>.from(event)),
    );
    return _eventStream!;
  }
}
