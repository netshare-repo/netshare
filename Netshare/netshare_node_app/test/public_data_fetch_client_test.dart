import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:netshare_node_app/services/client_api.dart';
import 'package:netshare_node_app/services/mobile_document_service.dart';
import 'package:netshare_node_app/screens/client/submit_task_screen.dart';
import 'package:netshare_node_app/screens/client/my_tasks_screen.dart';
import 'package:netshare_node_app/widgets/public_data_fetch_result_view.dart';
import 'package:netshare_node_app/widgets/browser_page_inspect_result_view.dart';

ClientApi api({required bool enabled}) => ClientApi(
  role: 'platform_client',
  baseUrl: 'http://test',
  tokenProvider: () async => 'test-token',
  client: MockClient((request) async {
    switch (request.url.path) {
      case '/node/availability':
        return http.Response(
          jsonEncode({
            'regions': [
              {'region': 'Pakistan', 'available': true},
            ],
          }),
          200,
        );
      case '/tasks/capabilities':
        return http.Response(
          jsonEncode({
            'publicDataFetchEnabled': enabled,
            'browserPageInspectEnabled': false,
          }),
          200,
        );
      default:
        return http.Response('{}', 200);
    }
  }),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'public data fetch capability is strict and disabled by default',
    () async {
      expect(
        (await api(enabled: false).capabilities())['publicDataFetchEnabled'],
        false,
      );
      expect(
        (await api(enabled: true).capabilities())['publicDataFetchEnabled'],
        true,
      );
    },
  );

  testWidgets('submission clearly marks the disabled service unavailable', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: SubmitTaskScreen(api: api(enabled: false))),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byType(DropdownButtonFormField<String>).first);
    await tester.pumpAndSettle();
    expect(
      find.text('Public Data Fetch (currently unavailable)'),
      findsOneWidget,
    );
    expect(
      tester
          .widget<DropdownMenuItem<String>>(
            find
                .ancestor(
                  of: find.text('Public Data Fetch (currently unavailable)'),
                  matching: find.byType(DropdownMenuItem<String>),
                )
                .first,
          )
          .enabled,
      false,
    );
  });

  testWidgets(
    'submission enables Public Data Fetch only when backend capability is true',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(home: SubmitTaskScreen(api: api(enabled: true))),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byType(DropdownButtonFormField<String>).first);
      await tester.pumpAndSettle();
      final option = find
          .ancestor(
            of: find.text('PUBLIC_DATA_FETCH'),
            matching: find.byType(DropdownMenuItem<String>),
          )
          .first;
      expect(tester.widget<DropdownMenuItem<String>>(option).enabled, true);
    },
  );

  testWidgets(
    'browser inspection stays Coming Soon and cannot be selected while capability is off',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(home: SubmitTaskScreen(api: api(enabled: false))),
      );
      await tester.pumpAndSettle();
      expect(find.text('Browser Page Inspect · Coming Soon'), findsOneWidget);
      expect(
        find.text(
          'Secure browser rendering is not enabled by the backend. These settings cannot be submitted yet.',
        ),
        findsOneWidget,
      );
      await tester.tap(find.byType(DropdownButtonFormField<String>).first);
      await tester.pumpAndSettle();
      expect(find.text('Browser Page Inspect (Coming Soon)'), findsOneWidget);
      final option = find
          .ancestor(
            of: find.text('Browser Page Inspect (Coming Soon)'),
            matching: find.byType(DropdownMenuItem<String>),
          )
          .first;
      expect(tester.widget<DropdownMenuItem<String>>(option).enabled, false);
    },
  );

  test(
    'browser result validation keeps extracted HTML-like text inert and rejects unsafe results',
    () {
      const text = '<script>document.location="https://bad.test"</script>';
      final valid = prepareBrowserPageInspectView({
        'contractVersion': 1,
        'finalUrl': 'https://example.com/',
        'httpStatus': 200,
        'pageTitle': 'Example',
        'viewport': {'width': 1365, 'height': 768, 'deviceScaleFactor': 1},
        'textContent': text,
        'textSizeBytes': utf8.encode(text).length,
        'resourceCount': 2,
        'blockedResourceCount': 1,
        'transferredBytes': 512,
        'ttfbMs': 20,
        'pageLoadTimeMs': 500,
        'totalTimeMs': 600,
      }, true);
      expect(valid.state, 'ready');
      expect(valid.data['textContent'], text);
      expect(
        prepareBrowserPageInspectView({
          ...valid.data,
          'finalUrl': 'javascript:alert(1)',
        }, true).state,
        'invalid',
      );
      expect(
        prepareBrowserPageInspectView({
          ...valid.data,
          'textSizeBytes': 1,
        }, true).state,
        'invalid',
      );
      expect(prepareBrowserPageInspectView(null, false).state, 'failed');
    },
  );

  test(
    'screenshot retrieval uses the authenticated owner task route and rejects non-client roles',
    () async {
      http.Request? captured;
      final artifactId = 'a' * 32;
      final client = ClientApi(
        role: 'platform_client',
        baseUrl: 'http://test',
        tokenProvider: () async => 'owner-token',
        client: MockClient((request) async {
          captured = request;
          return http.Response.bytes(
            [137, 80, 78, 71, 13, 10, 26, 10],
            200,
            headers: {'content-type': 'image/png'},
          );
        }),
      );
      final response = await client.browserScreenshot(
        '0123456789abcdef01234567',
        artifactId,
      );
      expect(response.statusCode, 200);
      expect(captured!.headers['authorization'], 'Bearer owner-token');
      expect(
        captured!.url.path,
        '/tasks/0123456789abcdef01234567/browser-artifacts/$artifactId',
      );
      final nodeApi = ClientApi(
        role: 'node_participant',
        baseUrl: 'http://test',
        tokenProvider: () async => 'node-token',
        client: MockClient((_) async => http.Response('{}', 200)),
      );
      await expectLater(
        nodeApi.browserScreenshot('0123456789abcdef01234567', artifactId),
        throwsA(isA<ClientApiException>()),
      );
    },
  );

  test(
    'result validation formats JSON and rejects invalid, empty and oversized bodies',
    () {
      final valid = preparePublicFetchView(
        {
          'content': '{"ok":true}',
          'contentType': 'application/json',
          'httpStatus': 200,
          'responseSizeBytes': 11,
          'ttfbMs': 5,
          'totalTimeMs': 12,
        },
        {'targetRegion': 'Pakistan', 'nodeRegion': 'Pakistan'},
        true,
      );
      expect(valid.state, 'ready');
      expect(valid.content, '{\n  "ok": true\n}');
      expect(valid.metadata['Target region'], 'Pakistan');
      expect(
        preparePublicFetchView(
          {
            'content': '<p>x</p>',
            'contentType': 'text/html',
            'httpStatus': 200,
            'responseSizeBytes': 8,
          },
          {},
          true,
        ).state,
        'ready',
      );
      expect(
        preparePublicFetchView(
          {
            'content': 'x',
            'contentType': 'image/png',
            'httpStatus': 200,
            'responseSizeBytes': 1,
          },
          {},
          true,
        ).state,
        'invalid',
      );
      expect(
        preparePublicFetchView(
          {
            'content': 'x',
            'contentType': 'text/plain; charset=iso-8859-1',
            'httpStatus': 200,
            'responseSizeBytes': 1,
          },
          {},
          true,
        ).state,
        'invalid',
      );
      expect(
        preparePublicFetchView(
          {
            'content': '',
            'contentType': 'text/plain',
            'httpStatus': 200,
            'responseSizeBytes': 0,
          },
          {},
          true,
        ).state,
        'empty',
      );
      expect(
        preparePublicFetchView(
          {
            'content': List.filled(16385, 'x').join(),
            'contentType': 'text/plain',
            'httpStatus': 200,
            'responseSizeBytes': 16385,
          },
          {},
          true,
        ).state,
        'oversized',
      );
      expect(
        preparePublicFetchView(null, {
          'error': 'route interrupted',
        }, false).state,
        'failed',
      );
    },
  );

  testWidgets(
    'HTML is shown as selectable source and saved only as plain text',
    (tester) async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(MobileDocumentService.channel, (
            call,
          ) async {
            calls.add(call);
            return true;
          });
      addTearDown(
        () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(MobileDocumentService.channel, null),
      );
      const source = '<script>window.alert(1)</script>';
      final fetch = {
        'content': source,
        'contentType': 'text/html',
        'httpStatus': 200,
        'responseSizeBytes': utf8.encode(source).length,
        'finalUrl': 'https://example.com',
        'executedAt': '2026-10-14T00:00:00Z',
        'sourceNodeId': 'node-1',
      };
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: PublicDataFetchResultView(
                taskId: 'task-1',
                fetch: fetch,
                result: {'success': true, 'latencyMs': 10},
                resultData: {
                  'targetRegion': 'Pakistan',
                  'nodeRegion': 'Pakistan',
                },
              ),
            ),
          ),
        ),
      );
      expect(find.text(source), findsOneWidget);
      expect(
        find.byWidgetPredicate(
          (widget) => widget is SelectableText && widget.data == source,
        ),
        findsOneWidget,
      );
      await tester.ensureVisible(find.text('Download'));
      await tester.tap(find.text('Download'));
      await tester.pumpAndSettle();
      expect(calls.single.method, 'saveText');
      expect(
        calls.single.arguments['filename'],
        'netshare-task-task-1.html.txt',
      );
      expect(calls.single.arguments['mimeType'], 'text/plain');
    },
  );

  testWidgets(
    'My Tasks navigation opens the persisted Public Data Fetch result',
    (tester) async {
      const source = '{"from":"node"}';
      var detailLoaded = false;
      final publicTask = {
        '_id': 'task-public',
        'targetUrl': 'https://example.com/data',
        'serviceType': 'PUBLIC_DATA_FETCH',
        'targetRegion': 'USA',
        'status': 'settled',
        'executionLimit': 1,
        'estimatedCost': 8,
        'assignedNodeId': {'region': 'USA'},
      };
      final client = ClientApi(
        role: 'platform_client',
        baseUrl: 'http://test',
        tokenProvider: () async => 'client-token',
        client: MockClient((request) async {
          if (request.url.path == '/tasks/my-tasks') {
            return http.Response(
              jsonEncode({
                'tasks': [publicTask],
              }),
              200,
            );
          }
          if (request.url.path == '/tasks/task-public') {
            detailLoaded = true;
            return http.Response(
              jsonEncode({
                'task': publicTask,
                'result': {
                  'success': true,
                  'successRate': 100,
                  'latencyMs': 11,
                  'statusCode': 200,
                  'bandwidthUsedMB': 0.001,
                  'packetLoss': null,
                  'resultData': {
                    'targetRegion': 'USA',
                    'nodeRegion': 'USA',
                    'error': null,
                  },
                  'publicFetch': {
                    'contractVersion': 1,
                    'content': source,
                    'contentType': 'application/json',
                    'httpStatus': 200,
                    'responseSizeBytes': utf8.encode(source).length,
                    'sourceNodeId': 'node-1',
                    'executedAt': '2026-10-14T00:00:00Z',
                    'ttfbMs': 4,
                    'totalTimeMs': 11,
                    'finalUrl': 'https://example.com/data',
                  },
                },
              }),
              200,
            );
          }
          return http.Response('{}', 404);
        }),
      );
      await tester.pumpWidget(MaterialApp(home: MyTasksScreen(api: client)));
      await tester.pumpAndSettle();
      await tester.tap(find.text('https://example.com/data'));
      await tester.pumpAndSettle();
      expect(find.text('Task details'), findsOneWidget);
      expect(find.text('PUBLIC_DATA_FETCH / USA'), findsOneWidget);
      expect(detailLoaded, isTrue);
    },
  );
}
