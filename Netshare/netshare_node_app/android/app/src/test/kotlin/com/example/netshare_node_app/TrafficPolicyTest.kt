package com.example.netshare_node_app

import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class TrafficPolicyTest {
    @Test fun enforcesCombinedQuotaAndPersistsBeforeTraffic() {
        var reserved = 0L
        val policy = TrafficPolicy(100, 0, 1.0, 1.0, Long.MAX_VALUE, { reserved = it; true }, sleepNanos = {})
        policy.consume(60, true); policy.consume(40, false)
        assertEquals(100L, reserved)
        try { policy.consume(1, true); fail("Allowed quota overspend") } catch (_: IOException) {}
    }
    @Test fun crashRestartDoesNotReopenReservedQuota() {
        var reserved = 0L
        TrafficPolicy(100000, 0, 1.0, 1.0, Long.MAX_VALUE, { reserved = it; true }, sleepNanos = {}).consume(10, true)
        assertEquals(65536L, reserved)
        val restarted = TrafficPolicy(100000, reserved, 1.0, 1.0, Long.MAX_VALUE, { true }, sleepNanos = {})
        try { restarted.consume(40000, false); fail("Reopened reserved allowance") } catch (_: IOException) {}
    }
    @Test fun independentDirectionCapsUseMonotonicTime() {
        val delays = mutableListOf<Long>()
        val policy = TrafficPolicy(10000, 0, 1.0, 2.0, Long.MAX_VALUE, { true }, nowNanos = { 0 }, sleepNanos = { delays.add(it) })
        policy.consume(1000, true); policy.consume(1000, false)
        assertEquals(listOf(8000000L, 4000000L), delays)
    }
    @Test fun expiredPolicyAndPersistenceFailureFailClosed() {
        for (policy in listOf(TrafficPolicy(100, 0, 1.0, 1.0, 0, { true }),
            TrafficPolicy(100, 0, 1.0, 1.0, Long.MAX_VALUE, { false }))) {
            try { policy.consume(1, true); fail("Expected fail-closed") } catch (_: IOException) {}
        }
    }
    @Test fun concurrentConsumersCannotOverspend() {
        val policy = TrafficPolicy(100, 0, 100.0, 100.0, Long.MAX_VALUE, { true }, sleepNanos = {})
        val accepted = java.util.concurrent.atomic.AtomicInteger(0)
        val threads = (1..10).map { Thread { try { policy.consume(30, true); accepted.incrementAndGet() } catch (_: IOException) {} }.apply { start() } }
        threads.forEach { it.join() }; assertEquals(3, accepted.get())
    }
}
