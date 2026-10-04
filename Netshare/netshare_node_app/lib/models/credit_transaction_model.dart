class CreditTransactionModel {
  final String id;
  final String type;
  final int amount;
  final String description;
  final String status;
  final String createdAt;

  CreditTransactionModel({
    required this.id,
    required this.type,
    required this.amount,
    required this.description,
    required this.status,
    required this.createdAt,
  });

  factory CreditTransactionModel.fromJson(Map<String, dynamic> json) {
    return CreditTransactionModel(
      id: json['_id'] ?? '',
      type: json['type'] ?? '',
      amount: (json['amount'] ?? 0).round(),
      description: json['description'] ?? '',
      status: json['status'] ?? '',
      createdAt: json['createdAt'] ?? '',
    );
  }
}