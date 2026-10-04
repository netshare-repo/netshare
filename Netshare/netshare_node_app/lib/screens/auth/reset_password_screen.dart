import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../services/auth_service.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class ResetPasswordScreen extends StatefulWidget {
  final String email;

  const ResetPasswordScreen({super.key, required this.email});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final otpController = TextEditingController();
  final passwordController = TextEditingController();
  final confirmPasswordController = TextEditingController();
  bool isLoading = false;

  Future<void> submit() async {
    final otp = otpController.text.trim();
    final password = passwordController.text.trim();
    final confirmPassword = confirmPasswordController.text.trim();

    if (otp.isEmpty || password.isEmpty || confirmPassword.isEmpty) {
      showMessage('All fields are required');
      return;
    }

    if (password != confirmPassword) {
      showMessage('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      showMessage('Password must be at least 8 characters');
      return;
    }

    setState(() => isLoading = true);

    try {
      await AuthService.resetPassword(
        email: widget.email,
        otp: otp,
        newPassword: password,
      );

      if (!mounted) return;

      showMessage('Password reset successfully. You can now login.');

      // Go back to login screen
      Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  void showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Password'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Create New Password',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Enter the 6-digit OTP sent to ${widget.email} and your new password.',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 32),
              CustomTextField(
                controller: otpController,
                label: 'OTP',
                hint: 'Enter 6-digit OTP',
                icon: Icons.password_outlined,
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 18),
              CustomTextField(
                controller: passwordController,
                label: 'New Password',
                hint: 'Enter new password',
                icon: Icons.lock_outline,
                obscureText: true,
              ),
              const SizedBox(height: 18),
              CustomTextField(
                controller: confirmPasswordController,
                label: 'Confirm Password',
                hint: 'Confirm new password',
                icon: Icons.lock_outline,
                obscureText: true,
              ),
              const SizedBox(height: 28),
              CustomButton(
                text: 'Reset Password',
                isLoading: isLoading,
                onPressed: submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
