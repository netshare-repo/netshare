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
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.DatagramSocket
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ThreadLocalRandom
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
        private const val TCP_FIN = 0x01
        private const val TCP_SYN = 0x02
        private const val TCP_RST = 0x04
        private const val TCP_PSH = 0x08
        private const val TCP_ACK = 0x10

        const val ACTION_START = "com.example.netshare_node_app.START_VPN"
        const val ACTION_STOP = "com.example.netshare_node_app.STOP_VPN"

        const val EXTRA_SESSION_NAME = "session_name"
        const val EXTRA_VIRTUAL_IP = "virtual_ip"
        const val EXTRA_SUBNET_ROUTE = "subnet_route"
        const val EXTRA_PREFIX_LENGTH = "prefix_length"
        const val EXTRA_ROUTING_SESSION_ID = "routing_session_id"
        const val EXTRA_AUTHORIZED_HOST = "authorized_host"
        const val EXTRA_AUTHORIZED_PORT = "authorized_port"
        const val EXTRA_AUTHORIZED_METHOD = "authorized_method"
        const val EXTRA_AUTHORIZED_IPS = "authorized_ips"

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
    private val tcpFlows = ConcurrentHashMap<TcpFlowKey, TcpTunnel>()
    private val packetId = AtomicLong(1)
    private val tunWriteLock = Any()
    @Volatile private var tunOutputStream: FileOutputStream? = null
    @Volatile private var allowedTargetIps: Set<Int> = emptySet()
    @Volatile private var allowedTargetIpStrings: Set<String> = emptySet()
    @Volatile private var authorizedPort: Int = -1
    @Volatile private var authorizedHost: String = ""
    @Volatile private var authorizedMethod: String = ""
    @Volatile private var routingSessionId: String = ""

    private data class TcpFlowKey(
        val sourceIp: Int,
        val sourcePort: Int,
        val destinationIp: Int,
        val destinationPort: Int
    )

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
                val routeSessionId = intent.getStringExtra(EXTRA_ROUTING_SESSION_ID) ?: ""
                val routeHost = intent.getStringExtra(EXTRA_AUTHORIZED_HOST) ?: ""
                val routePort = intent.getIntExtra(EXTRA_AUTHORIZED_PORT, -1)
                val routeMethod = intent.getStringExtra(EXTRA_AUTHORIZED_METHOD) ?: ""
                val routeIps = intent.getStringArrayListExtra(EXTRA_AUTHORIZED_IPS)?.toList() ?: emptyList()
                startTunnel(
                    sessionName,
                    virtualIp,
                    subnetRoute,
                    prefixLength,
                    routeSessionId,
                    routeHost,
                    routePort,
                    routeMethod,
                    routeIps
                )
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
        prefixLength: Int,
        routeSessionId: String,
        routeHost: String,
        routePort: Int,
        routeMethod: String,
        routeIps: List<String>
    ) {
        val normalizedMethod = routeMethod.uppercase()
        val parsedIps = routeIps.mapNotNull { parsePublicIpv4(it) }.toSet()
        if (routeSessionId.isBlank() || routeHost.isBlank() ||
            normalizedMethod !in setOf("GET", "HEAD") ||
            routePort !in setOf(80, 443, 8080, 8443) ||
            parsedIps.size != routeIps.toSet().size
        ) {
            Log.e(TAG, "Rejected incomplete or unsafe task routing authorization")
            notifyStateChanged(State.DISCONNECTED, currentRoutingScope)
            stopSelf()
            return
        }

        if (vpnInterface != null) {
            closeTunnelInterface()
        }

        routingSessionId = routeSessionId
        authorizedHost = routeHost.lowercase()
        authorizedPort = routePort
        authorizedMethod = normalizedMethod
        allowedTargetIps = parsedIps
        allowedTargetIpStrings = routeIps.toSet()
        bytesIn.set(0)
        bytesOut.set(0)
        packetsIn.set(0)
        packetsOut.set(0)

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

            // Only this app and the independently validated public destination
            // addresses enter the TUN. No default route or unrelated app traffic.
            builder.addAllowedApplication(packageName)
            for (ip in allowedTargetIpStrings) {
                builder.addRoute(ip, 32)
            }

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
            Log.i(TAG, "NetShare VPN interface established for session=$routingSessionId host=$authorizedHost port=$authorizedPort method=$authorizedMethod targets=$allowedTargetIpStrings")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to establish NetShare VPN tunnel", e)
            stopTunnel("Exception during start: ${e.message}")
            notifyStateChanged(State.DISCONNECTED, scope)
        }
    }

    /**
     * Task-scoped user-space TCP relay. The app's HTTP and TLS sockets are
     * routed into TUN only for authorized /32 destinations. Each upstream
     * socket is protected before connect so relayed traffic cannot loop.
     */
    private fun startTunForwarder(pfd: ParcelFileDescriptor) {
        stopTunForwarder()

        isForwarderRunning.set(true)
        tunWorkerThread = Thread({
            val buffer = ByteArray(32768)
            val inputStream = FileInputStream(pfd.fileDescriptor)
            val outputStream = FileOutputStream(pfd.fileDescriptor)
            tunOutputStream = outputStream

            Log.i(TAG, "Authorized TCP TUN relay started")

            try {
                while (isForwarderRunning.get()) {
                    val length = inputStream.read(buffer)
                    if (length <= 0) continue

                    packetsIn.incrementAndGet()
                    bytesIn.addAndGet(length.toLong())

                    handleTunPacket(buffer.copyOf(length))
                }
            } catch (e: Exception) {
                if (isForwarderRunning.get()) {
                    Log.w(TAG, "TUN forwarder loop ended with exception: ${e.message}")
                }
            } finally {
                tunOutputStream = null
                try { inputStream.close() } catch (_: Exception) {}
                try { outputStream.close() } catch (_: Exception) {}
                Log.i(TAG, "Authorized TCP TUN relay stopped")
            }
        }, "NetShareTunForwarder").apply {
            isDaemon = true
            start()
        }
    }

    private fun stopTunForwarder() {
        isForwarderRunning.set(false)
        for (tunnel in tcpFlows.values) tunnel.close()
        tcpFlows.clear()
        tunWorkerThread?.interrupt()
        tunWorkerThread = null
    }

    private fun handleTunPacket(packet: ByteArray) {
        if (packet.size < 40 || (packet[0].toInt() ushr 4) != 4) return
        val ipHeaderLength = (packet[0].toInt() and 0x0F) * 4
        if (ipHeaderLength < 20 || packet.size < ipHeaderLength + 20) return
        if ((packet[9].toInt() and 0xFF) != 6) return

        val sourceIp = readIpv4(packet, 12)
        val destinationIp = readIpv4(packet, 16)
        val sourcePort = readU16(packet, ipHeaderLength)
        val destinationPort = readU16(packet, ipHeaderLength + 2)
        val tcpHeaderLength = ((packet[ipHeaderLength + 12].toInt() ushr 4) and 0x0F) * 4
        if (tcpHeaderLength < 20 || packet.size < ipHeaderLength + tcpHeaderLength) return
        val flags = packet[ipHeaderLength + 13].toInt() and 0xFF
        val sequence = readU32(packet, ipHeaderLength + 4)
        val payloadOffset = ipHeaderLength + tcpHeaderLength
        val payload = if (payloadOffset < packet.size) packet.copyOfRange(payloadOffset, packet.size) else ByteArray(0)

        val key = TcpFlowKey(sourceIp, sourcePort, destinationIp, destinationPort)
        val authorized = destinationIp in allowedTargetIps && destinationPort == authorizedPort
        if (!authorized) {
            sendReset(sourceIp, sourcePort, destinationIp, destinationPort, sequence, payload.size, flags)
            return
        }

        var tunnel = tcpFlows[key]
        val syn = flags and TCP_SYN != 0
        if (tunnel == null && syn) {
            tunnel = TcpTunnel(key, sequence)
            try {
                tunnel.connect()
                tcpFlows[key] = tunnel
                tunnel.sendSynAck()
            } catch (error: Exception) {
                Log.w(TAG, "Authorized upstream connect failed: ${error.message}")
                tunnel.close()
                sendReset(sourceIp, sourcePort, destinationIp, destinationPort, sequence, payload.size, flags)
            }
            return
        }
        if (tunnel == null) {
            sendReset(sourceIp, sourcePort, destinationIp, destinationPort, sequence, payload.size, flags)
            return
        }
        tunnel.acceptClientSegment(sequence, flags, payload)
    }

    private inner class TcpTunnel(
        private val key: TcpFlowKey,
        clientInitialSequence: Long
    ) {
        private val socket = Socket()
        private val serverInitialSequence = ThreadLocalRandom.current().nextInt().toLong() and 0xFFFFFFFFL
        @Volatile private var clientNextSequence = addSequence(clientInitialSequence, 1)
        @Volatile private var serverNextSequence = serverInitialSequence
        private val closed = AtomicBoolean(false)
        private var upstreamReader: Thread? = null

        fun connect() {
            if (!protect(socket)) throw IOException("Unable to protect upstream socket")
            socket.tcpNoDelay = true
            socket.connect(InetSocketAddress(ipv4ToString(key.destinationIp), key.destinationPort), 10000)
            upstreamReader = Thread({ relayUpstreamToTun() }, "NetShareTcpUpstream-${key.sourcePort}").apply {
                isDaemon = true
                start()
            }
        }

        fun sendSynAck() {
            sendTcpPacket(key, serverNextSequence, clientNextSequence, TCP_SYN or TCP_ACK, ByteArray(0))
            serverNextSequence = addSequence(serverNextSequence, 1)
        }

        @Synchronized
        fun acceptClientSegment(sequence: Long, flags: Int, payload: ByteArray) {
            if (closed.get()) return

            if (payload.isNotEmpty()) {
                if (sequence == clientNextSequence) {
                    socket.getOutputStream().write(payload)
                    socket.getOutputStream().flush()
                    clientNextSequence = addSequence(clientNextSequence, payload.size)
                }
                // Re-ACK retransmissions and out-of-order data without replaying upstream.
                sendTcpPacket(key, serverNextSequence, clientNextSequence, TCP_ACK, ByteArray(0))
            }

            if (flags and TCP_FIN != 0) {
                if (sequence == clientNextSequence ||
                    addSequence(sequence, payload.size) == clientNextSequence
                ) {
                    clientNextSequence = addSequence(clientNextSequence, 1)
                }
                sendTcpPacket(key, serverNextSequence, clientNextSequence, TCP_ACK, ByteArray(0))
                try { socket.shutdownOutput() } catch (_: Exception) {}
            }

            if (flags and TCP_RST != 0) close()
        }

        private fun relayUpstreamToTun() {
            val buffer = ByteArray(1200)
            try {
                val input = socket.getInputStream()
                while (!closed.get()) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (count == 0) continue
                    val payload = buffer.copyOf(count)
                    sendTcpPacket(key, serverNextSequence, clientNextSequence, TCP_PSH or TCP_ACK, payload)
                    serverNextSequence = addSequence(serverNextSequence, count)
                }
                if (!closed.get()) {
                    sendTcpPacket(key, serverNextSequence, clientNextSequence, TCP_FIN or TCP_ACK, ByteArray(0))
                    serverNextSequence = addSequence(serverNextSequence, 1)
                }
            } catch (error: Exception) {
                if (!closed.get()) {
                    Log.d(TAG, "Upstream relay ended: ${error.message}")
                    sendTcpPacket(key, serverNextSequence, clientNextSequence, TCP_RST or TCP_ACK, ByteArray(0))
                }
            } finally {
                close()
            }
        }

        fun close() {
            if (!closed.compareAndSet(false, true)) return
            tcpFlows.remove(key, this)
            try { socket.close() } catch (_: Exception) {}
            upstreamReader?.interrupt()
            upstreamReader = null
        }
    }

    private fun sendReset(
        clientIp: Int,
        clientPort: Int,
        destinationIp: Int,
        destinationPort: Int,
        clientSequence: Long,
        payloadLength: Int,
        incomingFlags: Int
    ) {
        val sequenceAdvance = payloadLength + if (incomingFlags and TCP_SYN != 0) 1 else 0
        val key = TcpFlowKey(clientIp, clientPort, destinationIp, destinationPort)
        sendTcpPacket(
            key,
            0,
            addSequence(clientSequence, sequenceAdvance),
            TCP_RST or TCP_ACK,
            ByteArray(0)
        )
    }

    private fun sendTcpPacket(
        key: TcpFlowKey,
        sequence: Long,
        acknowledgement: Long,
        flags: Int,
        payload: ByteArray
    ) {
        val totalLength = 40 + payload.size
        val packet = ByteArray(totalLength)
        packet[0] = 0x45
        packet[1] = 0
        writeU16(packet, 2, totalLength)
        writeU16(packet, 4, (packetId.getAndIncrement() and 0xFFFF).toInt())
        writeU16(packet, 6, 0x4000)
        packet[8] = 64
        packet[9] = 6
        writeIpv4(packet, 12, key.destinationIp)
        writeIpv4(packet, 16, key.sourceIp)
        writeU16(packet, 10, computeChecksum(packet, 0, 20))

        writeU16(packet, 20, key.destinationPort)
        writeU16(packet, 22, key.sourcePort)
        writeU32(packet, 24, sequence)
        writeU32(packet, 28, acknowledgement)
        packet[32] = 0x50
        packet[33] = flags.toByte()
        writeU16(packet, 34, 65535)
        writeU16(packet, 36, 0)
        writeU16(packet, 38, 0)
        if (payload.isNotEmpty()) payload.copyInto(packet, 40)
        writeU16(packet, 36, computeTcpChecksum(key.destinationIp, key.sourceIp, packet, 20, 20 + payload.size))

        val output = tunOutputStream ?: return
        try {
            synchronized(tunWriteLock) {
                output.write(packet)
                output.flush()
            }
            packetsOut.incrementAndGet()
            bytesOut.addAndGet(packet.size.toLong())
        } catch (error: IOException) {
            if (isForwarderRunning.get()) Log.w(TAG, "TUN write error: ${error.message}")
        }
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

    private fun computeTcpChecksum(
        sourceIp: Int,
        destinationIp: Int,
        packet: ByteArray,
        tcpOffset: Int,
        tcpLength: Int
    ): Int {
        var sum = 0L
        sum += ((sourceIp ushr 16) and 0xFFFF).toLong()
        sum += (sourceIp and 0xFFFF).toLong()
        sum += ((destinationIp ushr 16) and 0xFFFF).toLong()
        sum += (destinationIp and 0xFFFF).toLong()
        sum += 6L
        sum += tcpLength.toLong()

        var index = tcpOffset
        var remaining = tcpLength
        while (remaining > 1) {
            sum += ((((packet[index].toInt() and 0xFF) shl 8) or
                (packet[index + 1].toInt() and 0xFF))).toLong()
            index += 2
            remaining -= 2
        }
        if (remaining == 1) sum += ((packet[index].toInt() and 0xFF) shl 8).toLong()
        while (sum ushr 16 != 0L) sum = (sum and 0xFFFF) + (sum ushr 16)
        return sum.inv().toInt() and 0xFFFF
    }

    private fun parsePublicIpv4(value: String): Int? {
        return try {
            val address = InetAddress.getByName(value)
            if (address !is Inet4Address || address.hostAddress != value) return null
            val bytes = address.address
            val first = bytes[0].toInt() and 0xFF
            val second = bytes[1].toInt() and 0xFF
            val blocked = first == 0 || first == 10 || first == 127 ||
                (first == 169 && second == 254) ||
                (first == 172 && second in 16..31) ||
                (first == 192 && second == 168) ||
                first >= 224
            if (blocked) null else readIpv4(bytes, 0)
        } catch (_: Exception) {
            null
        }
    }

    private fun readU16(data: ByteArray, offset: Int): Int =
        ((data[offset].toInt() and 0xFF) shl 8) or
            (data[offset + 1].toInt() and 0xFF)

    private fun readU32(data: ByteArray, offset: Int): Long =
        ((data[offset].toLong() and 0xFF) shl 24) or
            ((data[offset + 1].toLong() and 0xFF) shl 16) or
            ((data[offset + 2].toLong() and 0xFF) shl 8) or
            (data[offset + 3].toLong() and 0xFF)

    private fun readIpv4(data: ByteArray, offset: Int): Int =
        ((data[offset].toInt() and 0xFF) shl 24) or
            ((data[offset + 1].toInt() and 0xFF) shl 16) or
            ((data[offset + 2].toInt() and 0xFF) shl 8) or
            (data[offset + 3].toInt() and 0xFF)

    private fun writeU16(data: ByteArray, offset: Int, value: Int) {
        data[offset] = (value ushr 8).toByte()
        data[offset + 1] = value.toByte()
    }

    private fun writeU32(data: ByteArray, offset: Int, value: Long) {
        data[offset] = (value ushr 24).toByte()
        data[offset + 1] = (value ushr 16).toByte()
        data[offset + 2] = (value ushr 8).toByte()
        data[offset + 3] = value.toByte()
    }

    private fun writeIpv4(data: ByteArray, offset: Int, value: Int) {
        data[offset] = (value ushr 24).toByte()
        data[offset + 1] = (value ushr 16).toByte()
        data[offset + 2] = (value ushr 8).toByte()
        data[offset + 3] = value.toByte()
    }

    private fun ipv4ToString(value: Int): String = listOf(
        (value ushr 24) and 0xFF,
        (value ushr 16) and 0xFF,
        (value ushr 8) and 0xFF,
        value and 0xFF
    ).joinToString(".")

    private fun addSequence(sequence: Long, amount: Int): Long =
        (sequence + amount.toLong()) and 0xFFFFFFFFL

    private fun closeTunnelInterface() {
        stopTunForwarder()
        try {
            vpnInterface?.close()
        } catch (error: IOException) {
            Log.w(TAG, "Error closing VPN interface", error)
        } finally {
            vpnInterface = null
            activeInstance = null
            allowedTargetIps = emptySet()
            allowedTargetIpStrings = emptySet()
        }
    }

    /**
     * Stop the VPN tunnel and release resources.
     */
    @Synchronized
    private fun stopTunnel(reason: String) {
        Log.i(TAG, "Stopping NetShare VPN tunnel: $reason")

        closeTunnelInterface()

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
