package com.clinicvoiceroom.staff

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HybridClinicalUnitRiskTest {
    @Test
    fun procedureShotCountRemainsOnPrimaryPath() {
        val decision = classifyHybridTranslationRisk(
            sourceText = "600\uC0F7\uC744 \uC9C4\uD589\uD569\uB2C8\uB2E4.",
            translatedText = "We will perform 600 shots.",
            sourceTranscriptComplete = true
        )

        assertTrue(decision.reasons.contains("unit"))
    }

    @Test
    fun ordinaryVisitCountDoesNotBecomeNumericHighRisk() {
        val decision = classifyHybridTranslationRisk(
            sourceText = "2\uD68C \uBC29\uBB38\uD574 \uC8FC\uC138\uC694.",
            translatedText = "Please visit twice.",
            sourceTranscriptComplete = true
        )

        assertFalse(decision.reasons.contains("unit"))
        assertFalse(decision.reasons.contains("money"))
    }
}
