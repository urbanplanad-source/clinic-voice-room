package com.clinicvoiceroom.staff

import java.util.Locale

private val sideEffectCuePattern = Regex(
    """(?:부작용|이상\s*반응|副作用|不良反[应應]|side\s*effects?|adverse\s*(?:effect|reaction)s?)""",
    RegexOption.IGNORE_CASE
)

private val generatedReplyPrefixPattern = Regex(
    """^(?:네[,，\s]|예[,，\s]|안녕하세요[,，\s]|はい[,、\s]|かしこまりました|好的[,，\s]|您好[,，\s]|sure\b|certainly\b|hello[,!\s])""",
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

private val questionCuePatterns = listOf(
    Regex("""[?？]\s*$"""),
    Regex("""(?:나요|까요|습니까|인가요|있나요|없나요|되나요|맞나요)\s*[.!。]?$"""),
    Regex("""(?:ですか|ますか|でしょうか|ませんか|なのか)\s*[。.!]?$"""),
    Regex("""(?:吗|嗎|呢|么|麼)\s*[。.!]?$"""),
    Regex("""^(?:who|what|when|where|why|how|do|does|did|is|are|was|were|can|could|would|will|have|has)\b""", RegexOption.IGNORE_CASE)
)

private fun compactValidationText(text: String): String = text.replace(Regex("\\s+"), " ").trim()

private fun looksLikeQuestion(text: String): Boolean {
    val compact = compactValidationText(text)
    return compact.isNotBlank() && questionCuePatterns.any { it.containsMatchIn(compact) }
}

private fun hasSuspiciousLengthDifference(sourceText: String, translatedText: String): Boolean {
    val sourceLength = compactValidationText(sourceText).length
    val translatedLength = compactValidationText(translatedText).length
    if (sourceLength == 0 || translatedLength == 0) return false

    val shorter = minOf(sourceLength, translatedLength)
    val longer = maxOf(sourceLength, translatedLength)
    return longer - shorter >= 18 && longer >= shorter * 3
}

private fun hasGeneratedReplyPrefix(sourceText: String, translatedText: String): Boolean {
    val source = compactValidationText(sourceText)
    val translated = compactValidationText(translatedText)
    return generatedReplyPrefixPattern.containsMatchIn(translated) &&
        !generatedReplyPrefixPattern.containsMatchIn(source)
}

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

    if (translatedTextContainsNumericCue(source) || translatedTextContainsNumericCue(translated)) return true
    if (sideEffectCuePattern.containsMatchIn(source) || sideEffectCuePattern.containsMatchIn(translated)) return true
    if (looksLikeQuestion(source) != looksLikeQuestion(translated)) return true
    if (hasSuspiciousLengthDifference(source, translated)) return true
    if (hasGeneratedReplyPrefix(source, translated)) return true

    return false
}

internal fun planLocalTranslationValidation(
    direction: String,
    isInstantTemplate: Boolean,
    sourceTranscriptComplete: Boolean,
    targetLanguageMismatch: Boolean,
    sourceText: String,
    translatedText: String,
    shortTurnCandidate: Boolean
): LocalTranslationValidationPlan {
    if (isInstantTemplate || !sourceTranscriptComplete) {
        return LocalTranslationValidationPlan(
            candidate = false,
            required = false,
            force = false,
            forceReason = ""
        )
    }

    val patientToKoreanPreOutput = requiresPatientToKoreanPreOutputValidation(
        direction = direction,
        isInstantTemplate = isInstantTemplate,
        sourceTranscriptComplete = sourceTranscriptComplete
    )
    val synchronousRisk = shouldSynchronouslyValidateLocalTranslation(sourceText, translatedText)
    val forceReason = when {
        targetLanguageMismatch -> "target_language_mismatch"
        patientToKoreanPreOutput -> "patient_to_ko_pre_output"
        synchronousRisk -> "high_risk_translation"
        else -> ""
    }
    val force = targetLanguageMismatch || patientToKoreanPreOutput || synchronousRisk
    val candidate = force || shortTurnCandidate

    return LocalTranslationValidationPlan(
        candidate = candidate,
        required = candidate && force,
        force = force,
        forceReason = forceReason
    )
}
