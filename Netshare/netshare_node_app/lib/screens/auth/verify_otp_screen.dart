import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../services/auth_service.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';
import '../role_home_screen.dart';
import '../login_screen.dart';

class VerifyOtpScreen extends StatefulWidget {
  final String email;
  final String? developmentOtp;

  const VerifyOtpScreen({super.key, required this.email, this.developmentOtp});

  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen> {
  final otpController = TextEditingController();
  String? developmentOtp;
  bool isLoading = false;
  bool isResending = false;

  @override
  void initState() {
    super.initState();
    developmentOtp = widget.developmentOtp;
    if (developmentOtp != null) otpController.text = developmentOtp!;
  }

  @override
  void dispose() {
    otpController.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    final otp = otpController.text.trim();

    if (!RegExp(r'^\d{6}$').hasMatch(otp)) {
      showMessage('Please enter a valid 6-digit OTP');
      return;
    }

    setState(() => isLoading = true);

    try {
      final data = await AuthService.verifySignupOtp(
        email: widget.email,
        otp: otp,
      );

      final role = data['user']?['role'];

      if (!['node_participant', 'platform_client', 'both'].contains(role)) {
        showMessage('This account has no supported mobile role');
        await AuthService.logout();
        return;
      }

      if (!mounted) return;

      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const RoleHomeScreen()),
        (route) => false,
      );
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> resendOtp() async {
    setState(() => isResending = true);
    try {
      final response = await AuthService.resendSignupOtp(email: widget.email);
      if (!mounted) return;
      final newDevelopmentOtp = response['devOtp']?.toString();
      setState(() {
        developmentOtp = newDevelopmentOtp;
        otpController.text = newDevelopmentOtp ?? '';
      });
      if (newDevelopmentOtp != null) {
        showMessage('New development OTP ready. Use the code shown here.');
      } else {
        showMessage('A new OTP has been sent to your selected channel.');
      }
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => isResending = false);
    }
  }

  void showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verify Account')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Enter OTP',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Enter the 6-digit OTP sent to ${widget.email}.',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 15,
                ),
              ),
              if (developmentOtp != null) ...[
                const SizedBox(height: 16),
                Text(
                  'Development OTP (latest): $developmentOtp',
                  style: const TextStyle(
                    color: AppColors.primaryBlue,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 8),
              const Text('Resending replaces the previous code.'),
              const SizedBox(height: 32),
              CustomTextField(
                controller: otpController,
                label: 'OTP',
                hint: '123456',
                icon: Icons.password_outlined,
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 28),
              CustomButton(
                text: 'Verify',
                isLoading: isLoading,
                onPressed: submit,
              ),
              const SizedBox(height: 16),
              Center(
                child: TextButton(
                  onPressed: isResending ? null : resendOtp,
                  child: isResending
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text(
                          'Resend OTP',
                          style: TextStyle(color: AppColors.primaryBlue),
                        ),
                ),
              ),
              Center(
                child: TextButton(
                  onPressed: () => Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                    (_) => false,
                  ),
                  child: const Text('Sign in with password instead'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
