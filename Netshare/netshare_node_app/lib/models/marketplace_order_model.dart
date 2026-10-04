class MarketplaceOrderModel {
  final String id;
  final String productName;
  final int creditsSpent;
  final String status;
  final String fulfilmentNote;
  final String createdAt;

  MarketplaceOrderModel({
    required this.id,
    required this.productName,
    required this.creditsSpent,
    required this.status,
    required this.fulfilmentNote,
    required this.createdAt,
  });

  factory MarketplaceOrderModel.fromJson(Map<String, dynamic> json) {
    return MarketplaceOrderModel(
      id: json['_id'] ?? '',
      productName: json['productName'] ?? '',
      creditsSpent: (json['creditsSpent'] ?? 0).round(),
      status: json['status'] ?? 'pending',
      fulfilmentNote: json['fulfilmentNote'] ?? '',
      createdAt: json['createdAt'] ?? '',
    );
  }
}