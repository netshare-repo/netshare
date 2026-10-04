class WalletModel {
  final String id;
  final String userId;
  final int balance;
  final int earnedCredits;
  final int spentCredits;

  WalletModel({
    required this.id,
    required this.userId,
    required this.balance,
    required this.earnedCredits,
    required this.spentCredits,
  });

  factory WalletModel.fromJson(Map<String, dynamic> json) {
    return WalletModel(
      id: json['_id'] ?? '',
      userId: json['userId'] ?? '',
      balance: (json['balance'] ?? 0).round(),
      earnedCredits: (json['earnedCredits'] ?? 0).round(),
      spentCredits: (json['spentCredits'] ?? 0).round(),
    );
  }
}