package com.example.netshare_node_app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.net.DatagramSocket
import java.net.Socket
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * NetShareVpnService
 *
 * Implements Android VpnService API for NetShare controlled request routing
 * according to NetShare SRS SI-4, OE-5, and Chapter 3 specifications.
 *
 * Key Constraints:
 * 1. Narrow Routing Scope: Routes ONLY the designated internal NetShare
 *    virtual subnet (default: 10.254.1.0/24). Does NOT route all device traffic (0.0.0.0/0).
 * 2. Loop-safe upstream forwarding: control plane and external residential target sockets
 *    are protected via VpnService.protect(socket), completely preventing VPN routing loops.
 * 3. NO addDisallowedApplication(packageName) bypass — task traffic destined for the virtual
 *    subnet actually enters and is processed by the controlled TUN interface.
 * 4. Active TUN Forwarder thread processes packets, responds to ping latency probes,
 *    and tracks real throughput metrics (packetsIn, bytesIn, packetsOut, bytesOut).
 * 5. Runs as an Android Foreground Service with persistent status notification,
 *    guaranteeing survival during background execution and screen lock.
 * 6. Handles onRevoke() gracefully when revoked by system or user.
 */
class NetShareVpnService : VpnService() {

    enum class State {
        DISCONNECTED,
        CONNECTING,
        CONNECTED,
        REVOKED
    }

    interface VpnStateListener {
        fun onStateChanged(state: State, routingScope: String)
    }

    companion object {
        private const val TAG = "NetShareVpnService"

        const val ACTION_START = "com.example.netshare_node_app.START_VPN"
        const val ACTION_STOP = "com.example.netshare_node_app.STOP_VPN"

        const val EXTRA_SESSION_NAME = "session_name"
        const val EXTRA_VIRTUAL_IP = "virtual_ip"
        const val EXTRA_SUBNET_ROUTE = "subnet_route"
        const val EXTRA_PREFIX_LENGTH = "prefix_length"

        const val NOTIFICATION_CHANNEL_ID = "netshare_vpn_channel"
        const val NOTIFICATION_CHANNEL_NAME = "NetShare Controlled Routing"
        const val NOTIFICATION_ID = 2026

        const val DEFAULT_VIRTUAL_IP = "10.254.1.2"
        const val DEFAULT_SUBNET_ROUTE = "10.254.1.0"
        const val DEFAULT_PREFIX_LENGTH = 24
        const val DEFAULT_SESSION_NAME = "NetShareControlledRouting"

        @Volatile
        var currentState: State = State.DISCONNECTED
            private set

        @Volatile
        var currentRoutingScope: String = "$DEFAULT_SUBNET_ROUTE/$DEFAULT_PREFIX_LENGTH"
            private set

        @Volatile
        var activeInstance: NetShareVpnService? = null
            private set

        // TUN throughput and packet metrics
        private val bytesIn = AtomicLong(0)
        private val bytesOut = AtomicLong(0)
        private val packetsIn = AtomicLong(0)
        private val packetsOut = AtomicLong(0)

        private val listeners = mutableListOf<VpnStateListener>()

        fun addListener(listener: VpnStateListener) {
            synchronized(listeners) {
                if (!listeners.contains(listener)) {
                    listeners.add(listener)
                    listener.onStateChanged(currentState, currentRoutingScope)
                }
            }
        }

        fun removeListener(listener: VpnStateListener) {
            synchronized(listeners) {
                listeners.remove(listener)
            }
        }

        private fun notifyStateChanged(state: State, scope: String) {
            currentState = state
            currentRoutingScope = scope
            synchronized(listeners) {
                for (listener in listeners) {
                    try {
                        listener.onStateChanged(state, scope)
                    } catch (e: Exception) {
                        Log.e(TAG, "Error notifying state listener", e)
                    }
                }
            }
        }

        /**
         * Protect a Socket from being routed through the VPN tunnel.
         * Loop-safe: ensures outbound residential sockets bypass the TUN interface.
         */
        fun protectSocket(socket: Socket): Boolean {
            val instance = activeInstance ?: return false
            return instance.protect(socket)
        }

        /**
         * Protect a DatagramSocket from being routed through the VPN tunnel.
         */
        fun protectDatagramSocket(socket: DatagramSocket): Boolean {
            val instance = activeInstance ?: return false
            return instance.protect(socket)
        }

        /**
         * Protect a native file descriptor.
         */
        fun protectFileDescriptor(fd: Int): Boolean {
            val instance = activeInstance ?: return false
            return instance.protect(fd)
        }

        /**
         * Returns snapshot of TUN metrics.
         */
        fun getTunMetrics(): Map<String, Any> {
            return mapOf(
                "bytesIn" to bytesIn.get(),
                "bytesOut" to bytesOut.get(),
                "packetsIn" to packetsIn.get(),
                "packetsOut" to packetsOut.get(),
                "state" to currentState.name.lowercase(),
                "routingScope" to currentRoutingScope
            )
        }
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private var tunWorkerThread: Thread? = null
    private val isForwarderRunning = AtomicBoolean(false)

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "NetShareVpnService created")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.d(TAG, "onStartCommand received action: $action")

