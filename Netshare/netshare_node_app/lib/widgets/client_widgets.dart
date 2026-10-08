import 'package:flutter/material.dart';

class AsyncPanel<T> extends StatelessWidget {
  final Future<T> future;
  final VoidCallback retry;
  final Widget Function(T) builder;
  const AsyncPanel({
    super.key,
    required this.future,
    required this.retry,
    required this.builder,
  });
  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
    future: future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(snapshot.error.toString(), textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton(onPressed: retry, child: const Text('Retry')),
              ],
            ),
          ),
        );
      }
      return builder(snapshot.data as T);
    },
  );
}

List<Map<String, dynamic>> records(dynamic value) => (value as List? ?? [])
    .map((item) => Map<String, dynamic>.from(item as Map))
    .toList();
void mobileMessage(BuildContext context, Object message) =>
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message.toString())));
Widget infoTile(String title, Object? value) => ListTile(
  title: Text(title),
  subtitle: SelectableText('${value ?? 'Not available'}'),
);
