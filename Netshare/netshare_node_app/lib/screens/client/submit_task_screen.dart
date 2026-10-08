import 'package:flutter/material.dart';
import '../../services/client_api.dart';
import '../../widgets/client_widgets.dart';

class SubmitTaskScreen extends StatefulWidget {
  final ClientApi api;
  const SubmitTaskScreen({super.key, required this.api});
  static String? validateUrl(String? value) {
    final uri = Uri.tryParse(value?.trim() ?? '');
    return uri == null ||
            !['http', 'https'].contains(uri.scheme) ||
            uri.host.isEmpty ||
            uri.userInfo.isNotEmpty
        ? 'Enter a valid HTTP/HTTPS URL without credentials.'
        : null;
  }

  static String? validateCount(String? value) {
    final count = int.tryParse(value ?? '');
    return count == null || count < 1 || count > 100
        ? 'Execution count must be an integer from 1 to 100.'
        : null;
  }

  @override
  State<SubmitTaskScreen> createState() => _SubmitTaskScreenState();
}

class _SubmitTaskScreenState extends State<SubmitTaskScreen> {
  final _form = GlobalKey<FormState>();
  final _url = TextEditingController();
  final _count = TextEditingController(text: '1');
  List<Map<String, dynamic>> _regions = [];
  String? _region;
  String _service = 'performance_testing';
  Map<String, dynamic>? _pricing;
  String? _error;
  bool _loading = true, _busy = false;
  int _revision = 0;
  @override
  void initState() {
    super.initState();
    loadRegions();
  }

  @override
  void dispose() {
    _url.dispose();
    _count.dispose();
    super.dispose();
  }

  Future<void> loadRegions() async {
    setState(() {
      _loading = true;
      _error = null;
      _pricing = null;
      _revision++;
    });
    try {
      final result = await widget.api.regions();
      if (!mounted) return;
      setState(() {
        _regions = records(result['regions']);
        _region = _regions.isEmpty ? null : _regions.first['region'];
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void invalidate() => setState(() {
    _pricing = null;
    _revision++;
  });
  Future<void> estimate() async {
    if (!_form.currentState!.validate() || _region == null) return;
    final revision = _revision;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await widget.api.estimate(
        _region!,
        int.parse(_count.text),
      );
      if (result['quote'] is! Map ||
          result['quote']['totalCredits'] is! num ||
          result['availability'] is! Map) {
        throw const ClientApiException(502, 'Invalid price estimate.');
      }
      if (mounted && revision == _revision) setState(() => _pricing = result);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> submit() async {
    if (!_form.currentState!.validate() ||
        _pricing == null ||
        _region == null ||
        _busy) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final response = await widget.api.submitTask({
        'targetUrl': _url.text.trim(),
        'serviceType': _service,
        'targetRegion': _region,
        'executionLimit': int.parse(_count.text),
      });
      if (!mounted) return;
      mobileMessage(
        context,
        'Task submitted: ${response['task']['_id']}. Final cost: ${response['task']['estimatedCost']} credits.',
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _error =
              '$error Check My Tasks before retrying if the response was interrupted.';
          _pricing = null;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Submit task')),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : Form(
            key: _form,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null)
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                TextFormField(
                  controller: _url,
                  decoration: const InputDecoration(labelText: 'Target URL'),
                  validator: SubmitTaskScreen.validateUrl,
                  onChanged: (_) => invalidate(),
                ),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  key: ValueKey('service:$_service'),
                  initialValue: _service,
                  decoration: const InputDecoration(labelText: 'Service type'),
                  items:
                      [
                            'ad_verification',
                            'accessibility_testing',
                            'localization_testing',
                            'performance_testing',
                          ]
                          .map(
                            (service) => DropdownMenuItem(
                              value: service,
                              child: Text(service),
                            ),
                          )
                          .toList(),
                  onChanged: _busy
                      ? null
                      : (value) {
                          _service = value!;
                          invalidate();
                        },
                ),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  key: ValueKey('region:$_region:${_regions.toString()}'),
                  initialValue: _region,
                  decoration: const InputDecoration(labelText: 'Region'),
                  items: _regions
                      .map(
                        (region) => DropdownMenuItem<String>(
                          value: region['region'],
                          child: Text(
                            '${region['region']} — ${region['available'] == true ? 'available' : 'unavailable'}',
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _busy
                      ? null
                      : (value) {
                          _region = value;
                          invalidate();
                        },
                  validator: (value) =>
                      value == null ? 'Select a region.' : null,
                ),
                TextButton(
                  onPressed: _busy ? null : loadRegions,
                  child: const Text('Refresh region availability'),
                ),
                TextFormField(
                  controller: _count,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Execution count',
                  ),
                  validator: SubmitTaskScreen.validateCount,
                  onChanged: (_) => invalidate(),
                ),
                FilledButton(
                  onPressed: _busy || _regions.isEmpty ? null : estimate,
                  child: Text(_busy ? 'Please wait…' : 'Get price estimate'),
                ),
                if (_pricing != null) ...[
                  infoTile(
                    'Estimated price',
                    '${_pricing!['quote']['totalCredits']} credits (${_pricing!['quote']['version']})',
                  ),
                  infoTile(
                    'Eligible nodes / slots',
                    '${_pricing!['availability']['eligibleNodes']} / ${_pricing!['availability']['availableSlots']}',
                  ),
                  if (_pricing!['availability']['available'] != true)
                    const Text(
                      'No eligible nodes now. Submission may queue until capacity returns.',
                    ),
                  infoTile(
                    'Platform pricing factors',
                    _pricing!['quote']['factors'],
                  ),
                  const Text(
                    'Estimate only. The backend recalculates the final cost at submission.',
                  ),
                ],
                FilledButton(
                  onPressed: _pricing == null || _busy ? null : submit,
                  child: const Text('Submit task'),
                ),
                TextButton(
                  onPressed: _busy
                      ? null
                      : () {
                          _url.clear();
                          _count.text = '1';
                          _service = 'performance_testing';
                          _region = _regions.isEmpty
                              ? null
                              : _regions.first['region'];
                          invalidate();
                        },
                  child: const Text('Reset'),
                ),
              ],
            ),
          ),
  );
}