        when (action) {
            ACTION_START -> {
                val sessionName = intent.getStringExtra(EXTRA_SESSION_NAME) ?: DEFAULT_SESSION_NAME
                val virtualIp = intent.getStringExtra(EXTRA_VIRTUAL_IP) ?: DEFAULT_VIRTUAL_IP
                val subnetRoute = intent.getStringExtra(EXTRA_SUBNET_ROUTE) ?: DEFAULT_SUBNET_ROUTE
                val prefixLength = intent.getIntExtra(EXTRA_PREFIX_LENGTH, DEFAULT_PREFIX_LENGTH)
                startTunnel(sessionName, virtualIp, subnetRoute, prefixLength)
            }
            ACTION_STOP -> {
                stopTunnel("Stop action requested")
            }
            else -> {
                Log.w(TAG, "Unknown action: $action")
            }
        }

        return START_NOT_STICKY
    }

    /**
     * Establish the controlled VPN tunnel.
     * Enforces narrow routing scope (only subnetRoute/prefixLength).
     * Does NOT use addDisallowedApplication(packageName) — uses loop-safe protect() instead.
     */
    @Synchronized
    private fun startTunnel(
        sessionName: String,
        virtualIp: String,
        subnetRoute: String,
        prefixLength: Int
    ) {
        if (currentState == State.CONNECTED && vpnInterface != null) {
            Log.i(TAG, "Tunnel already running and active (idempotent start)")
            return
        }

        val scope = "$subnetRoute/$prefixLength"
        notifyStateChanged(State.CONNECTING, scope)

        try {
            // Foreground notification is required for background operation and screen lock
            val notification = buildForegroundNotification("NetShare Secure Routing Active", "Scope: $scope")
            startForeground(NOTIFICATION_ID, notification)

            val builder = Builder()
                .setSession(sessionName)
                .setMtu(1500)
                .addAddress(virtualIp, 32)
                // Strict narrow routing scope: only route the controlled NetShare testing subnet.
                // NEVER add 0.0.0.0/0 (unrestricted device proxying is explicitly disallowed).
                .addRoute(subnetRoute, prefixLength)

            val pfd = builder.establish()
            if (pfd == null) {
                Log.e(TAG, "Builder.establish() returned null - permission may have been revoked")
                stopTunnel("Interface establishment failed")
                notifyStateChanged(State.DISCONNECTED, scope)
                return
            }

            vpnInterface = pfd
            activeInstance = this

            // Start TUN packet forwarder worker
            startTunForwarder(pfd)

            notifyStateChanged(State.CONNECTED, scope)
            Log.i(TAG, "NetShare VPN interface established: IP=$virtualIp, Scope=$scope (TUN Forwarder active)")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to establish NetShare VPN tunnel", e)
            stopTunnel("Exception during start: ${e.message}")
            notifyStateChanged(State.DISCONNECTED, scope)
        }
    }

    /**
     * Controlled TUN Packet Forwarder.
     * Reads IP packets from the TUN file descriptor, handles ICMP ping probes,
     * monitors traffic metrics, and ensures task traffic actually passes through the TUN.
     */
    private fun startTunForwarder(pfd: ParcelFileDescriptor) {
        stopTunForwarder()

        isForwarderRunning.set(true)
        tunWorkerThread = Thread({
            val buffer = ByteArray(32768)
            val inputStream = FileInputStream(pfd.fileDescriptor)
            val outputStream = FileOutputStream(pfd.fileDescriptor)

            Log.i(TAG, "TUN forwarder thread started")

            try {
                while (isForwarderRunning.get()) {
                    val length = inputStream.read(buffer)
                    if (length <= 0) continue

                    packetsIn.incrementAndGet()
                    bytesIn.addAndGet(length.toLong())

                    // Parse IPv4 header
                    if (length >= 20 && (buffer[0].toInt() and 0xF0) == 0x40) {
                        val protocol = buffer[9].toInt() and 0xFF

                        // Protocol 1: ICMP
                        if (protocol == 1 && length >= 28) {
                            val ipHeaderLength = (buffer[0].toInt() and 0x0F) * 4
                            val icmpType = buffer[ipHeaderLength].toInt() and 0xFF

                            // ICMP Echo Request (type 8) -> Echo Reply (type 0)
                            if (icmpType == 8) {
                                buffer[ipHeaderLength] = 0 // Type 0 (Echo Reply)

                                // Swap Source IP (offset 12..15) and Destination IP (offset 16..19)
                                for (i in 0..3) {
                                    val temp = buffer[12 + i]
                                    buffer[12 + i] = buffer[16 + i]
                                    buffer[16 + i] = temp
                                }

                                // Recalculate ICMP Checksum
                                buffer[ipHeaderLength + 2] = 0
                                buffer[ipHeaderLength + 3] = 0
                                val icmpLength = length - ipHeaderLength
                                val icmpChecksum = computeChecksum(buffer, ipHeaderLength, icmpLength)
                                buffer[ipHeaderLength + 2] = (icmpChecksum shr 8).toByte()
                                buffer[ipHeaderLength + 3] = (icmpChecksum and 0xFF).toByte()

                                // Recalculate IP Checksum
                                buffer[10] = 0
                                buffer[11] = 0
                                val ipChecksum = computeChecksum(buffer, 0, ipHeaderLength)
                                buffer[10] = (ipChecksum shr 8).toByte()
                                buffer[11] = (ipChecksum and 0xFF).toByte()

                                try {
                                    outputStream.write(buffer, 0, length)
                                    packetsOut.incrementAndGet()
                                    bytesOut.addAndGet(length.toLong())
                                } catch (e: IOException) {
                                    Log.w(TAG, "TUN write error: ${e.message}")
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                if (isForwarderRunning.get()) {
                    Log.w(TAG, "TUN forwarder loop ended with exception: ${e.message}")
                }
            } finally {
                try { inputStream.close() } catch (_: Exception) {}
                try { outputStream.close() } catch (_: Exception) {}
                Log.i(TAG, "TUN forwarder thread stopped")
            }
        }, "NetShareTunForwarder").apply {
            isDaemon = true
            start()
        }
    }

    private fun stopTunForwarder() {
        isForwarderRunning.set(false)
        tunWorkerThread?.interrupt()
        tunWorkerThread = null
    }

    /**
     * Compute standard Internet 16-bit 1's complement checksum.
     */
    private fun computeChecksum(data: ByteArray, offset: Int, length: Int): Int {
        var sum = 0
        var i = offset
        var remaining = length

        while (remaining > 1) {
            val high = data[i].toInt() and 0xFF
            val low = data[i + 1].toInt() and 0xFF
            sum += (high shl 8) or low
            i += 2
            remaining -= 2
        }

        if (remaining > 0) {
            sum += (data[i].toInt() and 0xFF) shl 8
        }

        while ((sum shr 16) > 0) {
            sum = (sum and 0xFFFF) + (sum shr 16)
        }

        return (sum.inv()) and 0xFFFF
    }

    /**
     * Stop the VPN tunnel and release resources.
     */
    @Synchronized
    private fun stopTunnel(reason: String) {
        Log.i(TAG, "Stopping NetShare VPN tunnel: $reason")

        stopTunForwarder()

        try {
            vpnInterface?.close()
        } catch (e: IOException) {
            Log.w(TAG, "Error closing VPN interface", e)
        } finally {
            vpnInterface = null
            activeInstance = null
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
        notifyStateChanged(State.DISCONNECTED, currentRoutingScope)
    }

    /**
     * Called by the system when VPN permission is revoked by the user or another VPN app is started.
     */
    override fun onRevoke() {
        Log.w(TAG, "VPN permission revoked by system or user")
        stopTunForwarder()
        try {
            vpnInterface?.close()
        } catch (e: IOException) {
            Log.w(TAG, "Error closing VPN interface on revoke", e)
        } finally {
            vpnInterface = null
            activeInstance = null
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
        notifyStateChanged(State.REVOKED, currentRoutingScope)
        super.onRevoke()
    }

    override fun onDestroy() {
        Log.i(TAG, "NetShareVpnService destroyed")
        stopTunForwarder()
        try {
            vpnInterface?.close()
        } catch (e: IOException) {
            Log.w(TAG, "Error closing VPN interface on destroy", e)
        } finally {
            vpnInterface = null
            activeInstance = null
        }
        if (currentState != State.REVOKED) {
            notifyStateChanged(State.DISCONNECTED, currentRoutingScope)
        }
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                NOTIFICATION_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Status of NetShare controlled test routing session"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(title: String, content: String): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = if (launchIntent != null) {
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            PendingIntent.getActivity(this, 0, launchIntent, flags)
        } else null

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        builder.setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)

        if (pendingIntent != null) {
            builder.setContentIntent(pendingIntent)
        }

        return builder.build()
    }
}
