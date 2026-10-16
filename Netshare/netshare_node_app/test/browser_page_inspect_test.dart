import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:netshare_node_app/services/browser_page_inspect_executor.dart';
import 'package:netshare_node_app/services/secure_routing_protocol.dart';

const _sessionId = 'route-12b';
const _taskId = 'task-12b';
const _target = 'https://example.com/inspection';
final _publicIp = InternetAddress('8.8.8.8');

AuthorizedTaskRequest browserTask({
  Map<String, dynamic> changes = const {},
  Map<String, dynamic>? contract,
}) {
  final inspect = contract ??
      {
        'contractVersion': 1,
        'serviceType': 'BROWSER_PAGE_INSPECT',
        'taskId': _taskId,
        'routingSessionId': _sessionId,
        'targetUrl': _target,
        'targetRegion': 'USA',
        'method': 'GET',
        'viewport': {'width': 1365, 'height': 768, 'deviceScaleFactor': 1},
        'pageLoadTimeoutMs': 15000,
        'maxTextBytes': 32768,
        'captureScreenshot': true,
        'maxScreenshotBytes': 2097152,
        'maxResources': 64,
        'maxTotalBytes': 8388608,
        'resourcePolicy': 'intercept-all-public-https-or-fail-closed',
        'scriptPolicy': 'disabled-no-client-script',
        'credentials': 'omit',
        'redirectPolicy': 'same-origin-https-only',
      };
  final payload = <String, dynamic>{
    'taskId': _taskId,
    'routingSessionId': _sessionId,
    'targetUrl': _target,
    'authorizedHost': 'example.com',
    'authorizedPort': 443,
    'authorizedMethod': 'GET',
    'serviceType': 'BROWSER_PAGE_INSPECT',
    'targetRegion': 'USA',
    'executionLimit': 1,
    'timeoutMs': 25000,
    'issuedAt': DateTime.now().toUtc().toIso8601String(),
    'browserPageInspect': inspect,
    ...changes,
  };
  return AuthorizedTaskRequest.fromMessage(
    SecureRoutingProtocol().build(_sessionId, 'task_request', payload),
  );
}

