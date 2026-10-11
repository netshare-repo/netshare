import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:netshare_node_app/screens/auth/verify_otp_screen.dart';
import 'package:netshare_node_app/screens/register_screen.dart';

void main() {
  testWidgets('development OTP is visible and prefilled for verification', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: VerifyOtpScreen(
          email: 'account@example.test',
          developmentOtp: '654321',
        ),
      ),
    );

    expect(find.text('Development OTP (latest): 654321'), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
        '654321');
  });

  testWidgets('production verification does not show a development OTP', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: VerifyOtpScreen(email: 'account@example.test')),
    );

    expect(find.textContaining('Development OTP'), findsNothing);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
        isEmpty);
  });

  testWidgets('an existing unverified account can reopen verification', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: RegisterScreen()));
    await tester.enterText(
      find.byType(TextField).at(1),
      'account@example.test',
    );
    final recovery = find.text('Account already created? Verify OTP');
    await tester.ensureVisible(recovery);
    await tester.tap(recovery);
    await tester.pumpAndSettle();

    expect(find.text('Verify Account'), findsOneWidget);
    expect(find.textContaining('account@example.test'), findsOneWidget);
  });

  testWidgets('an OTP screen can return to password sign-in', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: VerifyOtpScreen(email: 'account@example.test')),
    );
    final signIn = find.text('Sign in with password instead');
    await tester.ensureVisible(signIn);
    await tester.tap(signIn);
    await tester.pumpAndSettle();
    expect(find.text('Sign In'), findsOneWidget);
  });
}
