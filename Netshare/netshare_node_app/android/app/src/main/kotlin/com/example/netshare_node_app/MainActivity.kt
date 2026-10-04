package com.example.netshare_node_app

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.util.Log
import androidx.annotation.NonNull
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * MainActivity with Flutter Platform-Channel Bridge for NetShare VpnService.
 *
 * Exposes:
 * - MethodChannel: "io.netshare.node/vpn"
 *     - checkPermission
 *     - requestPermission
 *     - startService
 *     - stopService
 *     - getStatus
 * - EventChannel: "io.netshare.node/vpn_events"
 *     - Streams real-time VPN state changes (e.g. connected, disconnected, onRevoke)
 */
class MainActivity : FlutterActivity(), NetShareVpnService.VpnStateListener {

    companion object {
        private const val TAG = "MainActivity"
        private const val VPN_METHOD_CHANNEL = "io.netshare.node/vpn"
        private const val VPN_EVENT_CHANNEL = "io.netshare.node/vpn_events"
        private const val VPN_REQUEST_CODE = 0x2026
    }

    private var pendingPermissionResult: MethodChannel.Result? = null
    private var eventSink: EventChannel.EventSink? = null

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // 1. MethodChannel for control actions
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, VPN_METHOD_CHANNEL).setMethodCallHandler { call, result ->
            handleMethodCall(call, result)
        }

        // 2. EventChannel for reactive status updates (connected, revoked, etc.)
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, VPN_EVENT_CHANNEL).setStreamHandler(
            object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    eventSink = events
                    // Emit immediate current state
                    val currentPayload = mapOf(
                        "state" to NetShareVpnService.currentState.name.lowercase(),
                        "routingScope" to NetShareVpnService.currentRoutingScope
                    )
                    events?.success(currentPayload)
                }

                override fun onCancel(arguments: Any?) {
                    eventSink = null
                }
            }
        )

        // Attach listener to service
        NetShareVpnService.addListener(this)
    }

    override fun onDestroy() {
        NetShareVpnService.removeListener(this)
        super.onDestroy()
    }

    private fun handleMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "checkPermission" -> {
                val prepareIntent = VpnService.prepare(this)
                val hasPermission = prepareIntent == null
                result.success(hasPermission)
            }

            "requestPermission" -> {
                val prepareIntent = VpnService.prepare(this)
                if (prepareIntent == null) {
                    // Permission already granted
                    result.success(true)
                } else {
                    if (pendingPermissionResult != null) {
                        result.error("CONCURRENT_REQUEST", "A VPN permission request is already in progress", null)
                        return
                    }
                    pendingPermissionResult = result
                    try {
                        startActivityForResult(prepareIntent, VPN_REQUEST_CODE)
                    } catch (e: Exception) {
                        pendingPermissionResult = null
                        result.error("INTENT_FAILED", "Failed to launch VPN permission intent: ${e.message}", null)
                    }
                }
            }

            "startService" -> {
                val prepareIntent = VpnService.prepare(this)
                if (prepareIntent != null) {
                    result.error("PERMISSION_REQUIRED", "VPN permission must be granted before starting the service", null)
                    return
                }

                val sessionName = call.argument<String>("sessionName") ?: NetShareVpnService.DEFAULT_SESSION_NAME
                val virtualIp = call.argument<String>("virtualIp") ?: NetShareVpnService.DEFAULT_VIRTUAL_IP
                val subnetRoute = call.argument<String>("subnetRoute") ?: NetShareVpnService.DEFAULT_SUBNET_ROUTE
                val prefixLength = call.argument<Int>("prefixLength") ?: NetShareVpnService.DEFAULT_PREFIX_LENGTH

                val intent = Intent(this, NetShareVpnService::class.java).apply {
                    action = NetShareVpnService.ACTION_START
                    putExtra(NetShareVpnService.EXTRA_SESSION_NAME, sessionName)
                    putExtra(NetShareVpnService.EXTRA_VIRTUAL_IP, virtualIp)
                    putExtra(NetShareVpnService.EXTRA_SUBNET_ROUTE, subnetRoute)
                    putExtra(NetShareVpnService.EXTRA_PREFIX_LENGTH, prefixLength)
                }

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(intent)
                    } else {
                        startService(intent)
                    }

                    val routingScope = "$subnetRoute/$prefixLength"
                    result.success(
                        mapOf(
                            "status" to "connecting",
                            "virtualIp" to virtualIp,
                            "routingScope" to routingScope
                        )
                    )
                } catch (e: Exception) {
                    result.error("START_FAILED", "Failed to start NetShare VpnService: ${e.message}", null)
                }
            }

            "stopService" -> {
                val intent = Intent(this, NetShareVpnService::class.java).apply {
                    action = NetShareVpnService.ACTION_STOP
                }
                try {
                    startService(intent)
                    result.success(mapOf("status" to "disconnected"))
                } catch (e: Exception) {
                    result.error("STOP_FAILED", "Failed to stop NetShare VpnService: ${e.message}", null)
                }
            }

            "getStatus" -> {
                val prepareIntent = VpnService.prepare(this)
                val hasPermission = prepareIntent == null
                val state = NetShareVpnService.currentState
                val isRunning = state == NetShareVpnService.State.CONNECTED

                result.success(
                    mapOf(
                        "status" to state.name.lowercase(),
                        "hasPermission" to hasPermission,
                        "routingScope" to NetShareVpnService.currentRoutingScope,
                        "isRunning" to isRunning
                    )
                )
            }

            "getTunMetrics" -> {
                val metrics = NetShareVpnService.getTunMetrics()
                result.success(metrics)
            }

            else -> result.notImplemented()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == VPN_REQUEST_CODE) {
            val granted = resultCode == Activity.RESULT_OK
            Log.d(TAG, "VPN permission activity result: granted=$granted (resultCode=$resultCode)")
            pendingPermissionResult?.success(granted)
            pendingPermissionResult = null
        }
    }

    override fun onStateChanged(state: NetShareVpnService.State, routingScope: String) {
        runOnUiThread {
            val payload = mapOf(
                "state" to state.name.lowercase(),
                "routingScope" to routingScope
            )
            eventSink?.success(payload)
        }
    }
}
