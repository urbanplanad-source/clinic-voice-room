package com.clinicvoiceroom.staff

internal data class FieldDiagnostics(
    val versionName: String,
    val versionCode: Int,
    val buildType: String,
    val backendHost: String,
    val sessionState: String,
    val roomConnectionState: String,
    val microphonePermission: String,
    val audioOutputs: String,
    val ttsState: String,
    val pendingQualityMetrics: Int,
    val lastExternalKey: String,
    val deviceSummary: String
) {
    fun rows(): List<Pair<String, String>> = listOf(
        "앱 버전" to "$versionName ($versionCode)",
        "빌드 종류" to buildType,
        "서버" to backendHost,
        "직원 세션" to sessionState,
        "통역방 연결" to roomConnectionState,
        "마이크 권한" to microphonePermission,
        "감지된 음성 출력" to audioOutputs,
        "음성 재생" to ttsState,
        "전송 대기 품질 지표" to "${pendingQualityMetrics}건",
        "마지막 외부키" to lastExternalKey,
        "기기" to deviceSummary
    )

    fun copyText(): String = buildString {
        appendLine("MediVoice 현장 진단")
        rows().forEach { (label, value) -> appendLine("$label: $value") }
        append("개인정보, 번역문, 오디오 및 로그인 정보는 포함되지 않았습니다.")
    }
}
