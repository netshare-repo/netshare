import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'task_executor_service.dart';

/// Small, bounded UDP binding probes to a STUN server already supplied by the
/// authenticated control plane. Loss is probe-response loss, NOT HTTP failures
/// or a claim of loss on every application packet.
class StunDiagnostics {
  static Map<String, dynamic>? latest;
  static bool _running = false;
  static Map<String, dynamic>? get recent {
    final value = latest;
    if (value == null ||
        DateTime.now().millisecondsSinceEpoch - (value['measuredAtMs'] as int) >
            60000) {
      return null;
    }
    return value;
  }

  static Future<void> update(List<Map<String, dynamic>> iceServers) async {
    if (_running) return;
    final urls = iceServers
        .expand((s) => s['urls'] is List ? s['urls'] as List : [s['urls']])
        .whereType<String>();
    final stun = urls.where((url) => url.startsWith('stun:')).firstOrNull;
    if (stun == null) return;
    _running = true;
    try {
      latest = await sample(stun);
    } finally {
      _running = false;
    }
  }

  static Future<Map<String, dynamic>?> sample(
    String url, {
    Future<List<InternetAddress>> Function(String)? lookup,
    Future<Uint8List?> Function(InternetAddress, int, Uint8List)? exchange,
  }) async {
    try {
      final uri = Uri.parse(url.replaceFirst('stun:', 'stun://'));
      if (uri.scheme != 'stun' ||
          uri.host.isEmpty ||
          uri.userInfo.isNotEmpty ||
          uri.hasQuery) {
        return null;
      }
      final port = uri.hasPort ? uri.port : 3478;
      if (port < 1 || port > 65535) return null;
      final addresses = await (lookup ?? InternetAddress.lookup)(
        uri.host,
      ).timeout(const Duration(seconds: 2));
      final ipv4 = addresses
          .where((a) => a.type == InternetAddressType.IPv4)
          .toList();
      if (ipv4.isEmpty ||
          ipv4.any(
            (a) => TaskExecutorService.isPrivateOrBlockedIp(a.address),
          )) {
        return null;
      }
      final rtts = <double>[];
      for (var i = 0; i < 4; i++) {
        final packet = Uint8List(20)
          ..[1] = 1
          ..[4] = 0x21
          ..[5] = 0x12
          ..[6] = 0xa4
          ..[7] = 0x42;
        final random = Random.secure();
        for (var j = 8; j < 20; j++) {
          packet[j] = random.nextInt(256);
        }
        final watch = Stopwatch()..start();
        final response = await (exchange ?? _exchange)(
          ipv4.first,
          port,
          packet,
        );
        watch.stop();
        if (response != null && validResponse(packet, response)) {
          rtts.add(watch.elapsedMicroseconds / 1000);
        }
      }
      final jitter = <double>[];
      for (var i = 1; i < rtts.length; i++) {
        jitter.add((rtts[i] - rtts[i - 1]).abs());
      }
      return {
        'packetLoss': (4 - rtts.length) * 25,
        'probeSent': 4,
        'probeReceived': rtts.length,
        'packetLossSource': 'stun_binding_response_timeout_400ms',
        'latencyMs': rtts.isEmpty
            ? null
            : rtts.reduce((a, b) => a + b) / rtts.length,
        'stabilityJitterMs': jitter.isEmpty
            ? null
            : jitter.reduce((a, b) => a + b) / jitter.length,
        'measuredAtMs': DateTime.now().millisecondsSinceEpoch,
      };
    } catch (_) {
      return null;
    }
  }

  static bool validResponse(Uint8List request, Uint8List response) =>
      response.length >= 20 &&
      response[0] == 1 &&
      response[1] == 1 &&
      ((response[2] << 8) | response[3]) == response.length - 20 &&
      List.generate(16, (i) => i + 4).every((i) => request[i] == response[i]);

  static Future<Uint8List?> _exchange(
    InternetAddress address,
    int port,
    Uint8List packet,
  ) async {
    final socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
    final answer = Completer<Uint8List?>();
    final subscription = socket.listen(
      (event) {
        if (event != RawSocketEvent.read) return;
        final message = socket.receive();
        if (message != null &&
            message.address.address == address.address &&
            message.port == port &&
            validResponse(packet, message.data) &&
            !answer.isCompleted) {
          answer.complete(message.data);
        }
      },
      onError: (Object error) {
        if (!answer.isCompleted) answer.completeError(error);
      },
    );
    try {
      if (socket.send(packet, address, port) != packet.length) {
        throw const SocketException('STUN send failed');
      }
      return await answer.future.timeout(
        const Duration(milliseconds: 400),
        onTimeout: () => null,
      );
    } finally {
      await subscription.cancel();
      socket.close();
    }
  }
}
