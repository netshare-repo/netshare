import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../services/auth_service.dart';
import '../widgets/custom_button.dart';
import '../widgets/custom_text_field.dart';
import 'auth/verify_otp_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final nameController = TextEditingController();
  final emailController = TextEditingController();
  final phoneController = TextEditingController();
  final passwordController = TextEditingController();
  final confirmPasswordController = TextEditingController();

  bool isLoading = false;
  String role = 'node_participant';

  Future<void> register() async {
    final name = nameController.text.trim();
    final email = emailController.text.trim();
    final phone = phoneController.text.trim();
    final password = passwordController.text.trim();
    final confirmPassword = confirmPasswordController.text.trim();

    if (name.isEmpty || email.isEmpty || password.isEmpty || confirmPassword.isEmpty) {
      showMessage('Name, email, and passwords are required');
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
      final response = await AuthService.register(
        name: name,
        email: email,
        phone: phone,
        password: password,
        role: role,
      );

      if (!mounted) return;

      if (response['devOtp'] != null) {
        showMessage('Registered successfully. (Dev OTP: ${response['devOtp']})');
      } else {
        showMessage('Registration successful. Please check your email for OTP.');
      }

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => VerifyOtpScreen(email: email)),
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
        title: const Text('Create NetShare Account'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Join NetShare',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Choose how you want to use NetShare.',
                style: TextStyle(color: AppColors.textMuted),
              ),
              const SizedBox(height: 28),
              DropdownButtonFormField<String>(initialValue: role, decoration: const InputDecoration(labelText: 'Account role'),
                items: const [DropdownMenuItem(value: 'node_participant', child: Text('Node Participant')),
                  DropdownMenuItem(value: 'platform_client', child: Text('Platform Client')), DropdownMenuItem(value: 'both', child: Text('Both'))],
                onChanged: isLoading ? null : (value) => setState(() => role = value!)),
              CustomTextField(
                controller: nameController,
                label: 'Full Name',
                hint: 'Enter your name',
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: emailController,
                label: 'Email',
                hint: 'Enter your email',
                icon: Icons.email_outlined,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: phoneController,
                label: 'Phone',
                hint: 'Enter your phone number',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: passwordController,
                label: 'Password',
                hint: 'Create password',
                icon: Icons.lock_outline,
                obscureText: true,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: confirmPasswordController,
                label: 'Confirm Password',
                hint: 'Confirm password',
                icon: Icons.lock_outline,
                obscureText: true,
              ),
              const SizedBox(height: 28),
              CustomButton(
                text: 'Create Account',
                isLoading: isLoading,
                onPressed: register,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
