import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/client_api.dart';
import '../../widgets/client_widgets.dart';
import 'task_details_screen.dart';

class MyTasksScreen extends StatefulWidget {
  final ClientApi api;
  const MyTasksScreen({super.key, required this.api});
  @override
  State<MyTasksScreen> createState() => _MyTasksScreenState();
}

class _MyTasksScreenState extends State<MyTasksScreen> {
  late Future<Map<String, dynamic>> _data;
  Timer? _timer;
  @override
  void initState() {
    super.initState();
    _data = widget.api.tasks();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (ModalRoute.of(context)?.isCurrent == true) refresh();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void refresh() => setState(() {
    _data = widget.api.tasks();
  });
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('My tasks'),
      actions: [
        IconButton(onPressed: refresh, icon: const Icon(Icons.refresh)),
      ],
    ),
    body: AsyncPanel(
      future: _data,
      retry: refresh,
      builder: (data) {
        final tasks = records(data['tasks']);
        if (tasks.isEmpty) return const Center(child: Text('No tasks yet.'));
        return ListView(
          children: tasks
              .map(
                (task) => ListTile(
                  title: Text('${task['targetUrl']}'),
                  subtitle: Text(
                    '${task['targetRegion']} · ${task['status']} · ${task['estimatedCost']} credits',
                  ),
                  onTap: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => TaskDetailsScreen(
                          api: widget.api,
                          taskId: task['_id'],
                        ),
                      ),
                    );
                    if (mounted) refresh();
                  },
                ),
              )
              .toList(),
        );
      },
    ),
  );
}
