import 'package:flutter/services.dart';

class MobileDocumentService {
  static const channel = MethodChannel('io.netshare.app/documents');
  static Future<Map<String, dynamic>?> pickProof() async {
    final result = await channel.invokeMapMethod<String, dynamic>('pickProof');
    return result;
  }

  static Future<bool> saveReport(String taskId, String csv) async =>
      await channel.invokeMethod<bool>('saveCsv', {
        'filename': 'netshare-task-$taskId.csv',
        'content': csv,
      }) ??
      false;
}
