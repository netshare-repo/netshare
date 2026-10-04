import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../services/node_service.dart';
import '../services/task_service.dart';
import '../widgets/custom_button.dart';

class AssignedTaskScreen extends StatefulWidget {
  const AssignedTaskScreen({super.key});

  @override
  State<AssignedTaskScreen> createState() => _AssignedTaskScreenState();
}

class _AssignedTaskScreenState extends State<AssignedTaskScreen> {
  Map<String, dynamic>? assignedTask;
  bool isLoading = true;
  bool actionLoading = false;

  @override
  void initState() {
    super.initState();
    loadAssignedTask();
  }

  Future<void> loadAssignedTask() async {
    setState(() => isLoading = true);

    try {
      final data = await NodeService.getAssignedTask();
      assignedTask = data['assignedTask'];
    } catch (_) {
      assignedTask = null;
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Map<String, dynamic>? get task {
    if (assignedTask == null) return null;
    if (assignedTask!['taskId'] is Map<String, dynamic>) {
      return assignedTask!['taskId'];
    }
    return null;
  }

  Future<void> startTask() async {
    if (task == null) return;

    setState(() => actionLoading = true);

    try {
      await TaskService.startTask(task!['_id']);
      await loadAssignedTask();
      showMessage('Task started successfully');
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => actionLoading = false);
    }
  }

  Future<void> completeTask() async {
    if (task == null) return;

    setState(() => actionLoading = true);

    try {
      await TaskService.completeTask(taskId: task!['_id']);
      await loadAssignedTask();
      showMessage('Task completed successfully');
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => actionLoading = false);
    }
  }

  Future<void> failTask() async {
    if (task == null) return;

    setState(() => actionLoading = true);

    try {
      await TaskService.failTask(
        taskId: task!['_id'],
        reason: 'Task failed from Flutter node app simulation',
      );
      await loadAssignedTask();
      showMessage('Task marked as failed');
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => actionLoading = false);
    }
  }

  void showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Widget infoTile(String label, String value) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardWhite,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textMuted)),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentTask = task;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Assigned Task'),
        actions: [
          IconButton(
            onPressed: loadAssignedTask,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : currentTask == null
              ? const Center(
                  child: Text(
                    'No assigned task found.',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppColors.primaryBlue,
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Task Execution Session',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Session Status: ${assignedTask?['status'] ?? ''}',
                              style: const TextStyle(color: Colors.white70),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      infoTile('Target URL', currentTask['targetUrl'] ?? ''),
                      infoTile('Service Type', currentTask['serviceType'] ?? ''),
                      infoTile('Target Region', currentTask['targetRegion'] ?? ''),
                      infoTile('Execution Limit', '${currentTask['executionLimit']}'),
                      infoTile('Task Status', currentTask['status'] ?? ''),
                      infoTile('Estimated Cost', '${currentTask['estimatedCost']} Credits'),
                      const SizedBox(height: 12),
                      CustomButton(
                        text: 'Start Task Session',
                        isLoading: actionLoading,
                        onPressed: startTask,
                      ),
                      const SizedBox(height: 12),
                      CustomButton(
                        text: 'Complete Session',
                        backgroundColor: AppColors.successGreen,
                        isLoading: actionLoading,
                        onPressed: completeTask,
                      ),
                      const SizedBox(height: 12),
                      CustomButton(
                        text: 'Fail Session',
                        backgroundColor: AppColors.dangerRed,
                        isLoading: actionLoading,
                        onPressed: failTask,
                      ),
                    ],
                  ),
                ),
    );
  }
}