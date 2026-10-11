package com.example.netshare_node_app

import java.io.IOException
import kotlin.math.max
import kotlin.math.min

/** Shared, fail-closed TUN forwarding budget. Persistence reserves ahead so
 * process death can under-use a quota but cannot reopen already spent quota. */
class TrafficPolicy(
    private val limit: Long,
    initialUsed: Long,
    private val uploadMbps: Double,
    private val downloadMbps: Double,
    private val expiresAtMs: Long,
    private val persist: (Long) -> Boolean,
    private val nowMs: () -> Long = { System.currentTimeMillis() },
    private val nowNanos: () -> Long = { System.nanoTime() },
    private val sleepNanos: (Long) -> Unit = { Thread.sleep(it / 1000000, (it % 1000000).toInt()) }
) {
    private var used = initialUsed
    private var reserved = initialUsed
    private var uploadNext = 0L
    private var downloadNext = 0L
    init {
        require(limit > 0 && initialUsed >= 0)
        require(uploadMbps.isFinite() && uploadMbps > 0 && downloadMbps.isFinite() && downloadMbps > 0)
    }
    @Synchronized fun consume(bytes: Int, upload: Boolean) {
        if (bytes <= 0 || nowMs() >= expiresAtMs || used > limit - bytes) throw IOException("Daily traffic allowance exhausted or expired")
        val nextUsed = used + bytes
        if (nextUsed > reserved) {
            val nextReserved = min(limit, max(nextUsed, used + 65536))
            if (!persist(nextReserved)) throw IOException("Cannot persist traffic allowance")
            reserved = nextReserved
        }
        used = nextUsed
        val now = nowNanos()
        val duration = kotlin.math.ceil(bytes * 8000.0 / (if (upload) uploadMbps else downloadMbps)).toLong()
        val next = max(now, if (upload) uploadNext else downloadNext) + duration
        if (upload) uploadNext = next else downloadNext = next
        if (next > now) sleepNanos(next - now)
        if (nowMs() >= expiresAtMs) throw IOException("Daily traffic policy expired")
    }
}
