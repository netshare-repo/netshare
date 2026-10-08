import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/auth_service.dart';
import '../services/client_api.dart';
import 'client/client_dashboard_screen.dart';
import 'node_dashboard_screen.dart';
import 'login_screen.dart';

class RoleHomeScreen extends StatefulWidget {
  final Future<Map<String, dynamic>> Function()? userLoader;
  final ClientApi Function(String)? apiFactory;
  final Widget Function()? nodeBuilder;
  const RoleHomeScreen({
    super.key,
    this.userLoader,
    this.apiFactory,
    this.nodeBuilder,
  });
  @override
  State<RoleHomeScreen> createState() => _RoleHomeScreenState();
}

class _RoleHomeScreenState extends State<RoleHomeScreen> {
  String? _role, _userId, _error;
  String _mode = 'node';
  bool _loading = true, _switching = false;
  ClientApi? _api;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    _api?.close();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await (widget.userLoader ?? AuthService.getMe)();
      final user = response['user'] as Map<String, dynamic>;
      final role = user['role'] as String;
      if (!['node_participant', 'platform_client', 'both'].contains(role)) {
        throw const ClientApiException(
          403,
          'This account has no supported mobile role.',
        );
      }
      final id = (user['_id'] ?? user['id']) as String;
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      _api?.close();
      _api = (widget.apiFactory ?? ((role) => ClientApi(role: role)))(role);
      setState(() {
        _role = role;
        _userId = id;
        _mode =
            role == 'platform_client' ||
                role == 'both' && prefs.getString('mobileMode:$id') == 'client'
            ? 'client'
            : 'node';
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> switchMode(String mode) async {
    if (_role != 'both' || _switching || mode == _mode) return;
    setState(() => _switching = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('mobileMode:$_userId', mode);
      if (mounted) setState(() => _mode = mode);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not switch mode: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _switching = false);
    }
  }

  Future<void> signOut() async {
    await AuthService.logout();
    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (_) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Account access')),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!),
              FilledButton(onPressed: load, child: const Text('Retry')),
              TextButton(onPressed: signOut, child: const Text('Sign out')),
            ],
          ),
        ),
      );
    }
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            if (_role == 'both')
              Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  children: [
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(
                          value: 'node',
                          label: Text('Node Participant'),
                        ),
                        ButtonSegment(
                          value: 'client',
                          label: Text('Platform Client'),
                        ),
                      ],
                      selected: {_mode},
                      onSelectionChanged: _switching
                          ? null
                          : (value) => switchMode(value.first),
                    ),
                    const Text(
                      'Switching views does not start or stop node participation.',
                      style: TextStyle(fontSize: 11),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: _mode == 'client'
                  ? ClientDashboardScreen(
                      key: ValueKey('client:$_userId'),
                      api: _api!,
                    )
                  : widget.nodeBuilder?.call() ??
                        NodeDashboardScreen(
                          key: ValueKey('node:$_userId'),
                          notificationApi: _api,
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
