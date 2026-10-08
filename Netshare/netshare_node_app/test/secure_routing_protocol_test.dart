import 'package:flutter_test/flutter_test.dart';
import 'package:netshare_node_app/services/secure_routing_protocol.dart';

void main() {
  const sessionId = 'routing-session-1';

  test('WebRTC protocol envelope round-trips with strict session binding', () {
    final protocol = SecureRoutingProtocol();
    final outbound = protocol.build(sessionId, 'ping', {'value': 1});
    final parsed = SecureRoutingMessage.parse(
      outbound.encode(),
      expectedSessionId: sessionId,
    );

    expect(parsed, isNotNull);
    expect(parsed!.type, 'ping');
    expect(parsed.payload['value'], 1);
    expect(
      SecureRoutingMessage.parse(
        outbound.encode(),
        expectedSessionId: 'different-session',
      ),
      isNull,
    );
  });

  test('authorized task requires bound session, host, port and GET/HEAD', () {
    final protocol = SecureRoutingProtocol();
    final valid = protocol.build(sessionId, 'task_request', {
      'taskId': 'task-1',
      'routingSessionId': sessionId,
      'targetUrl': 'https://example.com/status',
      'authorizedHost': 'example.com',
      'authorizedPort': 443,
      'authorizedMethod': 'HEAD',
      'timeoutMs': 5000,
    });

    final task = AuthorizedTaskRequest.fromMessage(valid);
    expect(task.taskId, 'task-1');
    expect(task.authorizedMethod, 'HEAD');

    final invalidMethod = protocol.build(sessionId, 'task_request', {
      ...valid.payload,
      'authorizedMethod': 'POST',
    });
    expect(
      () => AuthorizedTaskRequest.fromMessage(invalidMethod),
      throwsFormatException,
    );

    final wrongBinding = protocol.build(sessionId, 'task_request', {
      ...valid.payload,
      'routingSessionId': 'other-session',
    });
    expect(
      () => AuthorizedTaskRequest.fromMessage(wrongBinding),
      throwsFormatException,
    );
  });

  test('duplicate DataChannel message is accepted exactly once', () {
    final protocol = SecureRoutingProtocol();
    expect(protocol.acceptOnce('message-1'), isTrue);
    expect(protocol.acceptOnce('message-1'), isFalse);
    expect(protocol.acceptOnce('message-2'), isTrue);
  });

  test('routing lifecycle permits only secure ordered transitions', () {
    final lifecycle = SecureRouteLifecycle();
    lifecycle.transition(SecureRouteState.open);
    lifecycle.transition(SecureRouteState.executing);
    lifecycle.transition(SecureRouteState.resultSent);
    lifecycle.transition(SecureRouteState.closed);
    expect(lifecycle.state, SecureRouteState.closed);
    expect(() => lifecycle.transition(SecureRouteState.open), throwsStateError);
  });

  test('routing lifecycle supports failure cleanup', () {
    final lifecycle = SecureRouteLifecycle();
    lifecycle.transition(SecureRouteState.open);
    lifecycle.transition(SecureRouteState.failed);
    lifecycle.transition(SecureRouteState.closed);
    expect(lifecycle.state, SecureRouteState.closed);
  });
}
