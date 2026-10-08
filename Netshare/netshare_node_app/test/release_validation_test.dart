import 'package:flutter_test/flutter_test.dart';
import 'package:netshare_node_app/services/secure_routing_protocol.dart';
import 'package:netshare_node_app/services/task_executor_service.dart';

TaskExecutionResult result({bool success = true}) => TaskExecutionResult(
  success: success,
  statusCode: success ? 200 : 503,
  latencyMs: 12,
  bandwidthUsedMB: 0.002,
  downloadBandwidthMB: 0.002,
  uploadBandwidthMB: 0.001,
  packetLoss: null,
  successRate: success ? 100 : 0,
  resultData: success ? {} : {'error': 'fixture network failure'},
);

void main() {
  test(
    'authorized execution count is retained and malformed counts are rejected',
    () {
      final protocol = SecureRoutingProtocol();
      final payload = {
        'taskId': 'task',
        'routingSessionId': 'route',
        'targetUrl': 'https://example.com',
        'authorizedHost': 'example.com',
        'authorizedPort': 443,
        'authorizedMethod': 'GET',
        'timeoutMs': 25000,
      };
      expect(
        AuthorizedTaskRequest.fromMessage(
          protocol.build('route', 'task_request', {
            ...payload,
            'executionLimit': 3,
          }),
        ).executionLimit,
        3,
      );
      for (final invalid in [0, -1, 101, 1.5, '3']) {
        expect(
          () => AuthorizedTaskRequest.fromMessage(
            protocol.build('route', 'task_request', {
              ...payload,
              'executionLimit': invalid,
            }),
          ),
          throwsFormatException,
        );
      }
    },
  );
  test(
    'batch executes the authorized count and aggregates only observed metrics',
    () async {
      var calls = 0;
      final batch = await TaskExecutorService.executeRequestBatch(
        executionLimit: 3,
        timeoutMs: 1000,
        execute: (remaining) async {
          calls++;
          expect(remaining, lessThanOrEqualTo(1000));
          return result();
        },
      );
      expect(calls, 3);
      expect(batch.success, isTrue);
      expect(batch.downloadBandwidthMB, closeTo(0.006, 0.000001));
      expect(batch.uploadBandwidthMB, closeTo(0.003, 0.000001));
      expect(batch.packetLoss, isNull);
      expect(batch.successRate, 100);
    },
  );
  test(
    'batch stops on failure/deadline rather than replaying unfinished execution',
    () async {
      var calls = 0;
      final batch = await TaskExecutorService.executeRequestBatch(
        executionLimit: 3,
        timeoutMs: 1000,
        execute: (_) async {
          calls++;
          return result(success: false);
        },
      );
      expect(calls, 1);
      expect(batch.success, isFalse);
      expect(batch.successRate, 0);
      final timedOut = await TaskExecutorService.executeRequestBatch(
        executionLimit: 2,
        timeoutMs: 1,
        execute: (_) async {
          await Future<void>.delayed(const Duration(milliseconds: 10));
          return result();
        },
      );
      expect(timedOut.success, isFalse);
      expect(timedOut.resultData['completedExecutions'], 0);
    },
  );
  test(
    'a blocked request reports zero transferred bytes, not fabricated bandwidth',
    () async {
      final rejected = await TaskExecutorService.executeHttpPerformanceTest(
        'http://127.0.0.1/',
      );
      expect(rejected.success, isFalse);
      expect(rejected.bandwidthUsedMB, 0);
      expect(rejected.uploadBandwidthMB, 0);
      expect(rejected.downloadBandwidthMB, 0);
      expect(rejected.packetLoss, isNull);
    },
  );
}
