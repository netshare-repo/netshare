import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../models/credit_transaction_model.dart';
import '../models/wallet_model.dart';
import '../services/wallet_service.dart';
import '../widgets/dashboard_card.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  WalletModel? wallet;
  List<CreditTransactionModel> transactions = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    loadWallet();
  }

  Future<void> loadWallet() async {
    setState(() => isLoading = true);

    try {
      final walletData = await WalletService.getWallet();
      final txData = await WalletService.getTransactions();

      wallet = WalletModel.fromJson(walletData['wallet']);
      transactions = (txData['transactions'] as List)
          .map((e) => CreditTransactionModel.fromJson(e))
          .toList();
    } catch (_) {
      wallet = null;
      transactions = [];
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Color txColor(String type) {
    return type == 'credit' ? AppColors.successGreen : AppColors.dangerRed;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Wallet & Earnings'),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: loadWallet,
              child: ListView(
                padding: const EdgeInsets.all(18),
                children: [
                  DashboardCard(
                    title: 'Current Balance',
                    value: '${wallet?.balance ?? 0} Credits',
                    icon: Icons.account_balance_wallet,
                    color: AppColors.primaryBlue,
                  ),
                  const SizedBox(height: 12),
                  DashboardCard(
                    title: 'Earned Credits',
                    value: '${wallet?.earnedCredits ?? 0}',
                    icon: Icons.trending_up,
                    color: AppColors.successGreen,
                  ),
                  const SizedBox(height: 12),
                  DashboardCard(
                    title: 'Spent Credits',
                    value: '${wallet?.spentCredits ?? 0}',
                    icon: Icons.trending_down,
                    color: AppColors.dangerRed,
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Transaction History',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (transactions.isEmpty)
                    const Text(
                      'No transactions found.',
                      style: TextStyle(color: AppColors.textMuted),
                    )
                  else
                    ...transactions.map(
                      (tx) => Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.cardWhite,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: txColor(tx.type).withOpacity(0.12),
                              child: Icon(
                                tx.type == 'credit'
                                    ? Icons.add_rounded
                                    : Icons.remove_rounded,
                                color: txColor(tx.type),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    tx.description,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    tx.status,
                                    style: const TextStyle(
                                      color: AppColors.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              '${tx.type == 'credit' ? '+' : '-'}${tx.amount}',
                              style: TextStyle(
                                color: txColor(tx.type),
                                fontWeight: FontWeight.w900,
                                fontSize: 16,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}