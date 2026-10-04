import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../services/auth_service.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';
import 'reset_password_screen.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final emailController = TextEditingController();
  bool isLoading = false;

  Future<void> submit() async {
    if (emailController.text.isEmpty) {
      showMessage('Email is required');
      return;
    }

    setState(() => isLoading = true);

    try {
      final email = emailController.text.trim();
      final response = await AuthService.forgotPassword(email: email);

      if (!mounted) return;

      if (response['devOtp'] != null) {
        showMessage('OTP sent. (Dev OTP: ${response['devOtp']})');
      } else {
        showMessage('OTP sent to your email.');
      }

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ResetPasswordScreen(email: email),
        ),
      );
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
        title: const Text('Forgot Password'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Reset your password',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter your email address to receive an OTP.',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 32),
              CustomTextField(
                controller: emailController,
                label: 'Email',
                hint: 'Enter your registered email',
                icon: Icons.email_outlined,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 28),
              CustomButton(
                text: 'Send OTP',
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
