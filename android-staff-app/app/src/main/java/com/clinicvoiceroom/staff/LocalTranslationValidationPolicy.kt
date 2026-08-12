package com.clinicvoiceroom.staff

import java.util.Locale

private val sideEffectCuePattern = Regex(
    """(?:부작용|(?<!더)(?<!더\s)(?<!그)(?<!그\s)이상\s*반응|반응(?:이|은|가)?\s*이상(?!적)|副作用|不良反[应應]|異常な?\s*反応|异常反应|異常反應|side\s*effects?|adverse\s*(?:effect|reaction)s?|(?:unusual|abnormal)\s+reactions?)""",
    RegexOption.IGNORE_CASE
)
private val amountCuePatterns = listOf(
    Regex("""(?:금액|가격|비용|결제|할부|시술비|진료비|수술비|마취비|치료비|검사비|약값|총액|정가|할인가|할인|예약금|보증금|계약금|잔금|선납|부가세|세금)"""),
    Regex(
        """(?<![가-힣])(?:\d[\d,.]*(?:\s*[백천만억조](?:\s*\d[\d,.]*)?)*|[영공일이삼사오육륙칠팔구]*[십백천만억조][영공일이삼사오육륙칠팔구십백천만억조]*)\s*원(?=$|[^가-힣]|(?:입니다|이에요|예요|이었|부터|까지|정도|가량|대로|씩|짜리|으로|을|를|은|는|이|가|에|도|만))"""
    ),
    Regex("""(?:料金|価格|費用|金額|支払|施術料|診察料|治療費|会計|割引|分割払|(?:\d[\d,.]*|[零〇一二两兩三四五六七八九十百千万萬億亿兆]+)\s*(?:円|ウォン))"""),
    Regex("""(?:价格|價格|费用|費用|金额|金額|付款|支付|收费|收費|诊疗费|診療費|会计|會計|折扣|分期|(?:\d[\d,.]*|[零〇一二两兩三四五六七八九十百千万萬億亿兆]+)\s*(?:元|韩元|韓元))"""),
    Regex(
        """(?:\b(?:prices?|fees?|payments?|installments?|discounts?|krw|jpy|cny|rmb|usd)\b|(?<!at all\s)\bcosts?\b(?![-\s]?effective)|\bdollars?\b|(?:(?:\d[\d,.]*|(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion))*)\s*(?:(?:korean\s+)?won|yen|yuan|dollars?))\b|\bpay(?:ing|ed)?\s+(?:by|with|in|for|now|later|\d))""",
        RegexOption.IGNORE_CASE
    )
)

private val numericPreservationCuePattern = Regex(
    "(?:\\d|\\b(?:one|once|two|twice|three|four|five|six|seven|eight|nine|ten)\\b|[영공일이삼사오육륙칠팔구십백천만억조]+\\s*(?:번|회|일|주|개월|시간|분|개|명|병|정|알|샷|cc|ml|mg|g|kg|mm|cm|iu|원)|(?:하나|한|둘|두|셋|세|넷|네|다섯|여섯|일곱|여덟|아홉|열)\\s*(?:번|회|일|주|개월|시간|분|개|명|병|정|알))",
    RegexOption.IGNORE_CASE
)
private val negationSafetyCuePattern = Regex(
    "(?:않(?:습니다|아요|도록|으면|고)?|마세요|말아\\s*주세요|금지|절대|없(?:습니다|어요|나요)?|\\b(?:do\\s+not|don't|must\\s+not|never|no)\\b)",
    RegexOption.IGNORE_CASE
)
private val emergencySafetyCuePattern = Regex(
    "(?:119|응급|호흡\\s*곤란|의식\\s*변화|의식을\\s*잃|즉시\\s*(?:연락|신고)|emergency|difficulty\\s+breathing|loss\\s+of\\s+consciousness)",
    RegexOption.IGNORE_CASE
)
private val questionSafetyCuePattern = Regex(
    "(?:[?？]|(?:나요|가요|까요|인가요|있나요|없나요|맞나요|습니까|합니까|됩니까|할까요)\\s*[.!?？]*$)",
    RegexOption.IGNORE_CASE
)
private val listSafetyCuePattern = Regex(
    "(?:(?:[,·].*){2}|(?:피어싱|렌즈|의치|보청기|고름|분비물|붉어짐|부종).*(?:피어싱|렌즈|의치|보청기|고름|분비물|붉어짐|부종))",
    RegexOption.IGNORE_CASE
)
private val literalDirectiveCuePattern = Regex(
    "(?:번역(?:은|을)?\\s*(?:하지\\s*말고|말고)|번역하지\\s*말고|(?:대답|답변)(?:하지|은\\s*하지)\\s*말|\\b(?:do\\s+not|don't)\\s+(?:answer|translate)\\b|\\bjust\\s+translate\\b|\\bignore\\s+(?:the\\s+)?(?:previous|prior|above|system)?\\s*instructions?\\b)",
    RegexOption.IGNORE_CASE
)


