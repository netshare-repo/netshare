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
  bool _publicFetchEnabled = false;
  bool _browserInspectEnabled = false;
  String _viewport = '1365x768';
  int _pageLoadTimeoutMs = 15000;
  bool _captureScreenshot = true;
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
      final results = await Future.wait<Map<String, dynamic>>([
        widget.api.regions(),
        widget.api.capabilities().catchError((_) => <String, dynamic>{}),
      ]);
      final result = results[0];
      if (!mounted) return;
      setState(() {
        _regions = records(result['regions']);
        _region = _regions.isEmpty ? null : _regions.first['region'];
        _publicFetchEnabled = results[1]['publicDataFetchEnabled'] == true;
        _browserInspectEnabled =
            results[1]['browserPageInspectEnabled'] == true;
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
    if (_service == 'PUBLIC_DATA_FETCH' && !_publicFetchEnabled) return;
    if (_service == 'BROWSER_PAGE_INSPECT' && !_browserInspectEnabled) return;
    final revision = _revision;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await widget.api.estimate(
        _region!,
        ['PUBLIC_DATA_FETCH', 'BROWSER_PAGE_INSPECT'].contains(_service)
            ? 1
            : int.parse(_count.text),
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
    if (_service == 'PUBLIC_DATA_FETCH') {
      final uri = Uri.tryParse(_url.text.trim());
      if (!_publicFetchEnabled ||
          uri == null ||
          uri.scheme != 'https' ||
          uri.userInfo.isNotEmpty ||
          (uri.hasPort && uri.port != 443)) {
        setState(
          () => _error =
              'Public Data Fetch requires an enabled capability and a public HTTPS URL on port 443.',
        );
        return;
      }
    }
    if (_service == 'BROWSER_PAGE_INSPECT') {
      final uri = Uri.tryParse(_url.text.trim());
      if (!_browserInspectEnabled ||
          uri == null ||
          uri.scheme != 'https' ||
          uri.userInfo.isNotEmpty ||
          (uri.hasPort && uri.port != 443)) {
        setState(
          () => _error =
              'Browser Page Inspect is coming soon and requires an enabled capability and a public HTTPS URL on port 443.',
        );
        return;
      }
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final response = await widget.api.submitTask({
        'targetUrl': _url.text.trim(),
        'method': 'GET',
        'serviceType': _service,
        'targetRegion': _region,
        'executionLimit':
            ['PUBLIC_DATA_FETCH', 'BROWSER_PAGE_INSPECT'].contains(_service)
            ? 1
            : int.parse(_count.text),
        if (_service == 'BROWSER_PAGE_INSPECT')
          'browserPageInspect': {
            'contractVersion': 1,
            'viewport': {
              'width': int.parse(_viewport.split('x')[0]),
              'height': int.parse(_viewport.split('x')[1]),
              'deviceScaleFactor': 1,
            },
            'pageLoadTimeoutMs': _pageLoadTimeoutMs,
            'maxTextBytes': 32768,
            'captureScreenshot': _captureScreenshot,
          },
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
                  decoration: InputDecoration(
                    labelText: _service == 'BROWSER_PAGE_INSPECT'
                        ? 'Public HTTPS URL'
                        : 'Target URL',
                  ),
                  validator: SubmitTaskScreen.validateUrl,
                  onChanged: (_) => invalidate(),
                ),
                const Text('HTTP method: GET only'),
                const Text(
                  'Localization observes response language signals. Ad verification needs an expected ad identifier and is unavailable.',
                ),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  key: ValueKey('service:$_service'),
                  initialValue: _service,
                  decoration: const InputDecoration(labelText: 'Service type'),
                  items:
                      [
                            'accessibility_testing',
                            'localization_testing',
                            'performance_testing',
                            'PUBLIC_DATA_FETCH',
                            'BROWSER_PAGE_INSPECT',
                          ]
                          .map(
                            (service) => DropdownMenuItem(
                              enabled: service == 'PUBLIC_DATA_FETCH'
                                  ? _publicFetchEnabled
                                  : service == 'BROWSER_PAGE_INSPECT'
                                  ? _browserInspectEnabled
                                  : true,
                              value: service,
                              child: Text(
                                service == 'PUBLIC_DATA_FETCH' &&
                                        !_publicFetchEnabled
                                    ? 'Public Data Fetch (currently unavailable)'
                                    : service == 'BROWSER_PAGE_INSPECT' &&
                                          !_browserInspectEnabled
                                    ? 'Browser Page Inspect (Coming Soon)'
                                    : service,
                              ),
                            ),
                          )
                          .toList(),
                  onChanged: _busy
                      ? null
                      : (value) {
                          _service = value!;
                          if (_service == 'PUBLIC_DATA_FETCH') {
                            _count.text = '1';
                          }
                          if (_service == 'BROWSER_PAGE_INSPECT') {
                            _count.text = '1';
                          }
                          invalidate();
                        },
                ),
                if (!_publicFetchEnabled)
                  const Text('Public Data Fetch is currently unavailable.'),
                if (!_browserInspectEnabled) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'Browser Page Inspect · Coming Soon',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const Text(
                    'Secure browser rendering is not enabled by the backend. These settings cannot be submitted yet.',
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: _viewport,
                    decoration: const InputDecoration(labelText: 'Viewport'),
                    items: const ['1280x720', '1365x768', '1920x1080']
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text(value),
                          ),
                        )
                        .toList(),
                    onChanged: null,
                  ),
                  DropdownButtonFormField<int>(
                    initialValue: _pageLoadTimeoutMs,
                    decoration: const InputDecoration(
                      labelText: 'Page load timeout',
                    ),
                    items: const [5000, 10000, 15000, 20000]
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text('${value ~/ 1000} seconds'),
                          ),
                        )
                        .toList(),
                    onChanged: null,
                  ),
                  CheckboxListTile(
                    value: _captureScreenshot,
                    onChanged: null,
                    title: const Text('Include screenshot artifact'),
                  ),
                ],
                if (_service == 'BROWSER_PAGE_INSPECT' &&
                    _browserInspectEnabled) ...[
                  DropdownButtonFormField<String>(
                    initialValue: _viewport,
                    decoration: const InputDecoration(labelText: 'Viewport'),
                    items: const ['1280x720', '1365x768', '1920x1080']
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text(value),
                          ),
                        )
                        .toList(),
                    onChanged: _busy
                        ? null
                        : (value) {
                            if (value != null) {
                              setState(() => _viewport = value);
                            }
                          },
                  ),
                  DropdownButtonFormField<int>(
                    initialValue: _pageLoadTimeoutMs,
                    decoration: const InputDecoration(
                      labelText: 'Page load timeout',
                    ),
                    items: const [5000, 10000, 15000, 20000]
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text('${value ~/ 1000} seconds'),
                          ),
                        )
                        .toList(),
                    onChanged: _busy
                        ? null
                        : (value) {
                            if (value != null) {
                              setState(() => _pageLoadTimeoutMs = value);
                            }
                          },
                  ),
                  CheckboxListTile(
                    value: _captureScreenshot,
                    onChanged: _busy
                        ? null
                        : (value) => setState(
                            () => _captureScreenshot = value ?? false,
                          ),
                    title: const Text('Include screenshot artifact'),
                  ),
                ],
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
                  enabled:
                      !_busy &&
                      ![
                        'PUBLIC_DATA_FETCH',
                        'BROWSER_PAGE_INSPECT',
                      ].contains(_service),
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
