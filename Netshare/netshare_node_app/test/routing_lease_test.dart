import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:netshare_node_app/services/routing_lease.dart';

void main() {
  test(
    'a second route cannot replace or stop the owning Android VPN',
    () async {
      final lease = RoutingLease();
      var stops = 0;
      expect(lease.acquire('first'), true);
      expect(lease.acquire('second'), false);
      await lease.release('second', () async {
        stops++;
      });
      expect(stops, 0);
      expect(lease.owns('first'), true);
      await lease.release('first', () async {
        stops++;
      });
      expect(stops, 1);
      expect(lease.acquire('second'), true);
    },
  );
  test(
    'duplicate teardown closes once and keeps lease until native stop completes',
    () async {
      final lease = RoutingLease();
      final stopped = Completer<void>();
      var stops = 0;
      lease.acquire('first');
      Future<void> stop() {
        stops++;
        return stopped.future;
      }

      final one = lease.release('first', stop),
          two = lease.release('first', stop);
      expect(stops, 1);
      expect(lease.acquire('second'), false);
      stopped.complete();
      await Future.wait([one, two]);
      expect(lease.acquire('second'), true);
    },
  );
}
