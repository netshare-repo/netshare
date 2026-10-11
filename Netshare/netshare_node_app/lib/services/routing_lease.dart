/// Android has one app VPN. A different peer must not replace or stop it.
class RoutingLease {
  String? _owner;
  Future<void>? _release;
  bool owns(String id) => _owner == id;
  bool acquire(String id) {
    if (_owner != null) return false;
    _owner = id;
    return true;
  }

  Future<void> release(String id, Future<void> Function() stop) async {
    if (_owner != id) return;
    if (_release != null) {
      await _release;
      return;
    }
    final pending = stop();
    _release = pending;
    try {
      await pending;
    } finally {
      if (_owner == id) _owner = null;
      _release = null;
    }
  }
}
