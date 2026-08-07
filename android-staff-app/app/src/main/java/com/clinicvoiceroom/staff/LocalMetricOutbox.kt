package com.clinicvoiceroom.staff

internal class LocalMetricOutbox(
    initialPayloads: List<String> = emptyList(),
    private val maxEntries: Int = 200
) {
    private val payloads = ArrayDeque<String>()

    init {
        initialPayloads.filter { it.isNotBlank() }.takeLast(maxEntries).forEach(payloads::addLast)
    }

    fun enqueue(payload: String) {
        if (payload.isBlank()) return
        payloads.addLast(payload)
        while (payloads.size > maxEntries) payloads.removeFirst()
    }

    fun peek(): String? = payloads.firstOrNull()

    fun removeHead() {
        if (payloads.isNotEmpty()) payloads.removeFirst()
    }

    fun clear() = payloads.clear()

    fun size(): Int = payloads.size

    fun snapshot(): List<String> = payloads.toList()
}
