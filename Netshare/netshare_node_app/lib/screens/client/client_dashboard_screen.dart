import 'package:flutter/material.dart';
import '../../services/client_api.dart';
import '../../services/auth_service.dart';
import '../../widgets/client_widgets.dart';
import '../../widgets/notification_button.dart';
import '../login_screen.dart';
import '../marketplace_screen.dart';
import '../profile_screen.dart';
import 'submit_task_screen.dart';
import 'my_tasks_screen.dart';
import 'client_wallet_screen.dart';
import 'task_details_screen.dart';

class ClientDashboardScreen extends StatefulWidget {
  final ClientApi api;
  const ClientDashboardScreen({super.key, required this.api});
  @override
  State<ClientDashboardScreen> createState() => _ClientDashboardScreenState();
}

class _ClientDashboardScreenState extends State<ClientDashboardScreen> {
  late Future<List<Map<String, dynamic>>> _data;
  @override
  void initState() {
    super.initState();
    _data = load();
  }

  Future<List<Map<String, dynamic>>> load() async =>
      Future.wait([widget.api.dashboard(), widget.api.tasks()]);
  void refresh() => setState(() {
    _data = load();
  });
  Future<void> open(Widget screen) async {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
    if (mounted) refresh();
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

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Platform Client'),
      actions: [
        NotificationButton(api: widget.api),
        IconButton(
          onPressed: refresh,
          icon: const Icon(Icons.refresh),
          tooltip: 'Refresh',
        ),
        IconButton(
          onPressed: logout,
          icon: const Icon(Icons.logout),
          tooltip: 'Sign out',
        ),
      ],
    ),
    body: AsyncPanel(
      future: _data,
      retry: refresh,
      builder: (data) {
        final summary = data[0];
        final tasks = records(data[1]['tasks']);
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            infoTile('Active tasks', summary['activeTasks']),
            infoTile('Completed tasks', summary['completedTasks']),
            infoTile('Available credits', summary['availableCredits']),
            FilledButton(
              onPressed: () => open(SubmitTaskScreen(api: widget.api)),
              child: const Text('Submit task'),
            ),
            OutlinedButton(
              onPressed: () => open(MyTasksScreen(api: widget.api)),
              child: const Text('My tasks'),
            ),
            OutlinedButton(
              onPressed: () => open(ClientWalletScreen(api: widget.api)),
              child: const Text('Wallet / Top-up'),
            ),
            OutlinedButton(
              onPressed: () => open(const MarketplaceScreen()),
              child: const Text('Marketplace / Orders'),
            ),
            TextButton(
              onPressed: () => open(const ProfileScreen()),
              child: const Text('Profile'),
            ),
            const Text(
              'Recent task activity',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            if (tasks.isEmpty)
              const ListTile(
                title: Text('No tasks yet. Submit your first task.'),
              ),
            ...tasks
                .take(5)
                .map(
                  (task) => ListTile(
                    title: Text('${task['serviceType']}'),
                    subtitle: Text(
                      '${task['targetRegion']} · ${task['status']}',
                    ),
                    onTap: () => open(
                      TaskDetailsScreen(api: widget.api, taskId: task['_id']),
                    ),
                  ),
                ),
          ],
        );
      },
    ),
  );
}
