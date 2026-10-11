import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../services/auth_service.dart';
import '../widgets/custom_button.dart';
import '../widgets/custom_text_field.dart';
import 'auth/verify_otp_screen.dart';
import 'role_home_screen.dart';

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
  String verificationMethod = 'email';

  Future<void> register() async {
    final name = nameController.text.trim();
    final email = emailController.text.trim();
    final phone = phoneController.text.trim();
    final password = passwordController.text.trim();
    final confirmPassword = confirmPasswordController.text.trim();

    if (name.isEmpty ||
        (verificationMethod == 'email' ? email.isEmpty : phone.isEmpty) ||
        password.isEmpty ||
        confirmPassword.isEmpty) {
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
        verificationMethod: verificationMethod,
      );

      if (!mounted) return;

      if (response['verificationRequired'] == false &&
          response['token'] != null) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const RoleHomeScreen()),
          (_) => false,
        );
        return;
      }

      final developmentOtp = response['devOtp']?.toString();
      if (developmentOtp == null) {
        showMessage(
          'Registration successful. Check your selected verification channel for the code.',
        );
      }

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => VerifyOtpScreen(
            email: response['identifier']?.toString() ?? email,
            developmentOtp: developmentOtp,
          ),
        ),
      );
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  void openExistingVerification() {
    final identifier = verificationMethod == 'sms'
        ? phoneController.text.trim()
        : emailController.text.trim();
    if (identifier.isEmpty) {
      showMessage('Enter your email or mobile number first.');
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => VerifyOtpScreen(email: identifier)),
    );
  }

  void showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create NetShare Account')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Join NetShare',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              const Text(
                'Choose how you want to use NetShare.',
                style: TextStyle(color: AppColors.textMuted),
              ),
              const SizedBox(height: 28),
              DropdownButtonFormField<String>(
                initialValue: verificationMethod,
                decoration: const InputDecoration(
                  labelText: 'Verification method',
                ),
                items: const [
                  DropdownMenuItem(
                    value: 'email',
                    child: Text('Email verification'),
                  ),
                  DropdownMenuItem(
                    value: 'sms',
                    child: Text('Mobile SMS OTP (+country code)'),
                  ),
                ],
                onChanged: isLoading
                    ? null
                    : (value) => setState(() => verificationMethod = value!),
              ),
              DropdownButtonFormField<String>(
                initialValue: role,
                decoration: const InputDecoration(labelText: 'Account role'),
                items: const [
                  DropdownMenuItem(
                    value: 'node_participant',
                    child: Text('Node Participant'),
                  ),
                  DropdownMenuItem(
                    value: 'platform_client',
                    child: Text('Platform Client'),
                  ),
                  DropdownMenuItem(value: 'both', child: Text('Both')),
                ],
                onChanged: isLoading
                    ? null
                    : (value) => setState(() => role = value!),
              ),
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
              Center(
                child: TextButton(
                  onPressed: isLoading ? null : openExistingVerification,
                  child: const Text('Account already created? Verify OTP'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
