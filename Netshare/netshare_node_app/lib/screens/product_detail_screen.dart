import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../models/marketplace_product_model.dart';
import '../services/marketplace_service.dart';
import '../widgets/custom_button.dart';
import 'my_orders_screen.dart';

class ProductDetailScreen extends StatefulWidget {
  final MarketplaceProductModel product;

  const ProductDetailScreen({
    super.key,
    required this.product,
  });

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  bool isLoading = false;

  Future<void> buyProduct() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Confirm Purchase'),
          content: Text(
            'Do you want to buy "${widget.product.name}" for ${widget.product.requiredCredits} credits?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Buy'),
            ),
          ],
        );
      },
    );

    if (confirm != true) return;

    setState(() => isLoading = true);

    try {
      await MarketplaceService.createOrder(widget.product.id);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Order created successfully'),
        ),
      );

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const MyOrdersScreen()),
      );
    } catch (e) {
      showMessage(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  void showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  String cleanCategory(String category) {
    return category.replaceAll('_', ' ').toUpperCase();
  }

  Widget infoBox(String title, String value, IconData icon, Color color) {
    return Container(
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
            backgroundColor: color.withValues(alpha: 0.12),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textDark,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(
        title: const Text('Product Details'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.primaryBlue,
                borderRadius: BorderRadius.circular(26),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.workspace_premium_rounded,
                    color: Colors.white,
                    size: 54,
                  ),
                  const SizedBox(height: 18),
                  Text(
                    product.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 25,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    product.description,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 14,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            infoBox(
              'Required Credits',
              '${product.requiredCredits} Credits',
              Icons.monetization_on_rounded,
              AppColors.successGreen,
            ),
            infoBox(
              'Category',
              cleanCategory(product.category),
              Icons.category_rounded,
              AppColors.primaryBlue,
            ),
            infoBox(
              'Available Stock',
              '${product.stock}',
              Icons.inventory_2_rounded,
              Colors.orange,
            ),
            infoBox(
              'Product Status',
              product.status.toUpperCase(),
              Icons.verified_rounded,
              product.status == 'active' ? AppColors.successGreen : AppColors.dangerRed,
            ),
            const SizedBox(height: 22),
            CustomButton(
              text: 'Buy with Credits',
              isLoading: isLoading,
              onPressed: product.stock > 0 && product.status == 'active'
                  ? buyProduct
                  : null,
            ),
            const SizedBox(height: 12),
            const Text(
              'Note: Marketplace orders are fulfilled manually by admin in this phase.',
              style: TextStyle(
                color: AppColors.textMuted,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
