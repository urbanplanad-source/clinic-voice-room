package com.clinicvoiceroom.staff

internal data class HybridTranslationRiskDecision(
    val lowRisk: Boolean,
    val reasons: List<String>
)

private val HybridUnitPattern = Regex(
    """(?:\bcc\b|\bml\b|\bmg\b|\bkg\b|\bmm\b|\bcm\b|%|\x{C5D4}\x{D50C})""",
    RegexOption.IGNORE_CASE
)
private val HybridMoneyPattern = Regex(
    """(?:[\x{20A9}\x{00A5}\x{0024}\x{FFE6}\x{FFE5}]\s*\p{Nd}[\p{Nd},.]*(?:\s*(?:\x{B9CC}|\x{CC9C}))?|\p{Nd}[\p{Nd},.]*\s*(?:\x{B9CC}\s*)?(?:\x{C6D0}|\x{5186}|\x{5143}|won|krw|yen|jpy|yuan|cny|rmb|dollars?|usd|euros?|eur))""",
    RegexOption.IGNORE_CASE
)
private val HybridBrandPattern = Regex(
    """(?:\x{C368}\x{B9C8}\x{C9C0}|\x{B9AC}\x{C96C}\x{B780}|\x{B9AC}\x{D22C}\x{C624}|\x{C6B8}\x{C384}\x{B77C}|\x{C96C}\x{BCA0}\x{B8E9}|\x{D3EC}\x{D150}\x{C790}|\x{BCF4}\x{D1A1}\x{C2A4}|\x{D544}\x{B7EC}|thermage|rejuran|re2o|juvelook|ultherapy|potenza|botox|filler|\x{30B5}\x{30FC}\x{30DE}\x{30AF}\x{30FC}\x{30EB}|\x{30EA}\x{30B8}\x{30E5}\x{30E9}\x{30F3}|\x{30EA}\x{30C4}\x{30AA}|\x{30DC}\x{30C8}\x{30C3}\x{30AF}\x{30B9}|\x{30D5}\x{30A3}\x{30E9}\x{30FC}|\x{70ED}\x{739B}\x{5409}|\x{4E3D}\x{73E0}\x{5170}|\x{8089}\x{6BD2}|\x{73BB}\x{5C3F}\x{9178})""",
    RegexOption.IGNORE_CASE
)
private val HybridSafetyPattern = Regex(
    """(?:\x{D1B5}\x{C99D}|\x{C544}\x{D504}|\x{C54C}\x{B808}\x{B974}\x{AE30}|\x{C784}\x{C2E0}|\x{C218}\x{C720}|\x{BD80}\x{C791}\x{C6A9}|\x{B9C8}\x{CDE8}|\x{C57D}|\x{CC98}\x{BC29}|\x{D56D}\x{C0DD}|\x{CD9C}\x{D608}|\x{BD93}|\x{AC10}\x{C5FC}|\x{D749}\x{D130}|\x{C8FC}\x{C0AC}|\x{C2DC}\x{C220}|\x{C218}\x{C220}|\x{B808}\x{C774}\x{C800}|\x{75DB}\x{307F}|\x{75DB}\x{3044}|\x{30A2}\x{30EC}\x{30EB}\x{30AE}\x{30FC}|\x{598A}\x{5A20}|\x{6388}\x{4E73}|\x{526F}\x{4F5C}\x{7528}|\x{9EBB}\x{9154}|\x{85AC}|\x{51E6}\x{65B9}|\x{6297}\x{751F}\x{7269}\x{8CEA}|\x{51FA}\x{8840}|\x{816B}\x{308C}|\x{611F}\x{67D3}|\x{50B7}\x{8DE1}|\x{6CE8}\x{5C04}|\x{6CBB}\x{7642}|\x{624B}\x{8853}|\x{30EC}\x{30FC}\x{30B6}\x{30FC}|\x{75BC}|\x{75DB}|\x{8FC7}\x{654F}|\x{6000}\x{5B55}|\x{54FA}\x{4E73}|\x{526F}\x{4F5C}\x{7528}|\x{9EBB}\x{9189}|\x{836F}|\x{5904}\x{65B9}|\x{6297}\x{751F}\x{7D20}|\x{51FA}\x{8840}|\x{80BF}|\x{611F}\x{67D3}|\x{75A4}\x{75D5}|\x{6CE8}\x{5C04}|\x{6CBB}\x{7597}|\x{624B}\x{672F}|\x{6FC0}\x{5149}|allerg|pregnan|breastfeed|side effect|anesthe|medicine|prescription|antibiotic|pain|bleed|swelling|infection|scar|inject|procedure|surgery|laser)""",
    RegexOption.IGNORE_CASE
)
private val HybridRelaxedSafetyPattern = Regex(
    """(?:\x{C54C}\x{B808}\x{B974}\x{AE30}|\x{C784}\x{C2E0}|\x{30A2}\x{30EC}\x{30EB}\x{30AE}\x{30FC}|\x{598A}\x{5A20}|\x{8FC7}\x{654F}|\x{6000}\x{5B55}|allerg|pregnan)""",
    RegexOption.IGNORE_CASE
)

