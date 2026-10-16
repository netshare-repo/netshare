package com.example.netshare_node_app

import android.app.Activity
import android.content.Intent
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.VpnService
import android.os.Build
import android.util.Log
import android.util.Base64
import java.io.ByteArrayOutputStream
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
        private const val PROOF_REQUEST_CODE = 0x2027
        private const val CSV_REQUEST_CODE = 0x2028
    }

    private var pendingPermissionResult: MethodChannel.Result? = null
    private var eventSink: EventChannel.EventSink? = null
    private var pendingDocumentResult: MethodChannel.Result? = null
    private var pendingCsv: String? = null
    private var pendingPng: ByteArray? = null

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "io.netshare.app/documents").setMethodCallHandler { call, result ->
            if (pendingDocumentResult != null) {
                result.error("DOCUMENT_BUSY", "A document operation is already in progress", null)
            } else if (call.method == "pickProof" || call.method == "saveCsv" || call.method == "saveText" || call.method == "savePng") {
                val saving = call.method == "saveCsv" || call.method == "saveText" || call.method == "savePng"
                val content: String? = if (call.method == "savePng") null else call.argument("content")
                val png: ByteArray? = if (call.method == "savePng") call.argument("content") else null
                val mimeType = if (call.method == "saveText") call.argument<String>("mimeType") ?: "text/plain" else if (call.method == "savePng") "image/png" else "text/csv"
                if ((call.method == "savePng" && (png == null || png.isEmpty() || png.size > 2 * 1024 * 1024)) ||
                    (saving && call.method != "savePng" && (content == null || content.toByteArray(Charsets.UTF_8).size > 2 * 1024 * 1024))) {
                    result.error("INVALID_REPORT", "Report is missing or exceeds 2 MB", null)
                } else if (call.method == "saveText" && mimeType != "text/plain") {
                    result.error("INVALID_TEXT_TYPE", "Fetched content must be saved as plain text", null)
                } else {
                    pendingDocumentResult = result
                    pendingCsv = if (saving) content else null
                    pendingPng = if (call.method == "savePng") png else null
                    val intent = Intent(if (saving) Intent.ACTION_CREATE_DOCUMENT else Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = if (call.method == "saveText") "text/plain" else if (call.method == "savePng") "image/png" else if (saving) "text/csv" else "*/*"
                        if (saving) putExtra(Intent.EXTRA_TITLE, call.argument<String>("filename") ?: if (call.method == "savePng") "netshare-screenshot.png" else "netshare-report.csv")
                        else putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/png", "image/jpeg", "application/pdf"))
                    }
                    try { startActivityForResult(intent, if (saving) CSV_REQUEST_CODE else PROOF_REQUEST_CODE) }
                    catch (error: Exception) {
                        pendingDocumentResult = null; pendingCsv = null; pendingPng = null
                        result.error("PICKER_UNAVAILABLE", "Could not open the document picker", null)
                    }
                }
            } else result.notImplemented()
        }

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
        pendingDocumentResult?.error("ACTIVITY_CLOSED", "Document activity closed; retry the operation", null)
        pendingDocumentResult = null
        pendingCsv = null
        pendingPng = null
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
                val routingSessionId = call.argument<String>("routingSessionId")
                val authorizedHost = call.argument<String>("authorizedHost")
                val authorizedPort = call.argument<Int>("authorizedPort")
                val authorizedMethod = call.argument<String>("authorizedMethod") ?: "GET"
                val authorizedIps = call.argument<List<String>>("authorizedIps") ?: emptyList()

                if (routingSessionId.isNullOrBlank() ||
                    authorizedHost.isNullOrBlank() ||
                    authorizedPort == null ||
                    authorizedMethod !in setOf("GET", "HEAD") ||
                    authorizedIps.isEmpty()
                ) {
                    result.error("INVALID_AUTHORIZATION", "Task-specific routing authorization is required", null)
                    return
                }

                val intent = Intent(this, NetShareVpnService::class.java).apply {
                    action = NetShareVpnService.ACTION_START
                    putExtra(NetShareVpnService.EXTRA_SESSION_NAME, sessionName)
                    putExtra(NetShareVpnService.EXTRA_VIRTUAL_IP, virtualIp)
                    putExtra(NetShareVpnService.EXTRA_SUBNET_ROUTE, subnetRoute)
                    putExtra(NetShareVpnService.EXTRA_PREFIX_LENGTH, prefixLength)
                    putExtra(NetShareVpnService.EXTRA_ROUTING_SESSION_ID, routingSessionId)
                    putExtra(NetShareVpnService.EXTRA_AUTHORIZED_HOST, authorizedHost)
                    putExtra(NetShareVpnService.EXTRA_AUTHORIZED_PORT, authorizedPort)
                    putExtra(NetShareVpnService.EXTRA_AUTHORIZED_METHOD, authorizedMethod)
                    putStringArrayListExtra(NetShareVpnService.EXTRA_AUTHORIZED_IPS, ArrayList(authorizedIps))
                    putExtra("traffic_policy", call.argument<String>("trafficPolicy"))
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

            "isVpnNetworkReady" -> {
                val connectivity = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                @Suppress("DEPRECATION")
                val ready = connectivity.allNetworks.any { network ->
                    connectivity.getNetworkCapabilities(network)?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true &&
                        connectivity.getNetworkInfo(network)?.isConnected == true &&
                        connectivity.getLinkProperties(network)?.interfaceName == "tun0"
                }
                result.success(ready)
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
        if (requestCode == PROOF_REQUEST_CODE || requestCode == CSV_REQUEST_CODE) {
            val result = pendingDocumentResult ?: return
            val uri = data?.data
            val csv = pendingCsv
            val png = pendingPng
            if (resultCode != Activity.RESULT_OK || uri == null) {
                pendingDocumentResult = null; pendingCsv = null; pendingPng = null
                result.success(if (requestCode == CSV_REQUEST_CODE) false else null)
                return
            }
            Thread {
                try {
                    val payload: Any = if (requestCode == CSV_REQUEST_CODE) {
                        contentResolver.openOutputStream(uri, "wt")?.use {
                            if (png != null) it.write(png) else it.write((csv ?: "").toByteArray(Charsets.UTF_8))
                        }
                            ?: throw IllegalStateException("Cannot write selected document")
                        true
                    } else {
                        val mime = contentResolver.getType(uri) ?: ""
                        require(mime in setOf("image/png", "image/jpeg", "application/pdf")) { "Proof must be PNG, JPEG or PDF" }
                        val bytes = contentResolver.openInputStream(uri)?.use { stream ->
                            val output = ByteArrayOutputStream()
                            val buffer = ByteArray(8192)
                            var size = 0
                            while (true) {
                                val count = stream.read(buffer)
                                if (count < 0) break
                                size += count
                                require(size <= 2 * 1024 * 1024) { "Proof exceeds 2 MB" }
                                output.write(buffer, 0, count)
                            }
                            require(size > 0) { "Proof is empty" }
                            output.toByteArray()
                        } ?: throw IllegalStateException("Cannot read selected document")
                        mapOf("mime" to mime, "base64" to Base64.encodeToString(bytes, Base64.NO_WRAP), "size" to bytes.size)
                    }
                    runOnUiThread { if (pendingDocumentResult === result) { pendingDocumentResult = null; pendingCsv = null; pendingPng = null; result.success(payload) } }
                } catch (error: Exception) {
                    runOnUiThread { if (pendingDocumentResult === result) { pendingDocumentResult = null; pendingCsv = null; pendingPng = null; result.error("DOCUMENT_FAILED", error.message, null) } }
                }
            }.start()
            return
        }

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
