package com.clinicvoiceroom.staff

import org.json.JSONObject

typealias ExperimentalLocalVoiceTranslator = (String, String, ByteArray, Int) -> JSONObject

class ExperimentalFaceToFaceEngine(
    private val translateWithRealtimeFirst: ExperimentalLocalVoiceTranslator,
    private val log: (String) -> Unit
) {
    fun translate(direction: String, patientLanguage: String, pcm: ByteArray, durationSeconds: Int): JSONObject {
        val result = translateWithRealtimeFirst(direction, patientLanguage, pcm, durationSeconds)
        val model = result.optString("model")
        val sourceText = result.optString("sourceText")
        val translatedText = result.optString("translatedText")
        val highRisk = containsHighRiskContent(sourceText) || containsHighRiskContent(translatedText)

        val policy = when {
            model == "instant-template" -> ExperimentalPlaybackPolicy.Template
            highRisk -> ExperimentalPlaybackPolicy.HighRiskReview
            else -> ExperimentalPlaybackPolicy.Realtime
        }

        log("Experimental face-to-face engine: ${policy.logLabel}")
        return result
            .put("experimentalEngine", "realtime-v1")
            .put("experimentalPolicy", policy.id)
            .put("experimentalResultBadge", policy.badge)
            .put("experimentalEngineStatus", policy.status)
            .put("experimentalHighRisk", highRisk)
    }

    private fun containsHighRiskContent(text: String): Boolean {
        if (text.isBlank()) return false
        if (highRiskPatterns.any { it.containsMatchIn(text) }) return true
        return highRiskTerms.any { text.contains(it, ignoreCase = true) }
    }
}

private enum class ExperimentalPlaybackPolicy(
    val id: String,
    val badge: String,
    val status: String,
    val logLabel: String
) {
    Template("template", "템플릿", "템플릿 즉시", "instant-template"),
    Realtime("realtime", "Realtime", "Realtime 처리", "realtime"),
    HighRiskReview("high-risk", "확인 필요", "고위험 확인", "high-risk")
}

private val highRiskTerms = listOf(
    "동의",
    "서명",
    "부작용",
    "이상반응",
    "검사",
    "약",
    "복용",
    "마취",
    "금식",
    "금수",
    "가격",
    "비용",
    "금액",
    "만원",
    "용량",
    "알레르기",
    "임신",
    "흡연",
    "음주",
    "consent",
    "sign",
    "side effect",
    "reaction",
    "test",
    "exam",
    "medicine",
    "medication",
    "dose",
    "dosage",
    "fasting",
    "price",
    "cost",
    "anesthesia",
    "allergy",
    "pregnan"
)

private val highRiskPatterns = listOf(
    Regex("\\d"),
    Regex("\\b(?:mg|ml|cc|krw|won|minutes?|hours?|days?)\\b", RegexOption.IGNORE_CASE)
)