void main() {
  test('accepts only the exact BROWSER_PAGE_INSPECT v1 envelope', () {
    final task = browserTask();
    expect(task.serviceType, BrowserPageInspectAuthorization.serviceType);
    expect(task.browserPageInspect!.viewport.width, 1365);
    expect(task.browserPageInspect!.captureScreenshot, isTrue);

    expect(
      () => browserTask(changes: {'headers': {'Authorization': 'secret'}}),
      throwsFormatException,
    );
    expect(
      () => browserTask(
        contract: {
          'contractVersion': 1,
          'serviceType': 'BROWSER_PAGE_INSPECT',
          'taskId': _taskId,
          'routingSessionId': _sessionId,
          'targetUrl': _target,
          'targetRegion': 'USA',
          'method': 'GET',
          'viewport': {'width': 1365, 'height': 768, 'deviceScaleFactor': 1},
          'pageLoadTimeoutMs': 15000,
          'maxTextBytes': 32768,
          'captureScreenshot': true,
          'maxScreenshotBytes': 2097152,
          'maxResources': 64,
          'maxTotalBytes': 8388608,
          'resourcePolicy': 'intercept-all-public-https-or-fail-closed',
          'scriptPolicy': 'disabled-no-client-script',
          'credentials': 'omit',
          'redirectPolicy': 'same-origin-https-only',
          'clientScript': 'fetch("https://example.com")',
        },
      ),
      throwsFormatException,
    );
    expect(
      () => browserTask(changes: {'routingSessionId': 'forged'}),
      throwsFormatException,
    );
  });

  test('resource broker blocks every Chromium request class before DNS when egress is unavailable', () async {
    var lookups = 0;
    final broker = BrowserResourceBroker(
      dnsLookup: (_) async {
        lookups += 1;
        return [_publicIp];
      },
    );
    for (final kind in BrowserResourceKind.values) {
      await expectLater(
        broker.authorize(
          uri: Uri.parse(_target),
          authorization: browserTask().browserPageInspect!,
          kind: kind,
          installedIps: [_publicIp.address],
        ),
        throwsA(isA<BrowserPageInspectFailure>()),
        reason: 'No $kind request may trigger DNS while task egress is unavailable',
      );
    }
    expect(lookups, 0);
  });

  test('resource broker checks navigation, redirects, subresources, and service workers', () async {
    final broker = BrowserResourceBroker(
      taskScopedEgressEnforced: true,
      dnsLookup: (_) async => [_publicIp],
    );
    final authorization = browserTask().browserPageInspect!;
    for (final kind in BrowserResourceKind.values) {
      final allowed = await broker.authorize(
        uri: Uri.parse('https://example.com/assets/app.js'),
        authorization: authorization,
        kind: kind,
        installedIps: [_publicIp.address],
      );
      expect(allowed.kind, kind);
      expect(allowed.pinnedIps.single.address, _publicIp.address);
    }
    for (final kind in [
      BrowserResourceKind.redirect,
      BrowserResourceKind.subresource,
      BrowserResourceKind.serviceWorker,
    ]) {
      await expectLater(
        broker.authorize(
          uri: Uri.parse('https://tracker.example.net/pixel'),
          authorization: authorization,
          kind: kind,
          installedIps: [_publicIp.address],
        ),
        throwsA(isA<BrowserPageInspectFailure>()),
      );
    }
  });

  test('resource broker rejects private DNS and a DNS route mismatch', () async {
    final authorization = browserTask().browserPageInspect!;
    final privateBroker = BrowserResourceBroker(
      taskScopedEgressEnforced: true,
      dnsLookup: (_) async => [InternetAddress('10.0.0.1')],
    );
    await expectLater(
      privateBroker.authorize(
        uri: Uri.parse(_target),
        authorization: authorization,
        kind: BrowserResourceKind.navigation,
        installedIps: ['10.0.0.1'],
      ),
      throwsA(isA<BrowserPageInspectFailure>()),
    );

    final rebindingBroker = BrowserResourceBroker(
      taskScopedEgressEnforced: true,
      dnsLookup: (_) async => [_publicIp],
    );
    await expectLater(
      rebindingBroker.authorize(
        uri: Uri.parse(_target),
        authorization: authorization,
        kind: BrowserResourceKind.redirect,
        installedIps: ['1.1.1.1'],
      ),
      throwsA(isA<BrowserPageInspectFailure>()),
    );
  });

  test('resource broker rejects a stalled DNS lookup', () async {
    final stalled = Completer<List<InternetAddress>>();
    final broker = BrowserResourceBroker(
      taskScopedEgressEnforced: true,
      dnsLookup: (_) => stalled.future,
    );
    await expectLater(
      broker.authorize(
        uri: Uri.parse(_target),
        authorization: browserTask().browserPageInspect!,
        kind: BrowserResourceKind.navigation,
        installedIps: [_publicIp.address],
        timeout: const Duration(milliseconds: 1),
      ),
      throwsA(isA<BrowserPageInspectFailure>()),
    );
  });

  test('executor fails closed before any browser DNS or network activity', () async {
    var lookups = 0;
    final executor = BrowserPageInspectExecutor(
      broker: BrowserResourceBroker(
        dnsLookup: (_) async {
          lookups += 1;
          return [_publicIp];
        },
      ),
    );
    final result = await executor.execute(
      browserTask(),
      nodeId: 'node-12b',
      cancellation: BrowserPageInspectCancellation(),
    );
    expect(browserPageInspectNetworkedRenderingAvailable, isFalse);
    expect(result.success, isFalse);
    expect(result.error, contains('blocked'));
    expect(lookups, 0);

    final payload = result.toPayload(
      taskId: _taskId,
      sessionId: _sessionId,
      nodeId: 'node-12b',
      targetRegion: 'USA',
    );
    expect(payload['contractVersion'], 1);
    expect(payload['serviceType'], 'BROWSER_PAGE_INSPECT');
    expect(payload['success'], isFalse);
    final data = payload['resultData'] as Map<String, dynamic>;
    expect(data['finalUrl'], _target);
    expect(data['textContent'], isNull);
    expect(data['screenshotArtifact'], isNull);
    expect(data['resourceCount'], 0);
  });

  test('executor preserves cancellation and refuses a missing node identity', () async {
    final cancellation = BrowserPageInspectCancellation()..cancel();
    final interrupted = await BrowserPageInspectExecutor().execute(
      browserTask(),
      nodeId: 'node-12b',
      cancellation: cancellation,
    );
    expect(interrupted.success, isFalse);
    expect(interrupted.error, contains('interrupted'));

    final noNode = await BrowserPageInspectExecutor().execute(
      browserTask(),
      nodeId: '',
      cancellation: BrowserPageInspectCancellation(),
    );
    expect(noNode.success, isFalse);
    expect(noNode.error, contains('binding'));
  });

  test('screenshot preparation has no DataChannel image path', () {
    final plan = const BrowserScreenshotCapturePreparation().prepare(
      browserTask().browserPageInspect!,
    );
    expect(plan.captureRequested, isTrue);
    expect(plan.dataChannelTransferAllowed, isFalse);
    expect(plan.artifactReference, isNull);
  });
}
