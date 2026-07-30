package com.clinicvoiceroom.staff

private val sideEffectCuePattern = Regex(
    """(?:부작용|이상\s*반응|副作用|不良反[应應]|side\s*effects?|adverse\s*(?:effect|reaction)s?)""",
    RegexOption.IGNORE_CASE
)

private val generatedReplyPrefixPattern = Regex(
    """^(?:네[,，\s]|예[,，\s]|안녕하세요[,，\s]|はい[,、\s]|かしこまりました|好的[,，\s]|您好[,，\s]|sure\b|certainly\b|hello[,!\s])""",
    RegexOption.IGNORE_CASE
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
