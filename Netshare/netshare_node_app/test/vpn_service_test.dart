import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:netshare_node_app/services/vpn_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const MethodChannel channel = MethodChannel('io.netshare.node/vpn');
  final List<MethodCall> log = <MethodCall>[];

  setUp(() {
    log.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
          log.add(methodCall);

          switch (methodCall.method) {
            case 'checkPermission':
              return true;
            case 'requestPermission':
              return true;
            case 'startService':
              return <String, dynamic>{
                'status': 'connecting',
                'virtualIp': methodCall.arguments['virtualIp'] ?? '10.254.1.2',
                'routingScope':
                    '${methodCall.arguments['subnetRoute']}/${methodCall.arguments['prefixLength']}',
              };
            case 'stopService':
              return <String, dynamic>{'status': 'disconnected'};
            case 'getStatus':
              return <String, dynamic>{
                'status': 'connected',
                'hasPermission': true,
                'routingScope': '10.254.1.0/24',
                'isRunning': true,
              };
            default:
              return null;
          }
        });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  group('NetShareVpnBridge MethodChannel tests', () {
    test('checkPermission returns true when native returns true', () async {
      final hasPermission = await NetShareVpnBridge.checkPermission();
      expect(hasPermission, isTrue);
      expect(log, hasLength(1));
      expect(log.first.method, 'checkPermission');
    });

    test('checkPermission returns false when native returns false', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async => false);

      final hasPermission = await NetShareVpnBridge.checkPermission();
      expect(hasPermission, isFalse);
    });

    test(
      'requestPermission returns true when user grants permission',
      () async {
        final granted = await NetShareVpnBridge.requestPermission();
        expect(granted, isTrue);
        expect(log, hasLength(1));
        expect(log.first.method, 'requestPermission');
      },
    );

    test(
      'requestPermission returns false when user denies permission',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(
              channel,
              (MethodCall call) async => false,
            );

        final granted = await NetShareVpnBridge.requestPermission();
        expect(granted, isFalse);
      },
    );

    test('startService sends narrow routing scope parameters', () async {
      final result = await NetShareVpnBridge.startService(
        sessionName: 'CustomTestRouting',
        virtualIp: '10.254.1.5',
        subnetRoute: '10.254.1.0',
        prefixLength: 24,
        routingSessionId: 'route-1',
        authorizedHost: 'example.com',
        authorizedPort: 443,
        authorizedMethod: 'HEAD',
        authorizedIps: const ['93.184.216.34'],
      );

      expect(log, hasLength(1));
      expect(log.first.method, 'startService');
      expect(log.first.arguments['sessionName'], 'CustomTestRouting');
      expect(log.first.arguments['virtualIp'], '10.254.1.5');
      expect(log.first.arguments['subnetRoute'], '10.254.1.0');
      expect(log.first.arguments['prefixLength'], 24);
      expect(log.first.arguments['routingSessionId'], 'route-1');
      expect(log.first.arguments['authorizedHost'], 'example.com');
      expect(log.first.arguments['authorizedPort'], 443);
      expect(log.first.arguments['authorizedMethod'], 'HEAD');
      expect(log.first.arguments['authorizedIps'], ['93.184.216.34']);

      expect(result['status'], 'connecting');
      expect(result['virtualIp'], '10.254.1.5');
      expect(result['routingScope'], '10.254.1.0/24');
    });

    test('stopService stops VPN and returns disconnected', () async {
      final result = await NetShareVpnBridge.stopService();
      expect(log, hasLength(1));
      expect(log.first.method, 'stopService');
      expect(result['status'], 'disconnected');
    });

    test('getStatus parses running VPN status correctly', () async {
      final status = await NetShareVpnBridge.getStatus();
      expect(log, hasLength(1));
      expect(log.first.method, 'getStatus');
      expect(status.state, VpnState.connected);
      expect(status.hasPermission, isTrue);
      expect(status.routingScope, '10.254.1.0/24');
      expect(status.isRunning, isTrue);
    });

    test('getStatus handles revoked state', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            channel,
            (MethodCall call) async => <String, dynamic>{
              'status': 'revoked',
              'hasPermission': false,
              'routingScope': '10.254.1.0/24',
              'isRunning': false,
            },
          );

      final status = await NetShareVpnBridge.getStatus();
      expect(status.state, VpnState.revoked);
      expect(status.hasPermission, isFalse);
      expect(status.isRunning, isFalse);
    });

    test('VpnStatus and VpnEvent model serialization', () {
      final status = VpnStatus.fromMap({
        'status': 'connecting',
        'hasPermission': true,
        'routingScope': '10.254.1.0/24',
        'isRunning': false,
      });
      expect(status.state, VpnState.connecting);
      expect(status.toString(), contains('connecting'));

      final event = VpnEvent.fromMap({
        'state': 'revoked',
        'routingScope': '10.254.1.0/24',
      });
      expect(event.state, VpnState.revoked);
      expect(event.toString(), contains('revoked'));
    });
  });
}
