package com.clinicvoiceroom.staff

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LocalMetricOutboxTest {
    @Test
    fun `keeps only the newest bounded payloads`() {
        val outbox = LocalMetricOutbox(maxEntries = 2)

        outbox.enqueue("first")
        outbox.enqueue("second")
        outbox.enqueue("third")

        assertEquals(listOf("second", "third"), outbox.snapshot())
        assertEquals(2, outbox.size())
    }

    @Test
    fun `preserves ordered updates for the same event`() {
        val outbox = LocalMetricOutbox()

        outbox.enqueue("event-result")
        outbox.enqueue("event-audio-started")

        assertEquals(listOf("event-result", "event-audio-started"), outbox.snapshot())
    }

    @Test
    fun `removes only the delivered head`() {
        val outbox = LocalMetricOutbox(listOf("first", "second"))

        assertEquals("first", outbox.peek())
        outbox.removeHead()

        assertEquals("second", outbox.peek())
    }

    @Test
    fun `ignores blank payloads and can clear`() {
        val outbox = LocalMetricOutbox(listOf("saved"))

        outbox.enqueue(" ")
        assertEquals(listOf("saved"), outbox.snapshot())

        outbox.clear()
        assertNull(outbox.peek())
    }
}
