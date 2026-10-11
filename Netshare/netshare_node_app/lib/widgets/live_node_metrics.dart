import 'dart:async';
import 'package:flutter/material.dart';
import '../services/vpn_service.dart';
import '../services/api_service.dart';

class LiveNodeMetrics extends StatefulWidget {
  final Future<Map<String, dynamic>> Function()? tunLoader;
  final Future<Map<String, dynamic>> Function()? sessionLoader;
  const LiveNodeMetrics({super.key, this.tunLoader, this.sessionLoader});
  @override
  State<LiveNodeMetrics> createState() => _LiveNodeMetricsState();
}

class _LiveNodeMetricsState extends State<LiveNodeMetrics> {
  Timer? _timer;
  Map<String, dynamic> _tun = {}, _session = {};
  String? _error;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    refresh();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> refresh() async {
    if (_busy) return;
    _busy = true;
    try {
      final result = await Future.wait([
        (widget.tunLoader ?? NetShareVpnBridge.getTunMetrics)(),
        (widget.sessionLoader ??
            () => ApiService.get('/node/session/current', auth: true))(),
      ]);
      if (mounted) {
        setState(() {
          _tun = result[0];
          _session = result[1];
          _error = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _tun = {};
          _session = {};
          _error = 'Live metrics unavailable — retrying.';
        });
      }
    } finally {
      _busy = false;
    }
  }

  String rate(String key) => _tun['state'] == 'connected' && _tun[key] is num
      ? '${(_tun[key] as num).toStringAsFixed(3)} Mbps'
      : 'Not measured';
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Live session metrics',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          if (_error != null) Text(_error!),
          Text(
            'VPN: ${_tun['state'] ?? 'Unavailable'} · Participation: ${_session['status'] ?? 'No active session'}',
          ),
          SelectableText(
            'Session: ${_session['sessionId'] ?? 'None'}\nRouting session: ${_tun['routingSessionId'] ?? 'None'}',
          ),
          Text(
            'Region: ${(_session['node'] as Map?)?['region'] ?? 'Unavailable'}',
          ),
          Text(
            'Upload: ${rate('uploadSpeedMbps')} · Download: ${rate('downloadSpeedMbps')}',
          ),
          Text(
            'Network latency: ${_session['latency'] == null ? 'Not measured' : '${_session['latency']} ms'}',
          ),
          Text(
            'Packet loss: ${_session['packetLoss'] == null ? 'Not measured' : '${_session['packetLoss']}%'}',
          ),
          if (_session['packetLossSource'] != null)
            const Text(
              'Loss source: four STUN binding probes, 400 ms response deadline; not HTTP failure rate.',
            ),
          Text(
            'Stability (probe RTT jitter): ${_session['stabilityJitterMs'] == null ? 'Not measured' : '${_session['stabilityJitterMs']} ms'}',
          ),
          Text(
            'Accounted session bandwidth: ${_session['bandwidthConsumedMB'] ?? 0} MB',
          ),
          const Text(
            '5-second refresh. Throughput is measured from TUN counters, not the configured speed cap.',
          ),
        ],
      ),
    ),
  );
}
