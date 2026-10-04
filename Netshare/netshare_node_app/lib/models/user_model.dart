class UserModel {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String role;
  final String profileImage;
  final String status;
  final bool isVerified;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    required this.profileImage,
    required this.status,
    required this.isVerified,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      role: json['role'] ?? '',
      profileImage: json['profileImage'] ?? '',
      status: json['status'] ?? 'active',
      isVerified: json['isVerified'] ?? true,
    );
  }
}