private val HybridBodyPattern = Regex(
    """(?:\x{B208}|\x{CF54}|\x{C785}|\x{D131}|\x{BCFC}|\x{C774}\x{B9C8}|\x{B208}\x{AC00}|\x{C5BC}\x{AD74}|\x{D53C}\x{BD80}|\x{BAA9}|\x{AC00}\x{C2B4}|\x{BC30}|\x{D314}|\x{B2E4}\x{B9AC}|\x{C190}|\x{BC1C}|\x{C0C1}\x{CC98}|\x{76EE}|\x{9F3B}|\x{53E3}|\x{984E}|\x{982C}|\x{984D}|\x{9854}|\x{76AE}\x{819A}|\x{9996}|\x{80F8}|\x{8179}|\x{8155}|\x{811A}|\x{624B}|\x{8DB3}|\x{50B7}|\x{773C}|\x{9F3B}|\x{53E3}|\x{4E0B}\x{5DF4}|\x{9762}\x{988A}|\x{989D}|\x{8138}|\x{76AE}\x{80A4}|\x{9888}|\x{80F8}|\x{8179}|\x{80F3}\x{818A}|\x{817F}|\x{624B}|\x{811A}|\x{4F24}|eye|nose|mouth|jaw|cheek|forehead|face|skin|neck|chest|abdomen|arm|leg|hand|foot|wound)""",
    RegexOption.IGNORE_CASE
)

internal fun classifyHybridTranslationRisk(
    sourceText: String,
    translatedText: String,
    sourceTranscriptComplete: Boolean
): HybridTranslationRiskDecision {
    val source = sourceText.trim()
    val translated = translatedText.trim()
    val combined = "$source\n$translated"
    val safetyComparable = HybridRelaxedSafetyPattern.replace(combined, "")
    val reasons = linkedSetOf<String>()

    if (!sourceTranscriptComplete) reasons += "incomplete_source_transcript"
    if (source.isBlank()) reasons += "missing_source_transcript"
    if (translated.isBlank()) reasons += "missing_translation"
    if (source.contains('\uFFFD') || translated.contains('\uFFFD')) reasons += "replacement_character"
    if (HybridUnitPattern.containsMatchIn(combined)) reasons += "unit"
    if (HybridMoneyPattern.containsMatchIn(combined)) reasons += "money"
    if (HybridBrandPattern.containsMatchIn(combined)) reasons += "brand"
    if (HybridSafetyPattern.containsMatchIn(safetyComparable)) reasons += "clinical_safety"
    if (HybridBodyPattern.containsMatchIn(combined)) reasons += "body_part"

    return HybridTranslationRiskDecision(
        lowRisk = reasons.isEmpty(),
        reasons = reasons.toList()
    )
}
