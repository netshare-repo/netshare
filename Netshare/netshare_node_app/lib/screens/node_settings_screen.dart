import 'package:flutter/material.dart';
import '../models/node_device_model.dart';
import '../services/node_service.dart';
import '../widgets/custom_button.dart';
import '../widgets/custom_text_field.dart';

class NodeSettingsScreen extends StatefulWidget {
  final NodeDeviceModel node;

  const NodeSettingsScreen({
    super.key,
    required this.node,
  });

  @override
  State<NodeSettingsScreen> createState() => _NodeSettingsScreenState();
}

class _NodeSettingsScreenState extends State<NodeSettingsScreen> {
  late TextEditingController regionController;
  late TextEditingController bandwidthController;
  late TextEditingController speedController;
  late TextEditingController maxTasksController;

  bool isLoading = false;

  @override
  void initState() {
    super.initState();
    regionController = TextEditingController(text: widget.node.region);
    bandwidthController =
        TextEditingController(text: widget.node.bandwidthLimitMB.toString());
    speedController =
        TextEditingController(text: widget.node.speedCapMbps.toString());
    maxTasksController =
        TextEditingController(text: widget.node.maxConcurrentTasks.toString());
  }

  Future<void> updateSettings() async {
    setState(() => isLoading = true);

    try {
      final bandwidth = int.tryParse(bandwidthController.text.trim()) ?? 0;
      final speed = int.tryParse(speedController.text.trim()) ?? 0;
      final maxTasks = int.tryParse(maxTasksController.text.trim()) ?? 0;

      if (bandwidth <= 0 || speed <= 0 || maxTasks <= 0) {
        setState(() => isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Numeric values must be greater than 0')),
        );
        return;
      }

      await NodeService.updateSettings(
        region: regionController.text.trim(),
        bandwidthLimitMB: bandwidth,
        speedCapMbps: speed,
        maxConcurrentTasks: maxTasks,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Node settings updated')),
      );

      Navigator.pop(context);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception:', '').trim())),
      );
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Node Settings'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            CustomTextField(
              controller: regionController,
              label: 'Region',
              hint: 'Pakistan',
              icon: Icons.location_on_outlined,
            ),
            const SizedBox(height: 16),
            CustomTextField(
              controller: bandwidthController,
              label: 'Bandwidth Limit MB',
              hint: '2000',
              icon: Icons.data_usage,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            CustomTextField(
              controller: speedController,
              label: 'Speed Cap Mbps',
              hint: '20',
              icon: Icons.speed,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            CustomTextField(
              controller: maxTasksController,
              label: 'Max Concurrent Tasks',
              hint: '1',
              icon: Icons.task_alt,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 26),
            CustomButton(
              text: 'Save Settings',
              isLoading: isLoading,
              onPressed: updateSettings,
            ),
          ],
        ),
      ),
    );
  }
}