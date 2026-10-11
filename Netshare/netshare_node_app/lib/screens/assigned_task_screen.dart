import 'package:flutter/material.dart';
import '../services/node_service.dart';
import '../widgets/client_widgets.dart';

/// Read-only view: execution and results belong exclusively to the authorized
/// DataChannel/VPN route. There are no manual success or synthetic metrics.
class AssignedTaskScreen extends StatefulWidget {
  const AssignedTaskScreen({super.key});
  @override
  State<AssignedTaskScreen> createState() => _AssignedTaskScreenState();
}

class _AssignedTaskScreenState extends State<AssignedTaskScreen> {
  late Future<Map<String, dynamic>> _data;
  @override
  void initState() {
    super.initState();
    _data = NodeService.getAssignedTask();
  }

  void refresh() => setState(() => _data = NodeService.getAssignedTask());
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Assigned Task'),
      actions: [
        IconButton(onPressed: refresh, icon: const Icon(Icons.refresh)),
      ],
    ),
    body: AsyncPanel(
      future: _data,
      retry: refresh,
      builder: (data) {
        final assignment = data['assignedTask'] as Map?;
        final task = assignment?['taskId'] as Map?;
        if (task == null) {
          return const Center(child: Text('No assigned task found.'));
        }
        return ListView(
          padding: const EdgeInsets.all(18),
          children: [
            const Text(
              'Tasks run automatically through an authorized WebRTC DataChannel and Android VPN. Results cannot be entered manually.',
            ),
            infoTile('Session status', assignment?['status']),
            infoTile('Target URL', task['targetUrl']),
            infoTile('Service type', task['serviceType']),
            infoTile('Target region', task['targetRegion']),
            infoTile('Execution count', task['executionLimit']),
            infoTile('Task status', task['status']),
          ],
        );
      },
    ),
  );
}
