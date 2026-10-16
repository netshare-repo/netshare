import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:netshare_node_app/services/android_webrtc_service.dart';
import 'package:netshare_node_app/services/public_data_fetch_executor.dart';
import 'package:netshare_node_app/services/secure_routing_protocol.dart';
import 'package:netshare_node_app/services/vpn_service.dart';

const sessionId = 'route-11b';
const target = 'https://example.com/data';
final publicIp = InternetAddress('8.8.8.8');

AuthorizedTaskRequest request({Map<String, dynamic> changes = const {}}) {
  final fetch = {
    'contractVersion': 1,
    'serviceType': 'PUBLIC_DATA_FETCH',
    'taskId': 'task-11b',
    'routingSessionId': sessionId,
    'targetUrl': target,
    'method': 'GET',
    'maxResponseBytes': 16384,
    'acceptedMediaTypes': ['application/json', 'text/html', 'text/plain'],
    'redirectPolicy': 'same-origin-https-only',
    'credentials': 'omit',
  };
  final payload = {
    'taskId': 'task-11b',
    'routingSessionId': sessionId,
    'targetUrl': target,
    'authorizedHost': 'example.com',
    'authorizedPort': 443,
    'authorizedMethod': 'GET',
    'serviceType': 'PUBLIC_DATA_FETCH',
    'targetRegion': 'USA',
    'executionLimit': 1,
    'timeoutMs': 5000,
    'issuedAt': DateTime.now().toUtc().toIso8601String(),
    'publicDataFetch': fetch,
    ...changes,
  };
  return AuthorizedTaskRequest.fromMessage(
    SecureRoutingProtocol().build(sessionId, 'task_request', payload),
  );
}

class FakeTransport implements PublicFetchTransport {
  final List<PublicFetchResponse> replies;
  void Function(PublicFetchCancellation cancellation)? onRequest;
  int calls = 0;
  final List<String> urls = [];
  FakeTransport(this.replies);

  @override
  Future<PublicFetchResponse> get(
    Uri uri,
    InternetAddress pinnedIp,
    Duration timeout,
    PublicFetchCancellation cancellation,
  ) async {
    expect(pinnedIp.address, publicIp.address);
    urls.add(uri.toString());
    onRequest?.call(cancellation);
    return replies[calls++];
  }
}

PublicFetchResponse reply(
  int status,
  String content, {
  String? type = 'text/plain',
  String? encoding,
  String? location,
  int? length,
  List<int>? raw,
}) {
  final bytes = raw ?? utf8.encode(content);
  return PublicFetchResponse(
    statusCode: status,
    contentType: type,
    contentEncoding: encoding,
    location: location,
    contentLength: length ?? bytes.length,
    body: Stream.value(bytes),
    close: () {},
  );
}

class FakeVpn implements PublicFetchVpn {
  bool available = true;
  String session = sessionId;
  int get calls => transport.calls;
  final FakeTransport transport;
  final controller = StreamController<VpnState>.broadcast();
  int metricCalls = 0;
  Future<void> Function(int call)? beforeMetrics;
  FakeVpn(this.transport);

  @override
  Future<bool> ready(String sessionId) async =>
      available && sessionId == session;

  @override
  Future<Map<String, dynamic>> metrics() async {
    metricCalls += 1;
    await beforeMetrics?.call(metricCalls);
    return {
      'state': available ? 'connected' : 'disconnected',
      'routingSessionId': session,
      'bytesIn': calls * 100,
      'bytesOut': calls * 200,
      'packetsIn': calls,
      'packetsOut': calls,
    };
  }

  @override
  Stream<VpnState> get states => controller.stream;

  Future<void> dispose() => controller.close();
}

Future<PublicDataFetchResult> run(
  FakeTransport transport, {
  PublicDnsLookup? dns,
  FakeVpn? vpn,
  AuthorizedTaskRequest? task,
  List<String> installedIps = const ['8.8.8.8'],
}) async {
  final route = vpn ?? FakeVpn(transport);
  try {
    return await PublicDataFetchExecutor(
      dnsLookup: dns ?? (_) async => [publicIp],
      transport: transport,
      vpn: route,
    ).execute(
      task ?? request(),
      nodeId: 'node-11b',
      installedIps: installedIps,
      cancellation: PublicFetchCancellation(),
    );
  } finally {
    if (vpn == null) await route.dispose();
  }
}

