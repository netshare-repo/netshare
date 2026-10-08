import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../services/user_service.dart';
import '../widgets/custom_button.dart';
import '../widgets/custom_text_field.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  UserModel? user;
  bool isLoading = true;
  bool isSaving = false;

  final nameController = TextEditingController();
  final phoneController = TextEditingController();

  @override
  void initState() {
    super.initState();
    loadProfile();
  }

  Future<void> loadProfile() async {
    setState(() => isLoading = true);

    try {
      final data = await UserService.getProfile();
      user = UserModel.fromJson(data['user']);

      nameController.text = user?.name ?? '';
      phoneController.text = user?.phone ?? '';
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> updateProfile() async {
    if (nameController.text.trim().isEmpty) {
      showMessage('Name is required');
      return;
    }

    setState(() => isSaving = true);

    try {
      final data = await UserService.updateProfile(
        name: nameController.text.trim(),
        phone: phoneController.text.trim(),
      );

      user = UserModel.fromJson(data['user']);

      if (!mounted) return;
      showMessage('Profile updated successfully');
      setState(() {});
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => isSaving = false);
    }
  }

  Future<void> logout() async {
    await AuthService.logout();

    if (!mounted) return;

    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  String cleanRole(String role) {
    if (role == 'node_participant') return 'Node Participant';
    if (role == 'platform_client') return 'Platform Client';
    if (role == 'admin') return 'Admin';
    if (role == 'both') return 'Dual Role User';
    return role;
  }

  void showMessage(String message) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  void showChangePasswordDialog() {
    final oldPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();
    bool isChanging = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              title: const Text('Change Password'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CustomTextField(
                      controller: oldPasswordController,
                      label: 'Current Password',
                      hint: 'Enter current password',
                      icon: Icons.lock_outline,
                      obscureText: true,
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: newPasswordController,
                      label: 'New Password',
                      hint: 'Enter new password',
                      icon: Icons.lock_outline,
                      obscureText: true,
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: confirmPasswordController,
                      label: 'Confirm New Password',
                      hint: 'Confirm new password',
                      icon: Icons.lock_outline,
                      obscureText: true,
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isChanging ? null : () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: isChanging
                      ? null
                      : () async {
                          final oldPw = oldPasswordController.text.trim();
                          final newPw = newPasswordController.text.trim();
                          final confirmPw = confirmPasswordController.text.trim();

                          if (oldPw.isEmpty || newPw.isEmpty || confirmPw.isEmpty) {
                            showMessage('All fields are required');
                            return;
                          }

                          if (newPw != confirmPw) {
                            showMessage('New passwords do not match');
                            return;
                          }

                          if (newPw.length < 8) {
                            showMessage('New password must be at least 8 characters');
                            return;
                          }

                          setStateDialog(() => isChanging = true);

                          try {
                            await UserService.changePassword(
                              oldPassword: oldPw,
                              newPassword: newPw,
                            );
                            if (!context.mounted) return;
                            Navigator.pop(context);
                            showMessage('Password changed successfully');
                          } catch (e) {
                            showMessage(e.toString().replaceAll('Exception:', '').trim());
                          } finally {
                            if (mounted) {
                              setStateDialog(() => isChanging = false);
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: isChanging
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text('Change'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget infoBox({
    required IconData icon,
    required String title,
    required String value,
    Color color = AppColors.primaryBlue,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardWhite,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: color.withValues(alpha: 0.12),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value.isEmpty ? 'Not provided' : value,
                  style: const TextStyle(
                    color: AppColors.textDark,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    nameController.dispose();
    phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = user;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Profile',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            onPressed: loadProfile,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : currentUser == null
              ? const Center(
                  child: Text(
                    'Profile not found',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: loadProfile,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(22),
                          decoration: BoxDecoration(
                            color: AppColors.primaryBlue,
                            borderRadius: BorderRadius.circular(26),
                          ),
                          child: Column(
                            children: [
                              const CircleAvatar(
                                radius: 45,
                                backgroundColor: Colors.white,
                                child: Icon(
                                  Icons.person_rounded,
                                  size: 50,
                                  color: AppColors.primaryBlue,
                                ),
                              ),
                              const SizedBox(height: 14),
                              Text(
                                currentUser.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                currentUser.email,
                                style: const TextStyle(
                                  color: Colors.white70,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 7,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.18),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  cleanRole(currentUser.role),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 22),

                        const Text(
                          'Account Information',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 12),

                        infoBox(
                          icon: Icons.email_outlined,
                          title: 'Email Address',
                          value: currentUser.email,
                        ),
                        infoBox(
                          icon: Icons.phone_outlined,
                          title: 'Phone Number',
                          value: currentUser.phone,
                          color: Colors.green,
                        ),
                        infoBox(
                          icon: Icons.verified_user_outlined,
                          title: 'Account Status',
                          value: currentUser.status.toUpperCase(),
                          color: currentUser.status == 'active'
                              ? AppColors.successGreen
                              : AppColors.dangerRed,
                        ),
                        infoBox(
                          icon: Icons.verified_rounded,
                          title: 'Verification',
                          value: currentUser.isVerified
                              ? 'Verified'
                              : 'Not Verified',
                          color: Colors.orange,
                        ),

                        const SizedBox(height: 20),

                        const Text(
                          'Update Profile',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 12),

                        CustomTextField(
                          controller: nameController,
                          label: 'Full Name',
                          hint: 'Enter your name',
                          icon: Icons.person_outline,
                        ),
                        const SizedBox(height: 16),
                        CustomTextField(
                          controller: phoneController,
                          label: 'Phone Number',
                          hint: 'Enter phone number',
                          icon: Icons.phone_outlined,
                          keyboardType: TextInputType.phone,
                        ),

                        const SizedBox(height: 24),

                        CustomButton(
                          text: 'Save Changes',
                          isLoading: isSaving,
                          onPressed: updateProfile,
                        ),

                        const SizedBox(height: 24),

                        const Text(
                          'Security',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 12),
                        
                        CustomButton(
                          text: 'Change Password',
                          backgroundColor: AppColors.darkNavy,
                          onPressed: () => showChangePasswordDialog(),
                        ),

                        const SizedBox(height: 24),

                        CustomButton(
                          text: 'Logout',
                          backgroundColor: AppColors.dangerRed,
                          onPressed: logout,
                        ),

                        const SizedBox(height: 30),
                      ],
                    ),
                  ),
                ),
    );
  }
}
