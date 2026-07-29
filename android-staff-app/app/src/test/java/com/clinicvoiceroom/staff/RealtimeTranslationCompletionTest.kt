package com.clinicvoiceroom.staff

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RealtimeTranslationCompletionTest {
    @Test
    fun transcriptDeltasAreNotCompleteBeforeSessionClosed() {
        val completion = realtimeTranslationCompletion(
            sessionClosed = false,
            sourceText = "\uC548\uB155\uD558\uC138\uC694.",
            translatedText = "Hello."
        )

        assertFalse(completion.sourceTranscriptComplete)
        assertFalse(completion.outputTranscriptComplete)
        assertFalse(completion.settled)
    }

    @Test
    fun sessionClosedCompletesBothNonBlankTranscripts() {
        val completion = realtimeTranslationCompletion(
            sessionClosed = true,
            sourceText = "\uC548\uB155\uD558\uC138\uC694.",
            translatedText = "Hello."
        )

        assertTrue(completion.sourceTranscriptComplete)
        assertTrue(completion.outputTranscriptComplete)
        assertTrue(completion.settled)
    }

    @Test
    fun sessionClosedDoesNotSettleWhenOutputIsMissing() {
        val completion = realtimeTranslationCompletion(
            sessionClosed = true,
            sourceText = "\uC548\uB155\uD558\uC138\uC694.",
            translatedText = ""
        )

        assertTrue(completion.sourceTranscriptComplete)
        assertFalse(completion.outputTranscriptComplete)
        assertFalse(completion.settled)
    }
}
