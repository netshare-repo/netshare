import 'package:flutter/material.dart';
import '../../services/client_api.dart';
import '../../services/mobile_document_service.dart';
import '../../widgets/client_widgets.dart';

class ClientWalletScreen extends StatefulWidget {
  final ClientApi api;
  const ClientWalletScreen({super.key, required this.api});
  @override
  State<ClientWalletScreen> createState() => _ClientWalletScreenState();
}

class _ClientWalletScreenState extends State<ClientWalletScreen> {
  late Future<List<Map<String, dynamic>>> _data;
  @override
  void initState() {
    super.initState();
    _data = load();
  }

  Future<List<Map<String, dynamic>>> load() => Future.wait([
    widget.api.wallet(),
    widget.api.history(),
    widget.api.topups(),
  ]);
  void refresh() => setState(() {
    _data = load();
  });
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Client wallet'),
      actions: [
        IconButton(onPressed: refresh, icon: const Icon(Icons.refresh)),
      ],
    ),
    body: AsyncPanel(
      future: _data,
      retry: refresh,
      builder: (data) {
        final history = records(data[1]['transactions']),
            topups = records(data[2]['requests']);
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            infoTile('Balance', '${data[0]['wallet']['balance']} credits'),
            FilledButton(
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => TopupScreen(api: widget.api),
                  ),
                );
                if (mounted) refresh();
              },
              child: const Text('Submit top-up'),
            ),
            const Text('Top-up requests', style: TextStyle(fontSize: 20)),
            if (topups.isEmpty)
              const ListTile(title: Text('No top-up requests.')),
            ...topups.map(
              (item) => ListTile(
                title: Text('${item['amount']} credits — ${item['status']}'),
                subtitle: SelectableText(
                  'ID: ${item['_id']}\nReference: ${item['referenceNumber']}\n${item['adminNote'] ?? ''}',
                ),
              ),
            ),
            const Text('Transaction history', style: TextStyle(fontSize: 20)),
            if (history.isEmpty)
              const ListTile(title: Text('No transactions.')),
            ...history.map(
              (item) => ListTile(
                title: Text('${item['type']} ${item['amount']} credits'),
                subtitle: Text(
                  '${item['description']}\n${item['status']} · ${item['createdAt']}',
                ),
              ),
            ),
          ],
        );
      },
    ),
  );
}

class TopupScreen extends StatefulWidget {
  final ClientApi api;
  const TopupScreen({super.key, required this.api});
  @override
  State<TopupScreen> createState() => _TopupScreenState();
}

class _TopupScreenState extends State<TopupScreen> {
  final _form = GlobalKey<FormState>();
  final _amount = TextEditingController(), _reference = TextEditingController();
  String _method = 'bank_transfer';
  Map<String, dynamic>? _proof;
  String? _error;
  bool _busy = false;
  @override
  void dispose() {
    _amount.dispose();
    _reference.dispose();
    super.dispose();
  }

  Future<void> pick() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final proof = await MobileDocumentService.pickProof();
      if (mounted && proof != null) setState(() => _proof = proof);
    } catch (error) {
      if (mounted) setState(() => _error = 'Could not select proof: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> submit() async {
    if (!_form.currentState!.validate()) return;
    if (_proof == null) {
      setState(() => _error = 'Select a payment proof before submitting.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.submitTopup({
        'amount': int.parse(_amount.text),
        'paymentMethod': _method,
        'referenceNumber': _reference.text.trim(),
        'proofMime': _proof!['mime'],
        'proofBase64': _proof!['base64'],
      });
      if (!mounted) return;
      mobileMessage(
        context,
        'Top-up pending manual verification. Wallet is not credited yet.',
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(
          () => _error =
              '$error Check top-up history before retrying; do not change the payment reference.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Submit top-up')),
    body: Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Manual verification only. Use your actual payment reference and proof. Approval is required before credits are added.',
          ),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: Colors.red)),
          TextFormField(
            controller: _amount,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Amount (credits)'),
            validator: (value) {
              final amount = int.tryParse(value ?? '');
              return amount == null || amount < 1 || amount > 1000000
                  ? 'Enter an integer amount from 1 to 1000000.'
                  : null;
            },
          ),
          DropdownButtonFormField<String>(
            initialValue: _method,
            decoration: const InputDecoration(labelText: 'Payment method'),
            items: ['bank_transfer', 'easypaisa', 'jazzcash']
                .map(
                  (method) =>
                      DropdownMenuItem(value: method, child: Text(method)),
                )
                .toList(),
            onChanged: _busy
                ? null
                : (value) => setState(() => _method = value!),
          ),
          TextFormField(
            controller: _reference,
            decoration: const InputDecoration(labelText: 'Payment reference'),
            validator: (value) =>
                RegExp(
                  r'^[A-Za-z0-9][A-Za-z0-9_/\-]{5,63}$',
                ).hasMatch(value?.trim() ?? '')
                ? null
                : 'Enter a valid 6–64 character payment reference.',
          ),
          OutlinedButton(
            onPressed: _busy ? null : pick,
            child: Text(
              _proof == null
                  ? 'Choose PNG / JPEG / PDF proof (max 2 MB)'
                  : 'Proof selected (${_proof!['mime']}) — replace',
            ),
          ),
          FilledButton(
            onPressed: _busy ? null : submit,
            child: Text(_busy ? 'Please wait…' : 'Submit for verification'),
          ),
        ],
      ),
    ),
  );
}
