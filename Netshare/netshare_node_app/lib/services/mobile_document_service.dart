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

  static Future<bool> saveText(
    String filename,
    String content, {
    String mimeType = 'text/plain',
  }) async =>
      await channel.invokeMethod<bool>('saveText', {
        'filename': filename,
        'content': content,
        'mimeType': mimeType,
      }) ??
      false;

  static Future<bool> savePng(String filename, Uint8List bytes) async =>
      await channel.invokeMethod<bool>('savePng', {
        'filename': filename,
        'content': bytes,
      }) ??
      false;
}
