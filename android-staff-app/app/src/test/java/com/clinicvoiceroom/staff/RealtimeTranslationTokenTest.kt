package com.clinicvoiceroom.staff

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RealtimeTranslationTokenTest {
    private fun token(expiresAt: Long?) = AndroidRealtimeTranslationToken(
        value = "test-secret",
        model = "gpt-realtime-translate",
        mode = "low_risk_main",
        expiresAtEpochSeconds = expiresAt
    )

    @Test
    fun reusesSecretWhileMoreThanSafetyWindowRemains() {
        assertTrue(token(expiresAt = 1_000L).isReusable(nowEpochSeconds = 980L))
    }

    @Test
    fun retiresSecretInsideSafetyWindow() {
        assertFalse(token(expiresAt = 1_000L).isReusable(nowEpochSeconds = 990L))
    }

    @Test
    fun doesNotCacheSecretWithoutExpiry() {
        assertFalse(token(expiresAt = null).isReusable(nowEpochSeconds = 980L))
    }
}
