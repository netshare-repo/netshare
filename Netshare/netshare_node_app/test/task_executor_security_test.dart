import 'package:flutter_test/flutter_test.dart';
import 'package:netshare_node_app/services/task_executor_service.dart';

void main() {
  group('Phase 2E mobile target enforcement', () {
    test('blocks unrelated public host', () async {
      final error = await TaskExecutorService.validateTarget(
        'https://www.iana.org/',
        authorizedHost: 'example.com',
        authorizedPort: 443,
      );
      expect(error, contains('does not match authorized host'));
    });

    test('blocks localhost and loopback', () async {
      for (final target in ['http://localhost/', 'http://127.0.0.2/']) {
        expect(await TaskExecutorService.validateTarget(target), isNotNull);
      }
    });

    test('blocks RFC1918 targets', () async {
      for (final target in [
        'http://10.0.0.1/',
        'http://172.16.0.1/',
        'http://192.168.1.1/',
      ]) {
        expect(await TaskExecutorService.validateTarget(target), isNotNull);
      }
    });

    test('blocks metadata IP and hostname', () async {
      for (final target in [
        'http://169.254.169.254/latest/meta-data/',
        'http://metadata.google.internal/',
      ]) {
        expect(await TaskExecutorService.validateTarget(target), isNotNull);
      }
    });

    test('blocks unauthorized port', () async {
      final error = await TaskExecutorService.validateTarget(
        'https://example.com:22/',
      );
      expect(error, contains('Unauthorized port'));
    });

    test('blocks unsafe and cross-host redirects', () async {
      final privateRedirect = await TaskExecutorService.validateRedirect(
        'https://example.com/start',
        'http://127.0.0.1/admin',
        authorizedHost: 'example.com',
        authorizedPort: 443,
      );
      final publicRedirect = await TaskExecutorService.validateRedirect(
        'https://example.com/start',
        'https://www.iana.org/domains/reserved',
        authorizedHost: 'example.com',
        authorizedPort: 443,
      );
      expect(privateRedirect, contains('Unsafe redirect blocked'));
      expect(publicRedirect, contains('Unsafe redirect blocked'));
    });

    test('blocks unauthorized HTTP methods', () async {
      final error = await TaskExecutorService.validateTarget(
        'https://example.com/',
        authorizedHost: 'example.com',
        authorizedPort: 443,
        authorizedMethod: 'POST',
      );
      expect(error, contains('Unauthorized HTTP method'));
    });
  });
}
