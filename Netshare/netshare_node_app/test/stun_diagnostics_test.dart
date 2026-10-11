import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:netshare_node_app/services/stun_diagnostics.dart';

void main() {
  test(
    'STUN probes derive loss from missing validated responses, not HTTP errors',
    () async {
      var sent = 0;
      final result = await StunDiagnostics.sample(
        'stun:fixture.test:3478',
        lookup: (_) async => [InternetAddress('8.8.8.8')],
        exchange: (address, port, packet) async {
          expect(port, 3478);
          expect(packet.length, 20);
          sent++;
          if (sent == 2) return null;
          return Uint8List.fromList(packet)..[0] = 1;
        },
      );
      expect(sent, 4);
      expect(result!['packetLoss'], 25);
      expect(result['probeReceived'], 3);
      expect(result['latencyMs'], isA<double>());
      expect(result['stabilityJitterMs'], isA<double>());
      expect(result['packetLossSource'], 'stun_binding_response_timeout_400ms');
    },
  );
  test(
    'private, metadata, malformed or absent STUN configuration never sends probes',
    () async {
      var sends = 0;
      for (final url in [
        'stun:fixture.test',
        'turn:fixture.test',
        'https://fixture.test',
      ]) {
        final result = await StunDiagnostics.sample(
          url,
          lookup: (_) async => [InternetAddress('169.254.169.254')],
          exchange: (_, _, _) async {
            sends++;
            return null;
          },
        );
        expect(result, isNull);
      }
      expect(sends, 0);
    },
  );
  test(
    'spoofed STUN transaction/cookie cannot count as a successful response',
    () async {
      final result = await StunDiagnostics.sample(
        'stun:fixture.test',
        lookup: (_) async => [InternetAddress('8.8.8.8')],
        exchange: (_, _, packet) async => Uint8List.fromList(packet)
          ..[0] = 1
          ..[8] ^= 255,
      );
      expect(result!['packetLoss'], 100);
      expect(result['latencyMs'], isNull);
    },
  );
  test(
    'failed local measurement is unavailable, not zero/100 percent packet loss',
    () async {
      final result = await StunDiagnostics.sample(
        'stun:fixture.test',
        lookup: (_) async => throw const SocketException('Unavailable'),
      );
      expect(result, isNull);
      StunDiagnostics.latest = {'measuredAtMs': 0, 'packetLoss': 0};
      expect(StunDiagnostics.recent, isNull);
    },
  );
}