private val hangulScriptPattern = Regex("[\\u1100-\\u11ff\\u3130-\\u318f\\uac00-\\ud7af]")
private val foreignKoreanTargetScriptPatterns = listOf(
    Regex("[\\u3040-\\u30ff\\u31f0-\\u31ff]"),
    Regex("[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]"),
    Regex("[\\u0e00-\\u0e7f]"),
    Regex("[\\u0400-\\u052f]"),
    Regex("[\\u1800-\\u18af]"),
    Regex("[\\u0600-\\u06ff]")
)
private val latinLetterPattern = Regex("[A-Za-z\\u00c0-\\u024f]")
private val latinWordPattern = Regex("[A-Za-z\\u00c0-\\u024f]+(?:['’-][A-Za-z\\u00c0-\\u024f]+)*")
private val shortForeignReplyPattern = Regex(
    "^(?:yes|no|ok(?:ay)?|sure|thanks?|thank\\s+you|hello|hi|bye)[.!?]*$",
    RegexOption.IGNORE_CASE
)
private val acceptedLatinClinicTokens = setOf(
    "belotero", "botox", "cc", "flx", "hda", "hifu", "iu", "juvelook", "ldm", "ml",
    "pico", "potenza", "prp", "re2o", "rejuran", "restylane", "sculptra", "skinvive",
    "thermage", "ultherapy", "xerf"
)

internal data class LocalTranslationValidationPlan(
    val candidate: Boolean,
    val required: Boolean,
    val force: Boolean,
    val forceReason: String
)


private fun compactValidationText(text: String): String = text.replace(Regex("\\s+"), " ").trim()


private fun isAcceptedLatinClinicPhrase(text: String): Boolean {
    val words = Regex("[a-z0-9]+").findAll(text.lowercase(Locale.ROOT)).map { it.value }.toList()
    return words.isNotEmpty() && words.all { word -> word.all(Char::isDigit) || acceptedLatinClinicTokens.contains(word) }
}

internal fun hasClearKoreanTargetMismatch(sourceText: String, translatedText: String): Boolean {
    val translated = compactValidationText(translatedText)
    if (translated.isBlank()) return false

    val hangulCount = hangulScriptPattern.findAll(translated).count()
    val foreignScriptCount = foreignKoreanTargetScriptPatterns.sumOf { pattern ->
        pattern.findAll(translated).count()
    }
    val latinLetterCount = latinLetterPattern.findAll(translated).count()
    val latinWordCount = latinWordPattern.findAll(translated).count()
    if (hangulCount > 0) {
        return foreignScriptCount >= maxOf(3, hangulCount * 2) ||
            (latinLetterCount >= maxOf(12, hangulCount * 4) && latinWordCount >= 3)
    }

    if (foreignScriptCount >= 1) return true
    if (latinLetterCount == 0 || isAcceptedLatinClinicPhrase(translated)) return false
    if (shortForeignReplyPattern.matches(translated)) return true

    if (latinLetterCount >= 8 && latinWordCount >= 2) return true

    val normalizedSource = sourceText.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]+"), "")
    val normalizedTranslation = translated.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]+"), "")
    return latinLetterCount >= 5 &&
        normalizedSource.isNotBlank() &&
        normalizedSource == normalizedTranslation &&
        !isAcceptedLatinClinicPhrase(sourceText)
}

