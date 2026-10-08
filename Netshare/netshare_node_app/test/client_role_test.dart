import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:netshare_node_app/services/client_api.dart';
import 'package:netshare_node_app/screens/client/client_dashboard_screen.dart';
import 'package:netshare_node_app/screens/client/submit_task_screen.dart';
import 'package:netshare_node_app/screens/client/my_tasks_screen.dart';
import 'package:netshare_node_app/screens/client/task_details_screen.dart';
import 'package:netshare_node_app/screens/client/client_wallet_screen.dart';
import 'package:netshare_node_app/screens/notifications_screen.dart';
import 'package:netshare_node_app/screens/role_home_screen.dart';
import 'package:netshare_node_app/services/mobile_document_service.dart';

Map<String, dynamic> task({String status = 'settled', bool rated = false}) => {
  '_id': 'task1',
  'targetUrl': 'https://example.com',
  'serviceType': 'performance_testing',
  'targetRegion': 'Pakistan',
  'status': status,
  'executionLimit': 1,
  'estimatedCost': 12,
  'assignedNodeId': {'deviceName': 'Test node'},
  'resultSummary': {'message': 'Verified'},
  'clientRating': rated ? {'rating': 4, 'ratedAt': '2026-10-07'} : {},
};
Map<String, dynamic> fixture(String path) {
  if (path == '/tasks/client/dashboard') {
    return {'activeTasks': 2, 'completedTasks': 3, 'availableCredits': 456};
  }
  if (path == '/tasks/my-tasks') {
    return {
      'tasks': [task()],
    };
  }
  if (path == '/tasks/task1') {
    return {
      'task': task(),
      'result': {
        'successRate': 100,
        'latencyMs': 43,
        'bandwidthUsedMB': 2,
        'statusCode': 200,
      },
    };
  }
  if (path == '/node/availability') {
    return {
      'regions': [
        {
          'region': 'Pakistan',
          'available': true,
          'eligibleNodes': 2,
          'availableSlots': 3,
        },
      ],
    };
  }
  if (path == '/tasks/estimate') {
    return {
      'availability': {
        'available': true,
        'eligibleNodes': 2,
        'availableSlots': 3,
      },
      'quote': {
        'totalCredits': 12,
        'version': 'rule-v1',
        'factors': {'demandMultiplier': 1.0},
      },
    };
  }
  if (path == '/tasks') {
    return {'task': task(status: 'pending')};
  }
  if (path == '/wallet') {
    return {
      'wallet': {'balance': 456},
    };
  }
  if (path == '/wallet/transactions') {
    return {
      'transactions': [
        {
          'type': 'debit',
          'amount': 12,
          'description': 'Task payment',
          'status': 'completed',
          'createdAt': '2026-10-07',
        },
      ],
    };
  }
  if (path == '/wallet/top-ups') {
    return {
      'requests': [
        {
          '_id': 'topup1',
          'amount': 50,
          'status': 'pending',
          'referenceNumber': 'REF12345',
        },
      ],
    };
  }
  if (path == '/notifications') {
    return {
      'notifications': [
        {
          '_id': 'n1',
          'message': 'Task completed',
          'status': 'unread',
          'createdAt': '2026-10-07',
        },
      ],
      'unreadCount': 1,
      'total': 1,
    };
  }
  return {};
}

ClientApi makeApi({
  String role = 'platform_client',
  Future<http.Response> Function(http.Request)? handler,
}) => ClientApi(
  role: role,
  baseUrl: 'http://test',
  tokenProvider: () async => 'test-token',
  client: MockClient(
    handler ??
        (request) async =>
            http.Response(jsonEncode(fixture(request.url.path)), 200),
  ),
);
Future<void> mount(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  await tester.pumpWidget(MaterialApp(home: screen));
  await tester.pumpAndSettle();
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox.shrink());
  });
}

