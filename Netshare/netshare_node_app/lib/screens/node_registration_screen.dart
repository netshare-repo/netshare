import 'package:flutter/material.dart';
import '../services/node_service.dart';
import '../widgets/custom_button.dart';
import '../widgets/custom_text_field.dart';

class NodeRegistrationScreen extends StatefulWidget {
  const NodeRegistrationScreen({super.key});

  @override
  State<NodeRegistrationScreen> createState() => _NodeRegistrationScreenState();
}

class _NodeRegistrationScreenState extends State<NodeRegistrationScreen> {
  final deviceNameController = TextEditingController();
  final deviceIdController = TextEditingController();
  final regionController = TextEditingController(text: 'Pakistan');
  final bandwidthController = TextEditingController(text: '2000');
  final speedController = TextEditingController(text: '20');
  final maxTasksController = TextEditingController(text: '1');

  bool isLoading = false;

  Future<void> registerNode() async {
    if (deviceNameController.text.isEmpty ||
        regionController.text.isEmpty ||
        bandwidthController.text.isEmpty ||
        speedController.text.isEmpty) {
      showMessage('Please fill required fields');
      return;
    }

    setState(() => isLoading = true);

    try {
      final bandwidth = int.tryParse(bandwidthController.text.trim()) ?? 0;
      final speed = int.tryParse(speedController.text.trim()) ?? 0;
      final maxTasks = int.tryParse(maxTasksController.text.trim()) ?? 0;

      if (bandwidth <= 0 || speed <= 0 || maxTasks <= 0) {
        setState(() => isLoading = false);
        showMessage('Numeric values must be greater than 0');
        return;
      }

      await NodeService.registerNode(
        deviceName: deviceNameController.text.trim(),
        deviceId: deviceIdController.text.trim(),
        region: regionController.text.trim(),
        bandwidthLimitMB: bandwidth,
        speedCapMbps: speed,
        maxConcurrentTasks: maxTasks,
      );

      if (!mounted) return;

      showMessage('Node registered successfully');
      Navigator.pop(context);
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  void showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Register Node Device'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            CustomTextField(
              controller: deviceNameController,
              label: 'Device Name',
              hint: 'Example: Oppo CPH2725',
              icon: Icons.phone_android,
            ),
            const SizedBox(height: 16),
            CustomTextField(
              controller: deviceIdController,
              label: 'Device ID',
              hint: 'Example: DEVICE-001',
              icon: Icons.qr_code_rounded,
            ),
            const SizedBox(height: 16),
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
              icon: Icons.data_usage_rounded,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            CustomTextField(
              controller: speedController,
              label: 'Speed Cap Mbps',
              hint: '20',
              icon: Icons.speed_rounded,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            CustomTextField(
              controller: maxTasksController,
              label: 'Max Concurrent Tasks',
              hint: '1',
              icon: Icons.task_alt_rounded,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 26),
            CustomButton(
              text: 'Register Node',
              isLoading: isLoading,
              onPressed: registerNode,
            ),
          ],
        ),
      ),
    );
  }
}