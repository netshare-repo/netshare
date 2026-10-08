import 'dart:async';
import 'package:flutter/material.dart';
import '../services/client_api.dart';
import '../screens/notifications_screen.dart';

class NotificationButton extends StatefulWidget {
  final ClientApi api;
  const NotificationButton({super.key, required this.api});
  @override
  State<NotificationButton> createState() => _NotificationButtonState();
}

class _NotificationButtonState extends State<NotificationButton> {
  Timer? _timer;
  int _count = 0;
  String? _error;
  bool _loading = false;
  @override
  void initState() {
    super.initState();
    refresh();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> refresh() async {
    if (_loading) return;
    _loading = true;
    try {
      final data = await widget.api.notifications(0);
      if (mounted) {
        setState(() {
          _count = (data['unreadCount'] as num? ?? 0).toInt();
          _error = null;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Notification count unavailable');
    } finally {
      _loading = false;
    }
  }

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: _error ?? 'Notifications ($_count unread)',
    icon: Badge(
      label: Text(_error == null ? '$_count' : '!'),
      isLabelVisible: _count > 0 || _error != null,
      child: const Icon(Icons.notifications_outlined),
    ),
    onPressed: () async {
      await Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => NotificationsScreen(api: widget.api)),
      );
      if (mounted) refresh();
    },
  );
}
