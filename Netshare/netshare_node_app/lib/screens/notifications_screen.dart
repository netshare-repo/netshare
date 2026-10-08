import 'package:flutter/material.dart';
import '../services/client_api.dart';
import '../widgets/client_widgets.dart';

class NotificationsScreen extends StatefulWidget {
  final ClientApi api;
  const NotificationsScreen({super.key, required this.api});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<Map<String, dynamic>> _data;
  int _offset = 0;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    _data = widget.api.notifications(_offset);
  }

  void refresh() => setState(() {
    _data = widget.api.notifications(_offset);
  });
  Future<void> read([String? id]) async {
    setState(() => _busy = true);
    try {
      if (id == null) {
        await widget.api.markAllRead();
      } else {
        await widget.api.markRead(id);
      }
      if (mounted) refresh();
    } catch (error) {
      if (mounted) mobileMessage(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Notifications'),
      actions: [
        IconButton(onPressed: refresh, icon: const Icon(Icons.refresh)),
      ],
    ),
    body: AsyncPanel(
      future: _data,
      retry: refresh,
      builder: (data) {
        final items = records(data['notifications']);
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('${data['unreadCount']} unread'),
            TextButton(
              onPressed: _busy || data['unreadCount'] == 0
                  ? null
                  : () => read(),
              child: const Text('Mark all read'),
            ),
            if (items.isEmpty) const Text('No notifications.'),
            ...items.map(
              (item) => ListTile(
                title: Text('${item['message']}'),
                subtitle: Text('${item['createdAt']} · ${item['status']}'),
                trailing: item['status'] == 'unread'
                    ? TextButton(
                        onPressed: _busy ? null : () => read(item['_id']),
                        child: const Text('Mark read'),
                      )
                    : const Icon(Icons.done),
              ),
            ),
            Row(
              children: [
                TextButton(
                  onPressed: _offset == 0 || _busy
                      ? null
                      : () {
                          _offset -= 50;
                          refresh();
                        },
                  child: const Text('Previous'),
                ),
                TextButton(
                  onPressed:
                      _offset + 50 >= (data['total'] as num? ?? 0) || _busy
                      ? null
                      : () {
                          _offset += 50;
                          refresh();
                        },
                  child: const Text('Next'),
                ),
              ],
            ),
          ],
        );
      },
    ),
  );
}
