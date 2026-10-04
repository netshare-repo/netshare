class MarketplaceProductModel {
  final String id;
  final String name;
  final String description;
  final String category;
  final int requiredCredits;
  final String imageUrl;
  final int stock;
  final String status;

  MarketplaceProductModel({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.requiredCredits,
    required this.imageUrl,
    required this.stock,
    required this.status,
  });

  factory MarketplaceProductModel.fromJson(Map<String, dynamic> json) {
    return MarketplaceProductModel(
      id: json['_id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      category: json['category'] ?? 'other',
      requiredCredits: (json['requiredCredits'] ?? 0).round(),
      imageUrl: json['imageUrl'] ?? '',
      stock: (json['stock'] ?? 0).round(),
      status: json['status'] ?? 'inactive',
    );
  }
}