void main() {
  test('v1 request rejects credential/header injection and wrong session', () {
    expect(
      () => request(
        changes: {
          'headers': {'Authorization': 'secret'},
        },
      ),
      throwsFormatException,
    );
    expect(
      () => request(changes: {'routingSessionId': 'forged'}),
      throwsFormatException,
    );
    expect(
      () => request(
        changes: {
          'publicDataFetch': {
            'contractVersion': 1,
            'serviceType': 'PUBLIC_DATA_FETCH',
            'taskId': 'task-11b',
            'routingSessionId': sessionId,
            'targetUrl': target,
            'method': 'GET',
            'maxResponseBytes': 16384,
            'acceptedMediaTypes': [
              'application/json',
              'text/html',
              'text/plain',
            ],
            'redirectPolicy': 'same-origin-https-only',
            'credentials': 'omit',
            'cookie': 'secret',
          },
        },
      ),
      throwsFormatException,
    );
  });

  for (final type in ['application/json', 'text/html', 'text/plain']) {
    test('returns bounded $type content with Phase 11A result shape', () async {
      final body = type == 'application/json'
          ? '{"ok":true}'
          : type == 'text/html'
          ? '<h1>Hi</h1>'
          : 'hello';
      final result = await run(FakeTransport([reply(200, body, type: type)]));
      expect(result.success, true);
      final payload = result.toPayload(
        taskId: 'task-11b',
        sessionId: sessionId,
        nodeId: 'node-11b',
        targetRegion: 'USA',
      );
      expect(payload['contractVersion'], 1);
      expect(payload['nodeId'], 'node-11b');
      expect(payload['routingSessionId'], sessionId);
      final data = payload['resultData'] as Map<String, dynamic>;
      expect(data['schemaVersion'], 1);
      expect(data['content'], body);
      expect(data['contentType'], type);
      expect(data['responseSizeBytes'], utf8.encode(body).length);
      expect(data['httpStatus'], 200);
      expect(payload['latencyMs'], data['totalTimeMs']);
      expect(data['finalUrl'], target);
    });
  }

  test('rejects unsupported content type, binary and invalid UTF-8', () async {
    for (final response in [
      reply(200, 'x', type: 'application/pdf'),
      reply(200, '', raw: [0, 1], type: 'text/plain'),
      reply(200, '', raw: [0xff], type: 'text/plain'),
      reply(200, 'encoded', encoding: 'gzip'),
      reply(200, 'encoded', type: 'text/plain; charset=iso-8859-1'),
    ]) {
      final result = await run(FakeTransport([response]));
      expect(result.success, false);
      expect(result.content, null);
      expect(result.responseSizeBytes, 0);
      expect(result.httpStatus, 0);
    }
  });

  test('stops when length or streamed body exceeds 16 KiB', () async {
    final boundary = await run(FakeTransport([reply(200, 'a' * 16384)]));
    expect(boundary.success, true);
    expect(boundary.responseSizeBytes, 16384);
    final tooLarge = 'a' * 16385;
    final declared = FakeTransport([reply(200, tooLarge)]);
    expect((await run(declared)).success, false);
    final streamed = FakeTransport([reply(200, tooLarge, length: -1)]);
    final result = await run(streamed);
    expect(result.success, false);
    expect(result.error, contains('16 KiB'));
  });

  test(
    'rejects unsafe redirect and DNS rebound without second socket',
    () async {
      final transport = FakeTransport([
        reply(302, '', location: 'http://169.254.169.254/latest'),
      ]);
      expect((await run(transport)).success, false);
      expect(transport.calls, 1);

      final rebound = FakeTransport([reply(200, 'ok')]);
      final result = await run(
        rebound,
        dns: (_) async => [InternetAddress('10.0.0.1')],
      );
      expect(result.success, false);
      expect(rebound.calls, 0);
    },
  );

  test('same origin redirect is revalidated against installed route', () async {
    final transport = FakeTransport([
      reply(302, '', location: '/next'),
      reply(200, 'ok'),
    ]);
    var lookups = 0;
    final result = await run(
      transport,
      dns: (_) async {
        lookups++;
        return [InternetAddress(lookups == 1 ? '8.8.8.8' : '1.1.1.1')];
      },
    );
    expect(result.success, false);
    expect(transport.calls, 1);
  });

  test('DNS lookup obeys the task deadline', () async {
    final transport = FakeTransport([reply(200, 'never sent')]);
    final result = await run(
      transport,
      task: request(changes: {'timeoutMs': 10}),
      dns: (_) => Completer<List<InternetAddress>>().future,
    );
    expect(result.success, false);
    expect(transport.calls, 0);
  });

  test(
    'wrong routing session or missing TUN forwarding fails closed',
    () async {
      final transport = FakeTransport([reply(200, 'ok')]);
      final vpn = FakeVpn(transport)..session = 'other';
      try {
        expect((await run(transport, vpn: vpn)).success, false);
        expect(transport.calls, 0);
      } finally {
        await vpn.dispose();
      }
      expect((await run(transport, installedIps: [])).success, false);
      expect(transport.calls, 0);
    },
  );

  test('duplicate DataChannel message is admitted once', () {
    final protocol = SecureRoutingProtocol();
    expect(protocol.acceptOnce('same-request'), true);
    expect(protocol.acceptOnce('same-request'), false);
    expect(
      AndroidWebRtcService.markTaskForExecution('phase11b-duplicate'),
      true,
    );
    expect(
      AndroidWebRtcService.markTaskForExecution('phase11b-duplicate'),
      false,
    );
  });

  test('interrupted VPN fails closed before returning content', () async {
    final transport = FakeTransport([reply(200, 'ok')]);
    final vpn = FakeVpn(transport)..available = false;
    try {
      final result = await run(transport, vpn: vpn);
      expect(result.success, false);
      expect(result.content, null);
      expect(transport.calls, 0);
    } finally {
      await vpn.dispose();
    }
  });

  test('VPN loss after socket open discards the response', () async {
    final transport = FakeTransport([reply(200, 'must not return')]);
    final vpn = FakeVpn(transport);
    transport.onRequest = (_) {
      vpn.available = false;
      vpn.controller.add(VpnState.disconnected);
    };
    try {
      final result = await run(transport, vpn: vpn);
      expect(result.success, false);
      expect(result.content, null);
      expect(transport.calls, 1);
    } finally {
      await vpn.dispose();
    }
  });

  test(
    'task deadline during final VPN metrics cannot return response content',
    () async {
      final transport = FakeTransport([reply(200, 'must not settle')]);
      final vpn = FakeVpn(transport)
        ..beforeMetrics = (call) async {
          if (call == 2) {
            await Future<void>.delayed(const Duration(milliseconds: 200));
          }
        };
      try {
        final result = await run(
          transport,
          vpn: vpn,
          task: request(changes: {'timeoutMs': 75}),
        );
        expect(result.success, false);
        expect(result.content, null);
        expect(result.error, contains('deadline'));
      } finally {
        await vpn.dispose();
      }
    },
  );

  test(
    'task deadline cancels a stalled response body and discards partial data',
    () async {
      final body = StreamController<List<int>>();
      var closeCount = 0;
      final response = PublicFetchResponse(
        statusCode: 200,
        contentType: 'text/plain',
        contentEncoding: null,
        location: null,
        contentLength: -1,
        body: body.stream,
        close: () {
          if (!body.isClosed) {
            closeCount += 1;
            unawaited(body.close());
          }
        },
      );
      final transport = FakeTransport([response]);
      transport.onRequest = (cancellation) => cancellation.attach(() {
        if (!body.isClosed) {
          closeCount += 1;
          unawaited(body.close());
        }
      });
      final result = await run(
        transport,
        task: request(changes: {'timeoutMs': 75}),
      );
      expect(result.success, false);
      expect(result.content, null);
      expect(body.isClosed, true);
      expect(closeCount, 1);
      await body.close();
    },
  );
}