Future<void> tap(WidgetTester tester, String text) async {
  final finder = find.text(text).last;
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets('malformed price response cannot enable submission', (tester) async {
    final api = makeApi(handler: (request) async => http.Response(jsonEncode(
      request.url.path == '/tasks/estimate' ? {'quote': {'totalCredits': 'free'}} : fixture(request.url.path)), 200));
    await mount(tester, SubmitTaskScreen(api: api));
    await tester.enterText(find.byType(TextFormField).first, 'https://example.com');
    await tap(tester, 'Get price estimate');
    expect(find.text('Invalid price estimate.'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Submit task')).onPressed, isNull);
  });
  testWidgets('expired restored session stays out of all workspaces', (tester) async {
    await mount(tester, RoleHomeScreen(userLoader: () async => throw const ClientApiException(401, 'Session expired. Sign in again.')));
    expect(find.text('Session expired. Sign in again.'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);
    expect(find.text('Available credits'), findsNothing);
    expect(find.byType(SegmentedButton<String>), findsNothing);
  });
  testWidgets('dual-role and submission controls fit a phone viewport', (tester) async {
    await mount(tester, RoleHomeScreen(userLoader: () async => {'user': {'_id': 'phone-user', 'role': 'both'}},
      apiFactory: (role) => makeApi(role: role), nodeBuilder: () => const Text('Node workspace')));
    tester.view.physicalSize = const Size(390, 844); await tester.pumpAndSettle();
    await tap(tester, 'Platform Client'); expect(tester.takeException(), isNull);
    await tap(tester, 'Submit task'); expect(find.text('Target URL'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  tearDown(
    () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(MobileDocumentService.channel, null),
  );

  test(
    'HTTP API sends backend feature names, authorization and no client pricing',
    () async {
      final requests = <http.Request>[];
      final api = makeApi(
        handler: (request) async {
          requests.add(request);
          return http.Response(jsonEncode(fixture(request.url.path)), 200);
        },
      );
      await api.regions();
      await api.estimate('Pakistan', 7);
      await api.submitTask({
        'targetUrl': 'https://example.com',
        'targetRegion': 'Pakistan',
        'serviceType': 'performance_testing',
        'executionLimit': 7,
      });
      expect(requests.first.url.path, '/node/availability');
      expect(requests[1].headers['Authorization'], 'Bearer test-token');
      expect(jsonDecode(requests[1].body), {
        'targetRegion': 'Pakistan',
        'executionLimit': 7,
      });
      expect(
        jsonDecode(requests[2].body).containsKey('estimatedCost'),
        isFalse,
      );
      api.close();
    },
  );
  test('node and admin roles cannot invoke client endpoints', () async {
    for (final role in ['node_participant', 'admin', 'unknown']) {
      int calls = 0;
      final api = makeApi(
        role: role,
        handler: (_) async {
          calls++;
          return http.Response('{}', 200);
        },
      );
      for (final future in [
        api.dashboard(),
        api.tasks(),
        api.task('x'),
        api.regions(),
        api.estimate('Pakistan', 1),
        api.submitTask({}),
        api.rate('x', 5, ''),
        api.report('x'),
      ]) {
        await expectLater(
          future,
          throwsA(
            isA<ClientApiException>().having(
              (error) => error.status,
              'status',
              403,
            ),
          ),
        );
      }
      expect(calls, 0);
      api.close();
    }
  });
  test('missing token and backend authorization errors are clear', () async {
    final absent = ClientApi(
      role: 'platform_client',
      tokenProvider: () async => null,
    );
    await expectLater(
      absent.dashboard(),
      throwsA(
        isA<ClientApiException>().having(
          (error) => error.status,
          'status',
          401,
        ),
      ),
    );
    absent.close();
    final api = makeApi(
      handler: (_) async =>
          http.Response('{"error":{"message":"Access denied"}}', 403),
    );
    await expectLater(
      api.dashboard(),
      throwsA(
        isA<ClientApiException>().having(
          (error) => error.message,
          'message',
          'Access denied',
        ),
      ),
    );
    api.close();
  });
  test('malformed API payload is rejected', () async {
    final api = makeApi(handler: (_) async => http.Response('not-json', 200));
    await expectLater(
      api.regions(),
      throwsA(
        isA<ClientApiException>().having(
          (error) => error.status,
          'status',
          502,
        ),
      ),
    );
    api.close();
  });
  test('URL and execution count validation', () {
    for (final value in [
      'ftp://example.com',
      'example.com',
      'https://user:pass@example.com',
      '',
    ]) {
      expect(SubmitTaskScreen.validateUrl(value), isNotNull);
    }
    expect(SubmitTaskScreen.validateUrl('https://example.com/page'), isNull);
    for (final value in ['0', '101', '1.5', 'x']) {
      expect(SubmitTaskScreen.validateCount(value), isNotNull);
    }
    expect(SubmitTaskScreen.validateCount('1'), isNull);
    expect(SubmitTaskScreen.validateCount('100'), isNull);
  });
  testWidgets('client dashboard displays backend totals and recent tasks', (
    tester,
  ) async {
    await mount(tester, ClientDashboardScreen(api: makeApi()));
    expect(find.text('Platform Client'), findsOneWidget);
    expect(find.text('456'), findsOneWidget);
    expect(find.text('Active tasks'), findsOneWidget);
    expect(find.text('Completed tasks'), findsOneWidget);
    expect(find.text('Recent task activity'), findsOneWidget);
  });
  testWidgets('client dashboard shows error and retries', (tester) async {
    bool fail = true;
    final api = makeApi(
      handler: (request) async =>
          fail && request.url.path == '/tasks/client/dashboard'
          ? http.Response('{"message":"Dashboard unavailable"}', 503)
          : http.Response(jsonEncode(fixture(request.url.path)), 200),
    );
    await mount(tester, ClientDashboardScreen(api: api));
    expect(find.text('Dashboard unavailable'), findsOneWidget);
    fail = false;
    await tap(tester, 'Retry');
    expect(find.text('Available credits'), findsOneWidget);
  });
  testWidgets(
    'task form validates input, shows server price and invalidates stale quote',
    (tester) async {
      await mount(tester, SubmitTaskScreen(api: makeApi()));
      await tap(tester, 'Get price estimate');
      expect(
        find.text('Enter a valid HTTP/HTTPS URL without credentials.'),
        findsOneWidget,
      );
      await tester.enterText(
        find.byType(TextFormField).first,
        'https://example.com',
      );
      await tap(tester, 'Get price estimate');
      expect(find.text('12 credits (rule-v1)'), findsOneWidget);
      expect(find.text('2 / 3'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField).last, '2');
      await tester.pump();
      expect(find.text('12 credits (rule-v1)'), findsNothing);
      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Submit task'),
      );
      expect(button.onPressed, isNull);
    },
  );
  testWidgets(
    'region and price API failures remain visible and prevent submission',
    (tester) async {
      final api = makeApi(
        handler: (_) async =>
            http.Response('{"message":"Region service offline"}', 503),
      );
      await mount(tester, SubmitTaskScreen(api: api));
      expect(find.text('Region service offline'), findsOneWidget);
      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Submit task'),
      );
      expect(button.onPressed, isNull);
    },
  );
  testWidgets('empty task list has an explicit empty state', (tester) async {
    await mount(
      tester,
      MyTasksScreen(
        api: makeApi(handler: (_) async => http.Response('{"tasks":[]}', 200)),
      ),
    );
    expect(find.text('No tasks yet.'), findsOneWidget);
  });
  testWidgets(
    'task list opens details showing results and report/rating actions',
    (tester) async {
      await mount(tester, MyTasksScreen(api: makeApi()));
      await tap(tester, 'https://example.com');
      expect(find.text('Task details'), findsOneWidget);
      expect(find.text('settled'), findsOneWidget);
      expect(find.text('Open / save CSV report'), findsOneWidget);
      expect(find.text('Rate node once'), findsOneWidget);
    },
  );
  testWidgets('unfinished task has no report or rating controls', (
    tester,
  ) async {
    final api = makeApi(
      handler: (_) async => http.Response(
        jsonEncode({'task': task(status: 'running'), 'result': null}),
        200,
      ),
    );
    await mount(tester, TaskDetailsScreen(api: api, taskId: 'task1'));
    expect(find.text('Open / save CSV report'), findsNothing);
    expect(find.text('Rate node once'), findsNothing);
    expect(find.text('No recorded result yet.'), findsOneWidget);
  });
  testWidgets(
    'completed rating uses backend once and existing rating hides form',
    (tester) async {
      bool rated = false;
      int calls = 0;
      final api = makeApi(
        handler: (request) async {
          if (request.url.path.endsWith('/rating')) {
            rated = true;
            calls++;
            expect(jsonDecode(request.body)['rating'], 5);
            return http.Response('{}', 201);
          }
          return http.Response(
            jsonEncode({'task': task(rated: rated), 'result': {}}),
            200,
          );
        },
      );
      await mount(tester, TaskDetailsScreen(api: api, taskId: 'task1'));
      await tap(tester, 'Rate node once');
      expect(calls, 1);
      expect(find.text('Rate node once'), findsNothing);
      expect(find.text('Your node rating'), findsOneWidget);
    },
  );
  testWidgets('wallet displays balance/history and pending top-up status', (
    tester,
  ) async {
    await mount(tester, ClientWalletScreen(api: makeApi()));
    expect(find.text('456 credits'), findsOneWidget);
    expect(find.text('50 credits — pending'), findsOneWidget);
    expect(find.text('debit 12 credits'), findsOneWidget);
  });
  testWidgets(
    'top-up requires proof and sends the actual selected proof to backend',
    (tester) async {
      Map<String, dynamic>? input;
      final api = makeApi(
        handler: (request) async {
          input = jsonDecode(request.body);
          return http.Response('{"request":{"status":"pending"}}', 201);
        },
      );
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            MobileDocumentService.channel,
            (_) async => {'mime': 'image/png', 'base64': 'proof', 'size': 5},
          );
      await mount(tester, TopupScreen(api: api));
      await tester.enterText(find.byType(TextFormField).first, '50');
      await tester.enterText(find.byType(TextFormField).last, 'REF12345');
      await tap(tester, 'Submit for verification');
      expect(
        find.text('Select a payment proof before submitting.'),
        findsOneWidget,
      );
      expect(input, isNull);
      await tap(tester, 'Choose PNG / JPEG / PDF proof (max 2 MB)');
      await tap(tester, 'Submit for verification');
      expect(input, {
        'amount': 50,
        'paymentMethod': 'bank_transfer',
        'referenceNumber': 'REF12345',
        'proofMime': 'image/png',
        'proofBase64': 'proof',
      });
    },
  );
  test('native document bridge supports cancellation and CSV save', () async {
    final calls = <MethodCall>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(MobileDocumentService.channel, (call) async {
          calls.add(call);
          return call.method == 'pickProof' ? null : true;
        });
    expect(await MobileDocumentService.pickProof(), isNull);
    expect(await MobileDocumentService.saveReport('task1', 'a,b'), isTrue);
    expect(calls.last.arguments, {
      'filename': 'netshare-task-task1.csv',
      'content': 'a,b',
    });
  });
  testWidgets(
    'notifications display unread state and call owned read endpoint',
    (tester) async {
      bool read = false;
      final api = makeApi(
        handler: (request) async {
          if (request.method == 'PUT') {
            expect(request.url.path, '/notifications/n1/read');
            read = true;
            return http.Response('{}', 200);
          }
          return http.Response(
            jsonEncode({
              'notifications': [
                {
                  '_id': 'n1',
                  'message': 'Task completed',
                  'status': read ? 'read' : 'unread',
                },
              ],
              'unreadCount': read ? 0 : 1,
              'total': 1,
            }),
            200,
          );
        },
      );
      await mount(tester, NotificationsScreen(api: api));
      expect(find.text('1 unread'), findsOneWidget);
      await tap(tester, 'Mark read');
      expect(find.text('0 unread'), findsOneWidget);
    },
  );
  testWidgets(
    'dual-role switches cleanly and persists only that account mode',
    (tester) async {
      await mount(
        tester,
        RoleHomeScreen(
          userLoader: () async => {
            'user': {'_id': 'both-user', 'role': 'both'},
          },
          apiFactory: (role) => makeApi(role: role),
          nodeBuilder: () => const Text('Existing node workspace'),
        ),
      );
      expect(find.text('Existing node workspace'), findsOneWidget);
      await tap(tester, 'Platform Client');
      expect(find.text('Existing node workspace'), findsNothing);
      expect(find.text('Available credits'), findsOneWidget);
      expect(
        (await SharedPreferences.getInstance()).getString(
          'mobileMode:both-user',
        ),
        'client',
      );
      await tap(tester, 'Node Participant');
      expect(find.text('Existing node workspace'), findsOneWidget);
    },
  );
  testWidgets('client-only restores to client and cannot enter node mode', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'mobileMode:client-user': 'node'});
    await mount(
      tester,
      RoleHomeScreen(
        userLoader: () async => {
          'user': {'_id': 'client-user', 'role': 'platform_client'},
        },
        apiFactory: (role) => makeApi(role: role),
      ),
    );
    expect(find.byType(SegmentedButton<String>), findsNothing);
    expect(find.text('Available credits'), findsOneWidget);
  });
  testWidgets('node-only cannot restore a cached client workspace', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'mobileMode:node-user': 'client'});
    await mount(
      tester,
      RoleHomeScreen(
        userLoader: () async => {
          'user': {'_id': 'node-user', 'role': 'node_participant'},
        },
        apiFactory: (role) => makeApi(role: role),
        nodeBuilder: () => const Text('Existing node workspace'),
      ),
    );
    expect(find.text('Existing node workspace'), findsOneWidget);
    expect(find.text('Available credits'), findsNothing);
  });
  testWidgets(
    'unsupported mobile role and invalid session cannot access workspaces',
    (tester) async {
      await mount(
        tester,
        RoleHomeScreen(
          userLoader: () async => {
            'user': {'_id': 'admin', 'role': 'admin'},
          },
        ),
      );
      expect(
        find.text('This account has no supported mobile role.'),
        findsOneWidget,
      );
      expect(find.text('Available credits'), findsNothing);
    },
  );
}
