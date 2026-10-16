import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../services/client_api.dart';
import '../services/mobile_document_service.dart';
import 'client_widgets.dart';

const browserInspectMaxTextBytes = 32 * 1024;
const browserInspectMaxScreenshotBytes = 2 * 1024 * 1024;

class BrowserPageInspectViewModel {
  final String state;
  final String? error;
  final Map<String, dynamic> data;
  final Map<String, dynamic>? screenshot;
  const BrowserPageInspectViewModel(
    this.state,
    this.error,
    this.data,
    this.screenshot,
  );
}

BrowserPageInspectViewModel prepareBrowserPageInspectView(
  Map<String, dynamic>? data,
  bool success,
) {
  if (data == null) {
    return BrowserPageInspectViewModel(
      success ? 'missing' : 'failed',
      'No browser result was recorded.',
      const {},
      null,
    );
  }
  if (!success) {
    return BrowserPageInspectViewModel(
      'failed',
      data['error']?.toString() ?? 'Page inspection failed.',
      data,
      null,
    );
  }
  final uri = Uri.tryParse(data['finalUrl']?.toString() ?? '');
  final text = data['textContent'];
  final viewport = data['viewport'];
  final byteLength = text is String ? utf8.encode(text).length : -1;
  final valid =
      data['contractVersion'] == 1 &&
      uri != null &&
      uri.scheme == 'https' &&
      uri.userInfo.isEmpty &&
      (!uri.hasPort || uri.port == 443) &&
      data['httpStatus'] is int &&
      data['httpStatus'] >= 200 &&
      data['httpStatus'] < 300 &&
      data['pageTitle'] is String &&
      (data['pageTitle'] as String).length <= 512 &&
      text is String &&
      byteLength <= browserInspectMaxTextBytes &&
      data['textSizeBytes'] == byteLength &&
      viewport is Map &&
      viewport['width'] is int &&
      viewport['width'] >= 320 &&
      viewport['width'] <= 1920 &&
      viewport['height'] is int &&
      viewport['height'] >= 320 &&
      viewport['height'] <= 2160 &&
      [1, 1.5, 2].contains(viewport['deviceScaleFactor']) &&
      _metric(data['pageLoadTimeMs'], 20000) &&
      _metric(data['ttfbMs'], 30000) &&
      _metric(data['totalTimeMs'], 30000) &&
      _metric(data['resourceCount'], 64) &&
      _metric(
        data['blockedResourceCount'],
        data['resourceCount'] is int ? data['resourceCount'] as int : -1,
      ) &&
      _metric(data['transferredBytes'], 8 * 1024 * 1024);
  if (!valid) {
    return BrowserPageInspectViewModel(
      'invalid',
      'Stored browser result is invalid or outside its v1 limits.',
      data,
      null,
    );
  }
  final rawScreenshot = data['screenshotArtifact'];
  final screenshot = rawScreenshot is Map
      ? Map<String, dynamic>.from(rawScreenshot)
      : null;
  final validScreenshot =
      screenshot != null &&
      RegExp(
        r'^[a-f0-9]{32}$',
      ).hasMatch(screenshot['artifactId']?.toString() ?? '') &&
      screenshot['contentType'] == 'image/png' &&
      screenshot['sizeBytes'] is int &&
      screenshot['sizeBytes'] > 0 &&
      screenshot['sizeBytes'] <= browserInspectMaxScreenshotBytes &&
      RegExp(
        r'^[a-f0-9]{64}$',
      ).hasMatch(screenshot['sha256']?.toString() ?? '');
  return BrowserPageInspectViewModel(
    'ready',
    null,
    data,
    validScreenshot ? screenshot : null,
  );
}

bool _metric(dynamic value, int maximum) =>
    value is int && value >= 0 && value <= maximum;

class BrowserPageInspectResultView extends StatelessWidget {
  final ClientApi api;
  final String taskId;
  final Map<String, dynamic>? browser;
  final Map<String, dynamic> result;
  final Map<dynamic, dynamic> resultData;
  final Map<String, dynamic> task;
  const BrowserPageInspectResultView({
    super.key,
    required this.api,
    required this.taskId,
    required this.browser,
    required this.result,
    required this.resultData,
    required this.task,
  });

