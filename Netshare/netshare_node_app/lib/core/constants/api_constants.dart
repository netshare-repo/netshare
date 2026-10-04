class ApiConstants {
  // Use http://10.0.2.2:8000/api for Android Emulator
  // Use http://<laptop_ip>:8000/api for real device
  // Use http://localhost:8000/api for Chrome/Web

  static const String baseUrl = "http://10.113.75.193:8000/api";

  // Auth
  static const String register = "/auth/register";
  static const String verifySignupOtp = "/auth/verify-signup-otp";
  static const String resendSignupOtp = "/auth/resend-signup-otp";
  static const String login = "/auth/login";
  static const String me = "/auth/me";
  static const String forgotPassword = "/auth/forgot-password";
  static const String verifyResetOtp = "/auth/verify-reset-otp";
  static const String resetPassword = "/auth/reset-password";

  // Users
  static const String profile = "/users/profile";
  static const String changePassword = "/users/change-password";

  // Nodes
  static const String registerNode = "/nodes/register";
  static const String myNode = "/nodes/my-node";
  static const String nodeSettings = "/nodes/settings";
  static const String startNode = "/nodes/start";
  static const String stopNode = "/nodes/stop";
  static const String assignedTask = "/nodes/assigned-task";

  // Tasks
  static const String tasks = "/tasks";

  // Wallet
  static const String wallet = "/wallet";
  static const String transactions = "/wallet/transactions";

  // Marketplace
  static const String marketplaceProducts = "/marketplace/products";
  static const String marketplaceOrders = "/marketplace/orders";
  static const String myMarketplaceOrders = "/marketplace/my-orders";
}