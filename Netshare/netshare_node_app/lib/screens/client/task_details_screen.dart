import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/client_api.dart';
import '../../services/mobile_document_service.dart';
import '../../widgets/client_widgets.dart';

class TaskDetailsScreen extends StatefulWidget {
  final ClientApi api;
  final String taskId;
  const TaskDetailsScreen({super.key, required this.api, required this.taskId});
  @override
  State<TaskDetailsScreen> createState() => _TaskDetailsScreenState();
}

class _TaskDetailsScreenState extends State<TaskDetailsScreen> {
  late Future<Map<String, dynamic>> _data;
  Timer? _timer;
  bool _terminal = false, _busy = false;
  int _rating = 5;
  final _comment = TextEditingController();
  @override
  void initState() {
    super.initState();
    _data = widget.api.task(widget.taskId);
    _timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (!_terminal && !_busy && ModalRoute.of(context)?.isCurrent == true) {
        refresh();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _comment.dispose();
    super.dispose();
  }

  void refresh() => setState(() {
    _data = widget.api.task(widget.taskId);
  });
  Future<void> rate() async {
    setState(() => _busy = true);
    try {
      await widget.api.rate(widget.taskId, _rating, _comment.text.trim());
      if (mounted) {
        mobileMessage(context, 'Rating recorded.');
        refresh();
      }
    } catch (error) {
      if (mounted) mobileMessage(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> report() async {
    setState(() => _busy = true);
    try {
      final csv = await widget.api.report(widget.taskId);
      if (!mounted) return;
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ReportScreen(taskId: widget.taskId, csv: csv),
        ),
      );
    } catch (error) {
      if (mounted) mobileMessage(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Task details'),
      actions: [
        IconButton(onPressed: refresh, icon: const Icon(Icons.refresh)),
      ],
    ),
    body: AsyncPanel(
      future: _data,
      retry: refresh,
      builder: (data) {
        final task = data['task'] as Map<String, dynamic>;
        final result = data['result'];
        final completed = ['completed', 'settled'].contains(task['status']);
        _terminal =
            completed || ['failed', 'cancelled'].contains(task['status']);
        final rated = task['clientRating']?['ratedAt'] != null;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            infoTile('Task ID', task['_id']),
            infoTile('Target URL', task['targetUrl']),
            infoTile('Status', task['status']),
            infoTile(
              'Service / region',
              '${task['serviceType']} / ${task['targetRegion']}',
            ),
            infoTile(
              'Executions / cost',
              '${task['executionLimit']} / ${task['estimatedCost']} credits',
            ),
            infoTile(
              'Assigned node',
              task['assignedNodeId'] is Map
                  ? task['assignedNodeId']['deviceName']
                  : task['assignedNodeId'],
            ),
            infoTile('Result summary', task['resultSummary']),
            if (result == null)
              const Text('No recorded result yet.')
            else ...[
              infoTile('Success rate', '${result['successRate']}%'),
              infoTile('Response time', '${result['latencyMs']} ms'),
              infoTile('Bandwidth', '${result['bandwidthUsedMB']} MB'),
              infoTile('HTTP status', result['statusCode']),
              infoTile('Result', result['resultData']),
            ],
            if (completed && result != null)
              FilledButton(
                onPressed: _busy ? null : report,
                child: const Text('Open / save CSV report'),
              ),
            if (rated)
              infoTile('Your node rating', task['clientRating']['rating']),
            if (completed && task['assignedNodeId'] != null && !rated) ...[
              DropdownButtonFormField<int>(
                initialValue: _rating,
                decoration: const InputDecoration(labelText: 'Node rating'),
                items: [1, 2, 3, 4, 5]
                    .map(
                      (rating) => DropdownMenuItem(
                        value: rating,
                        child: Text('$rating stars'),
                      ),
                    )
                    .toList(),
                onChanged: _busy
                    ? null
                    : (value) => setState(() => _rating = value!),
              ),
              TextField(
                controller: _comment,
                maxLength: 500,
                decoration: const InputDecoration(
                  labelText: 'Rating comment (optional)',
                ),
              ),
              FilledButton(
                onPressed: _busy ? null : rate,
                child: const Text('Rate node once'),
              ),
            ],
          ],
        );
      },
    ),
  );
}

class ReportScreen extends StatelessWidget {
  final String taskId, csv;
  const ReportScreen({super.key, required this.taskId, required this.csv});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Task CSV report'),
      actions: [
        IconButton(
          tooltip: 'Save CSV',
          icon: const Icon(Icons.save_alt),
          onPressed: () async {
            try {
              final saved = await MobileDocumentService.saveReport(taskId, csv);
              if (context.mounted && saved) {
                mobileMessage(context, 'Report saved.');
              }
            } catch (_) {
              if (context.mounted) {
                mobileMessage(
                  context,
                  'Saving is unavailable on this platform. Select and copy the report below.',
                );
              }
            }
          },
        ),
      ],
    ),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: SelectableText(csv),
    ),
  );
}