internal fun hasUsableKoreanTargetRepair(
    sourceText: String,
    repaired: Boolean,
    correctedTranslation: String
): Boolean {
    return repaired &&
        correctedTranslation.isNotBlank() &&
        !hasClearKoreanTargetMismatch(sourceText, correctedTranslation)
}

internal fun requiresPatientToKoreanPreOutputValidation(
    direction: String,
    isInstantTemplate: Boolean,
    sourceTranscriptComplete: Boolean
): Boolean {
    return direction == "patient_to_ko" &&
        !isInstantTemplate &&
        sourceTranscriptComplete
}

internal fun shouldSynchronouslyValidateLocalTranslation(
    sourceText: String,
    translatedText: String
): Boolean {
    val source = compactValidationText(sourceText)
    val translated = compactValidationText(translatedText)
    if (source.isBlank() || translated.isBlank()) return false

    if (amountCuePatterns.any { it.containsMatchIn(source) || it.containsMatchIn(translated) }) return true
    if (sideEffectCuePattern.containsMatchIn(source) || sideEffectCuePattern.containsMatchIn(translated)) return true

    return false
}

internal fun localTranslationSafetyForceReason(
    sourceText: String,
    translatedText: String,
    sourceTranscriptionCorrected: Boolean = false
): String {
    val source = compactValidationText(sourceText)
    val translated = compactValidationText(translatedText)
    if (source.isBlank() || translated.isBlank()) return ""
    if (sourceTranscriptionCorrected) return "source_transcription_corrected"
    if (literalDirectiveCuePattern.containsMatchIn(source)) return "literal_directive_translation"
    if (emergencySafetyCuePattern.containsMatchIn(source)) return "emergency_semantics"
    if (questionSafetyCuePattern.containsMatchIn(source)) return "question_form_preservation"
    if (negationSafetyCuePattern.containsMatchIn(source)) return "negation_semantics"
    if (listSafetyCuePattern.containsMatchIn(source)) return "list_preservation"
    if (numericPreservationCuePattern.containsMatchIn(source)) return "numeric_preservation"
    return ""
}

internal fun planLocalTranslationValidation(
    direction: String,
    isInstantTemplate: Boolean,
    sourceTranscriptComplete: Boolean,
    targetLanguageMismatch: Boolean,
    sourceTranscriptionCorrected: Boolean = false,
    sourceText: String,
    translatedText: String,
    shortTurnCandidate: Boolean
): LocalTranslationValidationPlan {
    if (isInstantTemplate) {
        return LocalTranslationValidationPlan(
            candidate = false,
            required = false,
            force = false,
            forceReason = ""
        )
    }

    if (!sourceTranscriptComplete) {
        return LocalTranslationValidationPlan(
            candidate = true,
            required = true,
            force = true,
            forceReason = "incomplete_source_transcript"
        )
    }

    val patientToKoreanPreOutput = requiresPatientToKoreanPreOutputValidation(
        direction = direction,
        isInstantTemplate = isInstantTemplate,
        sourceTranscriptComplete = sourceTranscriptComplete
    )
    val synchronousRisk = shouldSynchronouslyValidateLocalTranslation(sourceText, translatedText)
    val safetyForceReason = localTranslationSafetyForceReason(
        sourceText = sourceText,
        translatedText = translatedText,
        sourceTranscriptionCorrected = sourceTranscriptionCorrected
    )
    val forceReason = when {
        targetLanguageMismatch -> "target_language_mismatch"
        patientToKoreanPreOutput -> "patient_to_ko_pre_output"
        synchronousRisk -> "high_risk_translation"
        safetyForceReason.isNotBlank() -> safetyForceReason
        else -> ""
    }
    val force = targetLanguageMismatch ||
        patientToKoreanPreOutput ||
        synchronousRisk ||
        safetyForceReason.isNotBlank()
    val candidate = force || shortTurnCandidate

    return LocalTranslationValidationPlan(
        candidate = candidate,
        required = candidate && force,
        force = force,
        forceReason = forceReason
    )
}
