class NodeDeviceModel {
  final String id;
  final String deviceName;
  final String deviceId;
  final String region;
  final int bandwidthLimitMB;
  final int usedBandwidthMB;
  final int speedCapMbps;
  final int maxConcurrentTasks;
  final int currentActiveTasks;
  final String status;
  final int reliabilityScore;
  final int latencyMs;

  NodeDeviceModel({
    required this.id,
    required this.deviceName,
    required this.deviceId,
    required this.region,
    required this.bandwidthLimitMB,
    required this.usedBandwidthMB,
    required this.speedCapMbps,
    required this.maxConcurrentTasks,
    required this.currentActiveTasks,
    required this.status,
    required this.reliabilityScore,
    required this.latencyMs,
  });

  factory NodeDeviceModel.fromJson(Map<String, dynamic> json) {
    return NodeDeviceModel(
      id: json['_id'] ?? '',
      deviceName: json['deviceName'] ?? '',
      deviceId: json['deviceId'] ?? '',
      region: json['region'] ?? '',
      bandwidthLimitMB: (json['bandwidthLimitMB'] ?? 0).round(),
      usedBandwidthMB: (json['usedBandwidthMB'] ?? 0).round(),
      speedCapMbps: (json['speedCapMbps'] ?? 0).round(),
      maxConcurrentTasks: (json['maxConcurrentTasks'] ?? 1).round(),
      currentActiveTasks: (json['currentActiveTasks'] ?? 0).round(),
      status: json['status'] ?? 'inactive',
      reliabilityScore: (json['reliabilityScore'] ?? 100).round(),
      latencyMs: (json['latencyMs'] ?? 0).round(),
    );
  }
}