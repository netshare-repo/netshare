import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:netshare_node_app/services/client_api.dart';
import 'package:netshare_node_app/screens/withdrawals_screen.dart';
import 'package:netshare_node_app/widgets/live_node_metrics.dart';

ClientApi api(
  Future<http.Response> Function(http.Request) handler, {
  String role = 'node_participant',
}) => ClientApi(
  role: role,
  client: MockClient(handler),
  tokenProvider: () async => 'fixture-token',
  baseUrl: 'https://fixture.test',
);
http.Response json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status);
void main() {
  testWidgets('withdrawal wallet displays eligible balance and owned history', (
    tester,
  ) async {
    final client = api(
      (r) async => r.url.path == '/wallet'
          ? json({'eligibleWithdrawalBalance': 90})
          : json({
              'requests': [
                {
                  '_id': 'r1',
                  'amount': 12,
                  'status': 'pending',
                  'method': 'jazzcash',
                },
              ],
            }),
    );
    addTearDown(client.close);
    await tester.pumpWidget(MaterialApp(home: WithdrawalsScreen(api: client)));
    await tester.pumpAndSettle();
    expect(find.text('90'), findsOneWidget);
    expect(find.text('12 credits — pending'), findsOneWidget);
  });
  testWidgets(
    'withdrawal validates amount, eligibility and account details before API writes',
    (tester) async {
      var posts = 0;
      final client = api((r) async {
        if (r.method == 'POST') posts++;
        return json(
          r.url.path == '/wallet'
              ? {'eligibleWithdrawalBalance': 90}
              : {'requests': []},
        );
      });
      addTearDown(client.close);
      await tester.pumpWidget(
        MaterialApp(home: WithdrawalsScreen(api: client)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Submit withdrawal'));
      await tester.pumpAndSettle();
      expect(
        find.text('Enter a whole amount from 1 to 1000000.'),
        findsOneWidget,
      );
      await tester.enterText(find.byType(TextFormField).first, '91');
      await tester.tap(find.text('Submit withdrawal'));
      await tester.pumpAndSettle();
      expect(find.text('Insufficient eligible earnings.'), findsOneWidget);
      expect(posts, 0);
    },
  );
  testWidgets('ambiguous withdrawal failures retain the same idempotency key', (
    tester,
  ) async {
    final keys = <String>[];
    final client = api((r) async {
      if (r.method == 'POST') {
        keys.add(jsonDecode(r.body)['requestId']);
        return json({'message': 'Retry later'}, 503);
      }
      return json(
        r.url.path == '/wallet'
            ? {'eligibleWithdrawalBalance': 90}
            : {'requests': []},
      );
    });
    addTearDown(client.close);
    await tester.pumpWidget(MaterialApp(home: WithdrawalsScreen(api: client)));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, '25');
    await tester.enterText(
      find.byType(TextFormField).last,
      'Account 123456789',
    );
    for (var i = 0; i < 2; i++) {
      await tester.tap(find.text('Submit withdrawal'));
      await tester.pumpAndSettle();
    }
    expect(keys.length, 2);
    expect(keys[0], keys[1]);
    expect(find.text('Retry later'), findsOneWidget);
  });
  test('client-only roles cannot submit withdrawals', () {
    final client = api(
      (_) async => throw StateError('Must not call API'),
      role: 'platform_client',
    );
    addTearDown(client.close);
    expect(
      () => client.submitWithdrawal({}),
      throwsA(isA<ClientApiException>()),
    );
  });
  testWidgets(
    'live metrics show actual throughput/session and label packet loss unmeasured',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: LiveNodeMetrics(
              tunLoader: () async => {
                'state': 'connected',
                'uploadSpeedMbps': 1.25,
                'downloadSpeedMbps': 2.5,
                'routingSessionId': 'route1',
              },
              sessionLoader: () async => {
                'status': 'active',
                'sessionId': 'session1',
                'node': {'region': 'Pakistan'},
                'latency': 42,
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('1.250 Mbps'), findsOneWidget);
      expect(find.textContaining('session1'), findsOneWidget);
      expect(find.text('Packet loss: Not measured'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'unavailable live measurements do not display invented zero values',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: LiveNodeMetrics(
              tunLoader: () async => throw Exception('Unavailable'),
              sessionLoader: () async => {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Live metrics unavailable — retrying.'), findsOneWidget);
      expect(find.textContaining('Upload: Not measured'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
