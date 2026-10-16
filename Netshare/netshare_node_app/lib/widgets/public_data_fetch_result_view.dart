import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/mobile_document_service.dart';
import 'client_widgets.dart';

const publicFetchMaxBytes = 16 * 1024;

class PublicFetchViewModel {
  final String state;
  final String? content;
  final String? error;
  final Map<String, dynamic> metadata;
  const PublicFetchViewModel(this.state, this.content, this.error, this.metadata);
}

PublicFetchViewModel preparePublicFetchView(Map<String, dynamic>? fetch,
    Map<dynamic, dynamic> resultData, bool success) {
  final metadata = <String, dynamic>{
    'HTTP status': fetch?['httpStatus'] ?? resultData['httpStatus'],
    'Content type': fetch?['contentType'] ?? resultData['contentType'],
    'Response size': fetch?['responseSizeBytes'] ?? resultData['responseSizeBytes'],
    'Final URL': fetch?['finalUrl'] ?? resultData['finalUrl'],
    'Executed': fetch?['executedAt'],
    'Source node': fetch?['sourceNodeId'],
    'Time to first byte': fetch?['ttfbMs'] ?? resultData['ttfbMs'],
    'Total response time': fetch?['totalTimeMs'] ?? resultData['totalTimeMs'],
    'Target region': resultData['targetRegion'],
    'Node region': resultData['nodeRegion'],
  };
  final error = resultData['error']?.toString();
  final content = fetch?['content'];
  if (!success || fetch == null || content == null) {
    return PublicFetchViewModel(error != null ? 'failed' : fetch == null ? 'missing' : 'empty', null,
        error ?? 'No response content was recorded.', metadata);
  }
  if (content is! String) {
    return PublicFetchViewModel('invalid', null, 'Stored response content is invalid.', metadata);
  }
  final bytes = utf8.encode(content);
  final size = fetch['responseSizeBytes'];
  if (bytes.length > publicFetchMaxBytes || size is! int || size != bytes.length) {
    return PublicFetchViewModel('oversized', null, 'Stored response exceeds the 16 KiB limit or has an invalid size.', metadata);
  }
  final rawContentType = (fetch['contentType'] ?? '').toString().trim();
  final contentType = rawContentType.split(';').first.trim().toLowerCase();
  final params = rawContentType.contains(';') ? rawContentType.split(';').skip(1).join(';').trim() : '';
  final validEncoding = !rawContentType.contains(';') || RegExp(r'^charset\s*=\s*utf-8$', caseSensitive: false).hasMatch(params);
  final status = fetch['httpStatus'];
  if (!{'application/json', 'text/html', 'text/plain'}.contains(contentType) ||
      !validEncoding || status is! int || status < 200 || status >= 300) {
    return PublicFetchViewModel('invalid', null, 'Stored response type or HTTP status is invalid.', metadata);
  }
  var safeText = content;
  if (contentType == 'application/json') {
    try {
      safeText = const JsonEncoder.withIndent('  ').convert(jsonDecode(content));
    } catch (_) {
      return PublicFetchViewModel('invalid', null, 'The stored JSON response cannot be parsed.', metadata);
    }
  }
  return PublicFetchViewModel(bytes.isEmpty ? 'empty' : 'ready', safeText,
      bytes.isEmpty ? 'The node returned an empty response.' : null, metadata);
}

class PublicDataFetchResultView extends StatelessWidget {
  final String taskId;
  final Map<String, dynamic>? fetch;
  final Map<String, dynamic> result;
  final Map<dynamic, dynamic> resultData;
  const PublicDataFetchResultView({super.key, required this.taskId, required this.fetch,
    required this.result, required this.resultData});

  @override
  Widget build(BuildContext context) {
    final view = preparePublicFetchView(fetch, resultData, result['success'] == true);
    final metadata = {...view.metadata,
      'Target region': result['targetRegion'] ?? view.metadata['Target region'],
      'Node region': resultData['nodeRegion'] ?? view.metadata['Node region'],
      'Measured latency': result['latencyMs'] == null ? null : '${result['latencyMs']} ms',
      'Bandwidth': result['bandwidthUsedMB'] == null ? null : '${result['bandwidthUsedMB']} MB',
      'Packet loss': result['packetLoss'] == null ? null : '${result['packetLoss']}%',
    };
    final status = view.state;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Public response', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          const Text('STORED NODE RESPONSE · SOURCE TEXT ONLY'),
          const SizedBox(height: 14),
          Wrap(spacing: 10, runSpacing: 10, children: metadata.entries.map((entry) => SizedBox(
            width: 190,
            child: infoTile(entry.key, entry.value == null ? 'Not measured' : entry.value.toString()),
          )).toList()),
          const SizedBox(height: 12),
          if (status == 'ready') ...[
            Wrap(spacing: 8, children: [
              OutlinedButton.icon(onPressed: () async {
                await Clipboard.setData(ClipboardData(text: view.content!));
                if (context.mounted) mobileMessage(context, 'Response copied.');
              }, icon: const Icon(Icons.copy), label: const Text('Copy content')),
              OutlinedButton.icon(onPressed: () async {
                final type = (fetch?['contentType'] ?? '').toString().split(';').first.toLowerCase();
                final extension = type == 'application/json' ? 'json' : type == 'text/html' ? 'html.txt' : 'txt';
                try {
                  final saved = await MobileDocumentService.saveText(
                    'netshare-task-$taskId.$extension', view.content!, mimeType: 'text/plain');
                  if (context.mounted && saved) mobileMessage(context, 'Response saved as plain text.');
                } catch (_) {
                  if (context.mounted) mobileMessage(context, 'Saving is unavailable on this platform. Copy the response instead.');
                }
              }, icon: const Icon(Icons.download), label: const Text('Download')),
            ]),
            const SizedBox(height: 10),
            Container(width: double.infinity, constraints: const BoxConstraints(maxHeight: 520),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(10)),
              child: SingleChildScrollView(child: SelectableText(view.content!,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 12))),
            ),
          ] else ...[
            Text(status == 'failed' ? 'Fetch failed' : status == 'oversized' ? 'Response rejected' :
              status == 'empty' ? 'Empty response' : status == 'missing' ? 'No stored response' : 'Response unavailable',
              style: Theme.of(context).textTheme.titleMedium),
            Text(view.error ?? 'The node did not return a readable response.'),
          ],
        ]),
      ),
    );
  }
}
