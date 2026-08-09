package com.clinicvoiceroom.staff

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FieldDiagnosticsTest {
    @Test
    fun `copy text contains operational state without sensitive content`() {
        val diagnostics = FieldDiagnostics(
            versionName = "0.3.39",
            versionCode = 51,
            buildType = "field",
            backendHost = "voice.insightmedi.co.kr",
            sessionState = "로그인됨",
            roomConnectionState = "연결됨",
            microphonePermission = "허용됨",
            audioOutputs = "내장 스피커",
            ttsState = "준비됨",
            pendingQualityMetrics = 2,
            lastExternalKey = "없음",
            deviceSummary = "Test Device · Android 15"
        )

        val copied = diagnostics.copyText()

        assertTrue(copied.contains("0.3.39 (51)"))
        assertTrue(copied.contains("전송 대기 품질 지표: 2건"))
        assertTrue(copied.contains("개인정보, 번역문, 오디오"))
        assertFalse(copied.contains("email"))
        assertFalse(copied.contains("password"))
    }
}
