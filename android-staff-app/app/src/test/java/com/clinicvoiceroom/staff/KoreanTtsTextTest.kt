package com.clinicvoiceroom.staff

import org.junit.Assert.assertEquals
import org.junit.Test

class KoreanTtsTextTest {
    @Test
    fun readsClinicCcUnitsAsSsissi() {
        val cases = mapOf(
            "2cc를 주입합니다." to "2씨씨를 주입합니다.",
            "2 cc 사용합니다." to "2씨씨 사용합니다.",
            "용량은 2CC입니다." to "용량은 2씨씨입니다.",
            "0.5cc만 사용합니다." to "0.5씨씨만 사용합니다.",
            "총 2㎤입니다." to "총 2씨씨입니다."
        )

        cases.forEach { (source, expected) ->
            assertEquals(expected, normalizeKoreanTtsText(source))
        }
    }

    @Test
    fun leavesDisplayWordsAndUnrelatedLatinTextUnchanged() {
        val cases = listOf(
            "이미 2씨씨로 표시됩니다.",
            "CC크림 2개가 필요합니다.",
            "코드 2ccm은 단위가 아닙니다."
        )

        cases.forEach { source ->
            assertEquals(source, normalizeKoreanTtsText(source))
        }
    }
}
