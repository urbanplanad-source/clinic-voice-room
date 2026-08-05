package com.clinicvoiceroom.staff

private val koreanTtsCcPattern = Regex(
    "(?i)(?<![A-Za-z0-9])(\\p{Nd}+(?:[.,]\\p{Nd}+)?)\\s*(?:c\\s*c|㎤)(?![A-Za-z0-9])"
)

internal fun normalizeKoreanTtsText(text: String): String =
    koreanTtsCcPattern.replace(text) { match -> "${match.groupValues[1]}씨씨" }
