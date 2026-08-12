package com.clinicvoiceroom.staff

import kotlin.math.max
import kotlin.math.sqrt

internal const val StaffAutoStopSpeechRms = 900.0
internal const val StaffAutoStopSpeechPeak = 2600
internal const val StaffNoVoiceWarningMs = 2500L
internal const val StaffMicLevelUpdateMs = 100L
internal const val StaffAutoStopLongSpeechSpanMs = 2500L
internal const val StaffAutoStopLongSpeechVoiceMs = 900L
internal const val StaffAutoStopLongSilenceMs = 3400L
internal const val StaffAutoStopNearVoiceGraceMs = 1200L

internal data class VoiceLevelAnalysis(
    val detected: Boolean,
    val bucket: Int
)

internal fun analyzeVoiceLevel(buffer: ShortArray, count: Int): VoiceLevelAnalysis {
    if (count <= 0) return VoiceLevelAnalysis(detected = false, bucket = 0)

    var sumSquares = 0.0
    var peak = 0
    for (index in 0 until count) {
        val value = buffer[index].toInt()
        val magnitude = if (value < 0) -value else value
        if (magnitude > peak) peak = magnitude
        sumSquares += value.toDouble() * value.toDouble()
    }

    val rms = sqrt(sumSquares / count)
    val detected = rms >= StaffAutoStopSpeechRms || peak >= StaffAutoStopSpeechPeak
    val ratio = max(rms / StaffAutoStopSpeechRms, peak.toDouble() / StaffAutoStopSpeechPeak)
    val bucket = when {
        ratio < 0.35 -> 0
        ratio < 0.65 -> 1
        ratio < 1.0 -> 2
        ratio < 2.0 -> 3
        else -> 4
    }
    return VoiceLevelAnalysis(detected = detected, bucket = bucket)
}

internal fun staffAutoStopSilenceThresholdMs(voiceMs: Long, voiceSpanMs: Long): Long {
    return if (
        voiceMs >= StaffAutoStopLongSpeechVoiceMs ||
        voiceSpanMs >= StaffAutoStopLongSpeechSpanMs
    ) {
        StaffAutoStopLongSilenceMs
    } else {
        StaffAutoStopSilenceMs
    }
}

internal fun shouldAutoStopStaffRecording(
    voiceMs: Long,
    recordingMs: Long,
    silenceMs: Long,
    nearVoiceSilenceMs: Long,
    voiceSpanMs: Long
): Boolean {
    if (voiceMs < StaffAutoStopMinVoiceMs || recordingMs < StaffAutoStopMinRecordingMs) return false
    val requiredSilenceMs = staffAutoStopSilenceThresholdMs(voiceMs, voiceSpanMs)
    return silenceMs >= requiredSilenceMs && nearVoiceSilenceMs >= StaffAutoStopNearVoiceGraceMs
}
