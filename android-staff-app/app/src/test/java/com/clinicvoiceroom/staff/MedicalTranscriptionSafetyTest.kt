package com.clinicvoiceroom.staff

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MedicalTranscriptionSafetyTest {
    @Test
    fun observedDeviceQaVariantsResolveOnlyAtFullSentenceScope() {
        val cases = listOf(
            "병중인 한약과 건강 보조제를 모두 말씀해 주세요." to
                "복용 중인 한약과 건강보조제를 모두 말씀해 주세요.",
            "우경 중인 한약과 건강보조제를 모두 말씀해 주세요." to
                "복용 중인 한약과 건강보조제를 모두 말씀해 주세요.",
            "특정 약제에 알레르기가 있나요?" to
                "특정 약재에 알레르기가 있나요?",
            "삼아지에프렉스의 600샷으로 진행하겠습니다." to
                "써마지 FLX 600샷으로 진행하겠습니다.",
            "서머지 FLX 600샷으로 진행하겠습니다." to
                "써마지 FLX 600샷으로 진행하겠습니다.",
            "울산의 프라임은 오른쪽에 300샷과 왼쪽에 300샷입니다." to
                "울쎄라 프라임은 오른쪽에 300샷, 왼쪽에 300샷입니다.",
            "울쎄라피 프라임은 오른쪽에 300샷, 왼쪽에 300샷입니다." to
                "울쎄라 프라임은 오른쪽에 300샷, 왼쪽에 300샷입니다.",
            "레주란 HB ECC를 눈밑에 주입합니다." to
                "리쥬란 HB 2cc를 눈 밑에 주입합니다.",
            "리즈란 HB ECC를 눈 밑에 주입합니다." to
                "리쥬란 HB 2cc를 눈 밑에 주입합니다.",
            "리쥬 스킨부스터 시술이 맞나요?" to
                "Re2O 스킨부스터 시술이 맞나요?",
            "혹시 Re2O 스킨부스터 시술이 맞나요?" to
                "Re2O 스킨부스터 시술이 맞나요?",
            "도형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다." to
                "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다."
        )

        for ((observed, expected) in cases) {
            val result = resolveAndroidMedicalTranscriptionSafety(observed)
            assertTrue("Expected approved correction for $observed", result.corrected)
            assertEquals(expected, result.text)
        }
    }

    @Test
    fun unrelatedPartialTermsAreNeverGloballyReplaced() {
        val cases = listOf(
            "병중인 환자를 안내해 주세요.",
            "이 약제는 복용하지 마세요.",
            "울산의 병원으로 연락하세요.",
            "ECC 검사 결과를 확인합니다.",
            "도형물을 그려 주세요.",
            "피어싱 렌즈 위치 보정기는 안내에 따라.",
            "고형물의 제조사는 모든 명은 확인된."
        )

        for (source in cases) {
            val result = resolveAndroidMedicalTranscriptionSafety(source)
            assertFalse("Unexpected broad correction for $source", result.corrected)
            assertEquals(source, result.text)
        }
    }
}
