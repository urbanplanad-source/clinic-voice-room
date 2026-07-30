package com.clinicvoiceroom.staff

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RealtimeTurnPolicyTest {
    @Test
    fun onlyCurrentResponseIdIsAccepted() {
        assertTrue(matchesRealtimeResponseId("resp-current", "resp-current"))
        assertFalse(matchesRealtimeResponseId("resp-current", ""))
        assertFalse(matchesRealtimeResponseId("resp-current", "resp-previous"))
        assertFalse(matchesRealtimeResponseId(null, "resp-current"))
    }
}