  @override
  Widget build(BuildContext context) {
    final view = prepareBrowserPageInspectView(
      browser,
      result['success'] == true,
    );
    if (view.state != 'ready') {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Page inspection',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const Text('BROWSER PAGE INSPECT · READ ONLY'),
              const SizedBox(height: 12),
              Text(
                view.state == 'failed'
                    ? 'Page inspection failed'
                    : view.state == 'missing'
                    ? 'No stored inspection'
                    : 'Result unavailable',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              Text(view.error ?? 'The stored result could not be displayed.'),
            ],
          ),
        ),
      );
    }
    final data = view.data;
    final metrics = <String, dynamic>{
      'HTTP status': data['httpStatus'],
      'Page load': _ms(data['pageLoadTimeMs']),
      'Time to first byte': _ms(data['ttfbMs']),
      'Total execution': _ms(data['totalTimeMs']),
      'Resources loaded': data['resourceCount'],
      'Resources blocked': data['blockedResourceCount'],
      'Transferred': _bytes(data['transferredBytes']),
      'Rendered text': _bytes(data['textSizeBytes']),
      'Viewport':
          '${data['viewport']['width']} × ${data['viewport']['height']} · ${data['viewport']['deviceScaleFactor']}×',
      'Target region': task['targetRegion'],
      'Node region':
          resultData['nodeRegion'] ?? task['assignedNodeId']?['region'],
      'Source node': data['sourceNodeId'],
      'Executed': data['executedAt'],
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Page inspection',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const Text('BROWSER PAGE INSPECT · READ ONLY'),
            const SizedBox(height: 14),
            Text(
              data['pageTitle'].toString(),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            infoTile('Final URL', data['finalUrl']),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: metrics.entries
                  .map(
                    (entry) => SizedBox(
                      width: 170,
                      child: infoTile(
                        entry.key,
                        entry.value?.toString() ?? 'Not measured',
                      ),
                    ),
                  )
                  .toList(),
            ),
            if (resultData['error'] != null || data['error'] != null)
              infoTile('Execution error', resultData['error'] ?? data['error']),
            const SizedBox(height: 14),
            Text(
              'Rendered page text · plain text only',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              constraints: const BoxConstraints(maxHeight: 420),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(10),
              ),
              child: SingleChildScrollView(
                child: SelectableText(
                  data['textContent'].toString(),
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('Screenshot', style: Theme.of(context).textTheme.titleMedium),
            if (view.screenshot == null)
              const Text('No valid screenshot artifact was recorded.')
            else
              _PrivateBrowserScreenshot(
                api: api,
                taskId: taskId,
                reference: view.screenshot!,
              ),
          ],
        ),
      ),
    );
  }
}

String _ms(dynamic value) => value is int ? '$value ms' : 'Not measured';
String _bytes(dynamic value) => value is int ? '$value bytes' : 'Not measured';

class _PrivateBrowserScreenshot extends StatefulWidget {
  final ClientApi api;
  final String taskId;
  final Map<String, dynamic> reference;
  const _PrivateBrowserScreenshot({
    required this.api,
    required this.taskId,
    required this.reference,
  });
  @override
  State<_PrivateBrowserScreenshot> createState() =>
      _PrivateBrowserScreenshotState();
}

class _PrivateBrowserScreenshotState extends State<_PrivateBrowserScreenshot> {
  late Future<Uint8List> _bytes;
  @override
  void initState() {
    super.initState();
    _bytes = _load();
  }

  @override
  void didUpdateWidget(covariant _PrivateBrowserScreenshot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.taskId != widget.taskId ||
        oldWidget.reference['artifactId'] != widget.reference['artifactId']) {
      _bytes = _load();
    }
  }

  Future<Uint8List> _load() async {
    final response = await widget.api.browserScreenshot(
      widget.taskId,
      widget.reference['artifactId'] as String,
    );
    if (response.headers['content-type']?.split(';').first.toLowerCase() !=
            'image/png' ||
        response.bodyBytes.length != widget.reference['sizeBytes'] ||
        !_hasPngSignature(response.bodyBytes)) {
      throw const FormatException(
        'Screenshot metadata or PNG signature is invalid.',
      );
    }
    return response.bodyBytes;
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Uint8List>(
    future: _bytes,
    builder: (context, snapshot) {
      if (snapshot.hasError) {
        return const Text(
          'Private screenshot is unavailable for this account.',
        );
      }
      if (!snapshot.hasData) {
        return const Padding(
          padding: EdgeInsets.all(12),
          child: CircularProgressIndicator(),
        );
      }
      final bytes = snapshot.data!;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.memory(
              bytes,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) =>
                  const Text('Screenshot preview could not be decoded.'),
            ),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton.icon(
              onPressed: () async {
                try {
                  final saved = await MobileDocumentService.savePng(
                    'netshare-page-${widget.taskId}.png',
                    bytes,
                  );
                  if (context.mounted && saved) {
                    mobileMessage(context, 'Screenshot saved.');
                  }
                } catch (_) {
                  if (context.mounted) {
                    mobileMessage(
                      context,
                      'Screenshot download is unavailable on this device.',
                    );
                  }
                }
              },
              icon: const Icon(Icons.download),
              label: const Text('Download PNG'),
            ),
          ),
        ],
      );
    },
  );
}

bool _hasPngSignature(Uint8List bytes) =>
    bytes.length >= 8 &&
    bytes[0] == 0x89 &&
    bytes[1] == 0x50 &&
    bytes[2] == 0x4e &&
    bytes[3] == 0x47 &&
    bytes[4] == 0x0d &&
    bytes[5] == 0x0a &&
    bytes[6] == 0x1a &&
    bytes[7] == 0x0a;
