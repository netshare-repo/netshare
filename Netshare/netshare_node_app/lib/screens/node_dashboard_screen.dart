import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import '../models/node_device_model.dart';
import '../models/wallet_model.dart';
import '../services/auth_service.dart';
import '../services/node_service.dart';
import '../services/wallet_service.dart';
import '../services/client_api.dart';
import '../widgets/notification_button.dart';
import '../widgets/custom_button.dart';
import '../widgets/dashboard_card.dart';

import 'assigned_task_screen.dart';
import 'login_screen.dart';
import 'marketplace_screen.dart';
import 'node_registration_screen.dart';
import 'node_settings_screen.dart';
import 'profile_screen.dart';
import 'wallet_screen.dart';

class NodeDashboardScreen extends StatefulWidget {
  final ClientApi? notificationApi;
  const NodeDashboardScreen({super.key, this.notificationApi});

  @override
  State<NodeDashboardScreen> createState() => _NodeDashboardScreenState();
}

class _NodeDashboardScreenState extends State<NodeDashboardScreen> {
  NodeDeviceModel? node;
  WalletModel? wallet;
  bool isLoading = true;
  bool actionLoading = false;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    loadDashboard();
  }

  Future<void> loadDashboard() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      try {
        final nodeData = await NodeService.getMyNode();
        node = NodeDeviceModel.fromJson(nodeData['node']);
      } catch (_) {
        node = null;
      }

      try {
        final walletData = await WalletService.getWallet();
        wallet = WalletModel.fromJson(walletData['wallet']);
      } catch (_) {
        wallet = null;
      }
    } catch (e) {
      errorMessage = e.toString();
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> startStopNode() async {
    if (node == null) return;

    setState(() => actionLoading = true);

    try {
      if (node!.status == 'active' || node!.status == 'busy') {
        await NodeService.stopParticipation();
      } else {
        await NodeService.startParticipation();
      }

      await loadDashboard();
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => actionLoading = false);
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

  void showMessage(String message) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Color statusColor(String status) {
    if (status == 'active') return AppColors.successGreen;
    if (status == 'busy') return Colors.orange;
    if (status == 'paused') return Colors.amber;
    return AppColors.dangerRed;
  }

  void openPage(int index) {
    if (index == 0) return;

    if (index == 1) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const AssignedTaskScreen()),
      );
    } else if (index == 2) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const WalletScreen()),
      );
    } else if (index == 3) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const MarketplaceScreen()),
      );
    } else if (index == 4) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const ProfileScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isActive = node?.status == 'active' || node?.status == 'busy';

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'NetShare Node',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          if (widget.notificationApi != null) NotificationButton(api: widget.notificationApi!),
          IconButton(
            onPressed: loadDashboard,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            onPressed: logout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: loadDashboard,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (errorMessage != null)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 14),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.dangerRed.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: AppColors.dangerRed.withValues(alpha: 0.25),
                          ),
                        ),
                        child: Text(
                          errorMessage!,
                          style: const TextStyle(
                            color: AppColors.dangerRed,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),

                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.primaryBlue,
                        borderRadius: BorderRadius.circular(26),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Node Participant Dashboard',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            node == null
                                ? 'Register your device to start participation.'
                                : 'Device: ${node!.deviceName}',
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 18),
                          if (node == null)
                            CustomButton(
                              text: 'Register Node Device',
                              backgroundColor: AppColors.darkNavy,
                              onPressed: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        const NodeRegistrationScreen(),
                                  ),
                                );
                                loadDashboard();
                              },
                            )
                          else
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: statusColor(node!.status),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    node!.status.toUpperCase(),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 18),

                    if (node != null) ...[
                      DashboardCard(
                        title: 'Bandwidth Limit',
                        value: '${node!.bandwidthLimitMB} MB',
                        icon: Icons.network_check_rounded,
                      ),
                      const SizedBox(height: 12),
                      DashboardCard(
                        title: 'Used Bandwidth',
                        value: '${node!.usedBandwidthMB} MB',
                        icon: Icons.data_usage_rounded,
                        color: Colors.orange,
                      ),
                      const SizedBox(height: 12),
                      DashboardCard(
                        title: 'Speed Cap',
                        value: '${node!.speedCapMbps} Mbps',
                        icon: Icons.speed_rounded,
                        color: Colors.purple,
                      ),
                      const SizedBox(height: 12),
                      DashboardCard(
                        title: 'Wallet Balance',
                        value: '${wallet?.balance ?? 0} Credits',
                        icon: Icons.account_balance_wallet_rounded,
                        color: AppColors.successGreen,
                      ),
                      const SizedBox(height: 22),
                      CustomButton(
                        text: isActive
                            ? 'Stop Participation'
                            : 'Start Participation',
                        isLoading: actionLoading,
                        backgroundColor:
                            isActive ? AppColors.dangerRed : AppColors.successGreen,
                        onPressed: startStopNode,
                      ),
                      const SizedBox(height: 12),
                      CustomButton(
                        text: 'View Assigned Task',
                        backgroundColor: AppColors.darkNavy,
                        onPressed: () {
                           Navigator.push(
                             context,
                             MaterialPageRoute(
                               builder: (_) => const AssignedTaskScreen(),
                             ),
                           );
                        },
                      ),
                      const SizedBox(height: 12),
                      CustomButton(
                        text: 'Update Node Settings',
                        onPressed: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => NodeSettingsScreen(node: node!),
                            ),
                          );
                          loadDashboard();
                        },
                      ),
                      const SizedBox(height: 12),
                      CustomButton(
                        text: 'Wallet & Transactions',
                        backgroundColor: Colors.indigo,
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const WalletScreen(),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                      CustomButton(
                        text: 'Marketplace',
                        backgroundColor: Colors.deepPurple,
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const MarketplaceScreen(),
                            ),
                          );
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: 0,
        selectedItemColor: AppColors.primaryBlue,
        unselectedItemColor: AppColors.textMuted,
        type: BottomNavigationBarType.fixed,
        onTap: openPage,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_rounded),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.task_alt_rounded),
            label: 'Tasks',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.wallet_rounded),
            label: 'Wallet',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.storefront_rounded),
            label: 'Market',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_rounded),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
