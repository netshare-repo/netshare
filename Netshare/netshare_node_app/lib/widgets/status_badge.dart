import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';

class StatusBadge extends StatelessWidget {
  final String text;
  final Color? color;

  const StatusBadge({
    super.key,
    required this.text,
    this.color,
  });

  Color _getColor() {
    final value = text.toLowerCase();

    if (value == 'active' ||
        value == 'completed' ||
        value == 'fulfilled' ||
        value == 'verified') {
      return AppColors.successGreen;
    }

    if (value == 'failed' ||
        value == 'inactive' ||
        value == 'rejected' ||
        value == 'cancelled') {
      return AppColors.dangerRed;
    }

    if (value == 'busy' ||
        value == 'pending' ||
        value == 'running' ||
        value == 'assigned') {
      return Colors.orange;
    }

    return color ?? AppColors.primaryBlue;
  }

  @override
  Widget build(BuildContext context) {
    final badgeColor = color ?? _getColor();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: badgeColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: badgeColor.withValues(alpha: 0.25)),
      ),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          color: badgeColor,
          fontSize: 11,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}
