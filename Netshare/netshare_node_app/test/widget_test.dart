import 'package:flutter_test/flutter_test.dart';
import 'package:netshare_node_app/main.dart';

void main() {
  testWidgets('NetShareNodeApp builds and displays splash screen smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const NetShareNodeApp());
    expect(find.text('NetShare'), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
  });
}
