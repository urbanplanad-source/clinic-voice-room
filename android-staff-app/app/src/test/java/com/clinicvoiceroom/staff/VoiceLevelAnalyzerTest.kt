package com.clinicvoiceroom.staff

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VoiceLevelAnalyzerTest {
    @Test
    fun keepsExistingSpeechThresholds() {
        assertEquals(900.0, StaffAutoStopSpeechRms, 0.0)
        assertEquals(2600, StaffAutoStopSpeechPeak)
        assertEquals(2400L, StaffAutoStopSilenceMs)
        assertEquals(3400L, StaffAutoStopLongSilenceMs)
        assertEquals(1200L, StaffAutoStopNearVoiceGraceMs)
        assertEquals(2500L, StaffNoVoiceWarningMs)
        assertEquals(100L, StaffMicLevelUpdateMs)
    }

    @Test
    fun returnsSilentLevelForEmptyAndZeroBuffers() {
        assertEquals(VoiceLevelAnalysis(false, 0), analyzeVoiceLevel(shortArrayOf(), 0))
        assertEquals(VoiceLevelAnalysis(false, 0), analyzeVoiceLevel(ShortArray(64), 64))
    }

    @Test
    fun mapsRmsIntoStableFiveLevelBuckets() {
        assertEquals(1, analyzeVoiceLevel(ShortArray(64) { 400 }, 64).bucket)
        assertEquals(2, analyzeVoiceLevel(ShortArray(64) { 700 }, 64).bucket)
        assertEquals(3, analyzeVoiceLevel(ShortArray(64) { 1000 }, 64).bucket)
        assertEquals(4, analyzeVoiceLevel(ShortArray(64) { 2000 }, 64).bucket)
    }

    @Test
    fun preservesPeakBasedSpeechDetection() {
        val samples = ShortArray(64)
        samples[0] = StaffAutoStopSpeechPeak.toShort()
        val analysis = analyzeVoiceLevel(samples, samples.size)
        assertTrue(analysis.detected)
        assertEquals(3, analysis.bucket)
    }

    @Test
    fun doesNotMarkSubThresholdSpeechAsDetected() {
        val analysis = analyzeVoiceLevel(ShortArray(64) { 700 }, 64)
        assertFalse(analysis.detected)
    }

    @Test
    fun keepsShortUtteranceAutoStopAtExistingLatency() {
        assertEquals(2400L, staffAutoStopSilenceThresholdMs(voiceMs = 500L, voiceSpanMs = 1800L))
        assertTrue(shouldAutoStopStaffRecording(500L, 4000L, 2400L, 2400L, 1800L))
    }

    @Test
    fun protectsLongUtteranceAcrossNaturalMidSentencePause() {
        assertEquals(3400L, staffAutoStopSilenceThresholdMs(voiceMs = 950L, voiceSpanMs = 3000L))
        assertFalse(shouldAutoStopStaffRecording(950L, 5000L, 2400L, 2400L, 3000L))
        assertTrue(shouldAutoStopStaffRecording(950L, 6500L, 3400L, 3400L, 3000L))
    }

    @Test
    fun nearThresholdVoicePreventsPrematureStop() {
        assertFalse(shouldAutoStopStaffRecording(950L, 6500L, 3600L, 600L, 3000L))
        assertTrue(shouldAutoStopStaffRecording(950L, 7200L, 4100L, 1200L, 3000L))
    }

    @Test
    fun keepsShortExperimentalTurnsOnFastTranscriptWait() {
        val timing = localRealtimeTurnTiming(experimentalFastTurn = true, durationSeconds = 5)
        assertEquals(250L, timing.inputTranscriptFastWaitMs)
    }

    @Test
    fun givesLongExperimentalTurnsEnoughTimeForTranscriptCompletion() {
        val timing = localRealtimeTurnTiming(experimentalFastTurn = true, durationSeconds = 6)
        assertEquals(650L, timing.inputTranscriptFastWaitMs)
        assertEquals(650L, timing.inputTranscriptNumericWaitMs)
    }

    @Test
    fun leavesStandardRealtimeTimingUnchangedForLongTurns() {
        val timing = localRealtimeTurnTiming(experimentalFastTurn = false, durationSeconds = 12)
        assertEquals(250L, timing.inputTranscriptFastWaitMs)
    }

    @Test
    fun themeUsesMediVoiceSemanticColors() {
        assertEquals(Trust, MediVoiceLightColorScheme.primary)
        assertEquals(Mint, MediVoiceLightColorScheme.secondary)
        assertEquals(Mist, MediVoiceLightColorScheme.background)
        assertEquals(Ink, MediVoiceLightColorScheme.onSurface)
        assertEquals(Coral, MediVoiceLightColorScheme.error)
    }
}
