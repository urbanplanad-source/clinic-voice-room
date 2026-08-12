package com.clinicvoiceroom.staff

import java.text.Normalizer
import java.util.Locale

internal data class AndroidMedicalTranscriptionSafetyResult(
    val text: String,
    val corrected: Boolean,
    val ruleId: String = ""
)

private data class AndroidMedicalTranscriptionSafetyRule(
    val id: String,
    val canonical: String,
    val observedVariants: Set<String>
)

private fun medicalTranscriptionSafetyKey(value: String): String =
    Normalizer.normalize(value, Normalizer.Form.NFKC)
        .lowercase(Locale.KOREA)
        .replace(Regex("[^0-9a-z가-힣]"), "")

private val androidMedicalTranscriptionSafetyRules = listOf(
    AndroidMedicalTranscriptionSafetyRule(
        id = "current_herbal_medicines",
        canonical = "복용 중인 한약과 건강보조제를 모두 말씀해 주세요.",
        observedVariants = setOf(
            "병중인 한약과 건강 보조제를 모두 말씀해 주세요.",
            "우경 중인 한약과 건강보조제를 모두 말씀해 주세요."
        )
    ),
    AndroidMedicalTranscriptionSafetyRule(
        id = "medicinal_herb_allergy_context",
        canonical = "특정 약재에 알레르기가 있나요?",
        observedVariants = setOf("특정 약제에 알레르기가 있나요?")
    ),
    AndroidMedicalTranscriptionSafetyRule(
        id = "thermage_flx_shots",
        canonical = "써마지 FLX 600샷으로 진행하겠습니다.",
        observedVariants = setOf(
            "삼아지에프렉스의 600샷으로 진행하겠습니다.",
            "서머지 FLX 600샷으로 진행하겠습니다."
        )
    ),
    AndroidMedicalTranscriptionSafetyRule(
        id = "ultherapy_prime_bilateral_shots",
        canonical = "울쎄라 프라임은 오른쪽에 300샷, 왼쪽에 300샷입니다.",
        observedVariants = setOf(
            "울산의 프라임은 오른쪽에 300샷과 왼쪽에 300샷입니다.",
            "울쎄라피 프라임은 오른쪽에 300샷, 왼쪽에 300샷입니다."
        )
    ),
    AndroidMedicalTranscriptionSafetyRule(
        id = "rejuran_hb_dose",
        canonical = "리쥬란 HB 2cc를 눈 밑에 주입합니다.",
        observedVariants = setOf(
            "레주란 HB ECC를 눈밑에 주입합니다.",
            "리즈란 HB ECC를 눈 밑에 주입합니다.",
            "리쥬란 HB ECC를 눈밑에 주입합니다.",
            "리쥬란 HB EC씨를 눈 밑에 주입합니다.",
            "리쥬란 HB 이시씨를 눈 밑에 주입합니다."
        )
    ),
    AndroidMedicalTranscriptionSafetyRule(
        id = "re2o_skin_booster_question",
        canonical = "Re2O 스킨부스터 시술이 맞나요?",
        observedVariants = setOf(
            "리쥬 스킨부스터 시술이 맞나요?",
            "혹시 Re2O 스킨부스터 시술이 맞나요?",
            "Re2O 스킨부스터 시술이 혹시 맞나요?"
        )
    ),
    AndroidMedicalTranscriptionSafetyRule(
        id = "implant_documentation",
        canonical = "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
        observedVariants = setOf(
            "고형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
            "모형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
            "공약물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
            "도형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다."
        )
    )
)

internal fun resolveAndroidMedicalTranscriptionSafety(
    transcript: String
): AndroidMedicalTranscriptionSafetyResult {
    val original = transcript.trim()
    if (original.isBlank()) return AndroidMedicalTranscriptionSafetyResult(original, corrected = false)

    val inputKey = medicalTranscriptionSafetyKey(original)
    for (rule in androidMedicalTranscriptionSafetyRules) {
        if (inputKey == medicalTranscriptionSafetyKey(rule.canonical)) {
            return AndroidMedicalTranscriptionSafetyResult(original, corrected = false, ruleId = rule.id)
        }
        if (rule.observedVariants.any { variant -> inputKey == medicalTranscriptionSafetyKey(variant) }) {
            return AndroidMedicalTranscriptionSafetyResult(rule.canonical, corrected = true, ruleId = rule.id)
        }
    }

    return AndroidMedicalTranscriptionSafetyResult(original, corrected = false)
}
