import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../models/marketplace_order_model.dart';
import '../services/marketplace_service.dart';

class MyOrdersScreen extends StatefulWidget {
  const MyOrdersScreen({super.key});

  @override
  State<MyOrdersScreen> createState() => _MyOrdersScreenState();
}

class _MyOrdersScreenState extends State<MyOrdersScreen> {
  List<MarketplaceOrderModel> orders = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    loadOrders();
  }

  Future<void> loadOrders() async {
    setState(() => isLoading = true);

    try {
      final data = await MarketplaceService.getMyOrders();
      orders = (data['orders'] as List)
          .map((item) => MarketplaceOrderModel.fromJson(item))
          .toList();
    } catch (e) {
      orders = [];
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Color statusColor(String status) {
    if (status == 'fulfilled') return AppColors.successGreen;
    if (status == 'cancelled') return AppColors.dangerRed;
    if (status == 'rejected') return AppColors.dangerRed;
    return Colors.orange;
  }

  void showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Widget orderCard(MarketplaceOrderModel order) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardWhite,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.primaryBlue.withValues(alpha: 0.1),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  color: AppColors.primaryBlue,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  order.productName,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textDark,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: statusColor(order.status).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  order.status.toUpperCase(),
                  style: TextStyle(
                    color: statusColor(order.status),
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              const Icon(
                Icons.monetization_on_rounded,
                color: AppColors.successGreen,
                size: 20,
              ),
              const SizedBox(width: 6),
              Text(
                '${order.creditsSpent} Credits Spent',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: AppColors.successGreen,
                ),
              ),
            ],
          ),
          if (order.fulfilmentNote.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Admin Note:',
              style: TextStyle(
                color: AppColors.textMuted.withValues(alpha: 0.9),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              order.fulfilmentNote,
              style: const TextStyle(
                color: AppColors.textDark,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(
        title: const Text(
          'My Orders',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            onPressed: loadOrders,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: loadOrders,
              child: orders.isEmpty
                  ? ListView(
                      padding: const EdgeInsets.all(22),
                      children: const [
                        SizedBox(height: 180),
                        Icon(
                          Icons.receipt_long_rounded,
                          size: 70,
                          color: AppColors.textMuted,
                        ),
                        SizedBox(height: 18),
                        Text(
                          'No marketplace orders found.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(18),
                      itemCount: orders.length,
                      itemBuilder: (context, index) {
                        return orderCard(orders[index]);
                      },
                    ),
            ),
    );
  }
}
