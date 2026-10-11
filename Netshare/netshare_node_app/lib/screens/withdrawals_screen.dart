import 'dart:math';
import 'package:flutter/material.dart';
import '../services/client_api.dart';
import '../widgets/client_widgets.dart';

class WithdrawalsScreen extends StatefulWidget {
  final ClientApi api;
  const WithdrawalsScreen({super.key, required this.api});
  @override
  State<WithdrawalsScreen> createState() => _WithdrawalsScreenState();
}

class _WithdrawalsScreenState extends State<WithdrawalsScreen> {
  late Future<List<Map<String, dynamic>>> _data;
  final _form = GlobalKey<FormState>();
  final _amount = TextEditingController(), _account = TextEditingController();
  String _method = 'bank_transfer';
  String? _error;
  bool _busy = false;
  // Retained on ambiguous failures: retrying cannot reserve funds twice.
  String _requestId = _newKey();
  static String _newKey() => List.generate(
    24,
    (_) => Random.secure().nextInt(256).toRadixString(16).padLeft(2, '0'),
  ).join();
  @override
  void initState() {
    super.initState();
    _data = load();
  }

  Future<List<Map<String, dynamic>>> load() =>
      Future.wait([widget.api.wallet(), widget.api.withdrawals()]);
  void refresh() => setState(() => _data = load());
  @override
  void dispose() {
    _amount.dispose();
    _account.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.submitWithdrawal({
        'amount': int.parse(_amount.text),
        'method': _method,
        'accountDetails': _account.text.trim(),
        'requestId': _requestId,
      });
      if (!mounted) return;
      _requestId = _newKey();
      _amount.clear();
      _account.clear();
      refresh();
      mobileMessage(
        context,
        'Withdrawal submitted. Earned credits are reserved pending admin review.',
      );
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Withdraw earnings'),
      actions: [
        IconButton(
          onPressed: _busy ? null : refresh,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: !['node_participant', 'both'].contains(widget.api.role)
        ? const Center(child: Text('Node Participant role required.'))
        : AsyncPanel(
            future: _data,
            retry: refresh,
            builder: (data) => ListView(
              padding: const EdgeInsets.all(16),
              children: [
                infoTile(
                  'Available earned credits',
                  data[0]['eligibleWithdrawalBalance'],
                ),
                const Text(
                  'Top-up credits cannot be withdrawn. Requests are manually verified.',
                ),
                Form(
                  key: _form,
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _amount,
                        enabled: !_busy,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Amount'),
                        validator: (value) {
                          final amount = int.tryParse(value ?? '');
                          if (amount == null ||
                              amount < 1 ||
                              amount > 1000000) {
                            return 'Enter a whole amount from 1 to 1000000.';
                          }
                          if (amount >
                              (data[0]['eligibleWithdrawalBalance'] as num? ??
                                  0)) {
                            return 'Insufficient eligible earnings.';
                          }
                          return null;
                        },
                      ),
                      DropdownButtonFormField<String>(
                        initialValue: _method,
                        decoration: const InputDecoration(
                          labelText: 'Withdrawal channel',
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: 'bank_transfer',
                            child: Text('Bank transfer'),
                          ),
                          DropdownMenuItem(
                            value: 'easypaisa',
                            child: Text('Easypaisa'),
                          ),
                          DropdownMenuItem(
                            value: 'jazzcash',
                            child: Text('JazzCash'),
                          ),
                        ],
                        onChanged: _busy
                            ? null
                            : (value) => setState(() => _method = value!),
                      ),
                      TextFormField(
                        controller: _account,
                        enabled: !_busy,
                        maxLength: 120,
                        decoration: const InputDecoration(
                          labelText: 'Account holder and account number',
                        ),
                        validator: (value) =>
                            (value ?? '').trim().length < 5 ||
                                RegExp(r'[\r\n<>]').hasMatch(value ?? '')
                            ? 'Enter valid account details (5–120 characters).'
                            : null,
                      ),
                      if (_error != null)
                        Text(
                          _error!,
                          style: const TextStyle(color: Colors.red),
                        ),
                      FilledButton(
                        onPressed: _busy ? null : submit,
                        child: Text(
                          _busy ? 'Submitting…' : 'Submit withdrawal',
                        ),
                      ),
                    ],
                  ),
                ),
                const Text(
                  'Withdrawal history',
                  style: TextStyle(fontSize: 20),
                ),
                if (records(data[1]['requests']).isEmpty)
                  const Text('No withdrawal requests.'),
                ...records(data[1]['requests']).map(
                  (item) => ListTile(
                    title: Text(
                      '${item['amount']} credits — ${item['status']}',
                    ),
                    subtitle: SelectableText(
                      '${item['method']}\nID: ${item['_id']}\n${item['adminNote'] ?? ''}',
                    ),
                  ),
                ),
              ],
            ),
          ),
  );
}
