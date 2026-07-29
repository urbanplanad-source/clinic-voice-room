package com.clinicvoiceroom.staff

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HybridTranslationRiskTest {
    @Test
    fun moneySentenceDoesNotTreatCopulaAsMouth() {
        val decision = classifyHybridTranslationRisk(
            sourceText = "\uBE44\uC6A9\uC740 300,000\uC6D0\uC785\uB2C8\uB2E4.",
            translatedText = "The price is 300,000 won.",
            sourceTranscriptComplete = true
        )

        assertTrue(decision.reasons.contains("money"))
        assertFalse(decision.reasons.contains("body_part"))
    }

    @Test
    fun reservationDoesNotTreatEmbeddedYakAsMedication() {
        val decision = classifyHybridTranslationRisk(
            sourceText = "\uC608\uC57D\uC744 \uB3C4\uC640\uB4DC\uB9B4\uAC8C\uC694.",
            translatedText = "I will help you make a reservation.",
            sourceTranscriptComplete = true
        )

        assertFalse(decision.reasons.contains("clinical_safety"))
    }

    @Test
    fun standaloneMouthAndPainRemainHighRisk() {
        val decision = classifyHybridTranslationRisk(
            sourceText = "\uC785\uC774 \uC544\uD30C\uC694.",
            translatedText = "My mouth hurts.",
            sourceTranscriptComplete = true
        )

        assertTrue(decision.reasons.contains("body_part"))
        assertTrue(decision.reasons.contains("clinical_safety"))
    }

    @Test
    fun englishBodyTermsUseWordBoundaries() {
        val harmless = classifyHybridTranslationRisk(
            sourceText = "The result is charming.",
            translatedText = "\uACB0\uACFC\uAC00 \uB9E4\uB825\uC801\uC785\uB2C8\uB2E4.",
            sourceTranscriptComplete = true
        )
        val bodyPart = classifyHybridTranslationRisk(
            sourceText = "Please raise your arm.",
            translatedText = "\uD314\uC744 \uC62C\uB824 \uC8FC\uC138\uC694.",
            sourceTranscriptComplete = true
        )

        assertFalse(harmless.reasons.contains("body_part"))
        assertTrue(bodyPart.reasons.contains("body_part"))
    }

    @Test
    fun customerWordDoesNotTreatSonAsHand() {
        val decision = classifyHybridTranslationRisk(
            sourceText = "\uC190\uB2D8\uC744 \uC548\uB0B4\uD574 \uC8FC\uC138\uC694.",
            translatedText = "Please guide the customer.",
            sourceTranscriptComplete = true
        )

        assertFalse(decision.reasons.contains("body_part"))
    }
}
