package com.clinicvoiceroom.staff

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalTranslationValidationPolicyTest {
    @Test
    fun normalClinicSentenceDoesNotBlockTts() {
        assertFalse(
            shouldSynchronouslyValidateLocalTranslation(
                "눈가 색소가 신경 쓰이시는군요.",
                "目元の色素が気になるのですね。"
            )
        )
    }

    @Test
    fun everyCompletePatientToKoreanRealtimeTurnIsValidatedBeforeOutput() {
        val wrongButFluentKoreanCandidates = listOf(
            "조금 더 젊게 보이게 해주세요.",
            "시작할게요.",
            "힘 빼주세요."
        )

        wrongButFluentKoreanCandidates.forEach { candidate ->
            assertFalse(
                "Regression case should bypass the older heuristic: $candidate",
                shouldSynchronouslyValidateLocalTranslation("目を開けてください。", candidate)
            )
            assertTrue(
                "Expected pre-output validation for 目を開けてください。 -> $candidate",
                requiresPatientToKoreanPreOutputValidation(
                    direction = "patient_to_ko",
                    isInstantTemplate = false,
                    sourceTranscriptComplete = true
                )
            )
        }
    }

    @Test
    fun staffTurnsAndIncompleteTranscriptsDoNotEnableTheGlobalPatientGuard() {
        assertFalse(
            requiresPatientToKoreanPreOutputValidation(
                direction = "ko_to_patient",
                isInstantTemplate = false,
                sourceTranscriptComplete = true
            )
        )
        assertFalse(
            requiresPatientToKoreanPreOutputValidation(
                direction = "patient_to_ko",
                isInstantTemplate = false,
                sourceTranscriptComplete = false
            )
        )
        assertFalse(
            requiresPatientToKoreanPreOutputValidation(
                direction = "patient_to_ko",
                isInstantTemplate = true,
                sourceTranscriptComplete = true
            )
        )
    }

    @Test
    fun numericTurnKeepsSynchronousValidation() {
        assertTrue(
            shouldSynchronouslyValidateLocalTranslation(
                "써마지 600샷으로 안내해 드릴게요.",
                "サーマクール600ショットでご案内いたします。"
            )
        )
    }

    @Test
    fun sideEffectTurnKeepsSynchronousValidation() {
        assertTrue(
            shouldSynchronouslyValidateLocalTranslation(
                "부작용이 있을 수 있습니다.",
                "副作用が生じる可能性があります。"
            )
        )
    }

    @Test
    fun questionChangedToAnswerKeepsSynchronousValidation() {
        assertTrue(
            shouldSynchronouslyValidateLocalTranslation(
                "痛みを感じますか?",
                "안녕하세요, 어떻게 도와드릴까요?"
            )
        )
    }

    @Test
    fun generatedLongReplyKeepsSynchronousValidation() {
        assertTrue(
            shouldSynchronouslyValidateLocalTranslation(
                "目を閉じてください。",
                "네, 그럼 필러와 보톡스를 둘 다 맞는 경우에 대해서 설명해드릴게요."
            )
        )
    }

    @Test
    fun foreignExpectedReplyIsRejectedForKoreanTarget() {
        assertTrue(
            hasClearKoreanTargetMismatch(
                "目を開けてください。",
                "はい、じゃあ頬のあたりを見てもらいたいんですけど。"
            )
        )
        assertTrue(hasClearKoreanTargetMismatch("痛みはありません。", "네、では次の施術について説明します。"))
        assertTrue(hasClearKoreanTargetMismatch("好", "好"))
    }

    @Test
    fun normalKoreanTranslationPassesTargetLanguageGuard() {
        assertFalse(
            hasClearKoreanTargetMismatch(
                "痛みはありません。",
                "통증은 없습니다."
            )
        )
    }

    @Test
    fun acceptedBrandOnlyTranslationPassesTargetLanguageGuard() {
        assertFalse(hasClearKoreanTargetMismatch("Thermage FLX", "Thermage FLX"))
        assertFalse(hasClearKoreanTargetMismatch("Thermage FLX", "Thermage FLX로 진행합니다."))
    }

    @Test
    fun foreignOrMissingRepairCannotPassKoreanTargetGuard() {
        assertFalse(hasUsableKoreanTargetRepair("目を開けてください。", false, ""))
        assertFalse(
            hasUsableKoreanTargetRepair(
                "目を開けてください。",
                true,
                "はい、頬を見てください。"
            )
        )
        assertTrue(
            hasUsableKoreanTargetRepair(
                "目を開けてください。",
                true,
                "눈을 떠 주세요."
            )
        )
    }

    @Test
    fun reportedGeneratedRepliesKeepSynchronousValidation() {
        val cases = listOf(
            "痛みはありません。" to "네, 어디 불편하신 곳이 있으신가요? 한번 말씀해 주시겠어요?",
            "痛みを感じますか?" to "안녕하세요, 어떻게 도와드릴까요?",
            "私も試してみます。" to "네, 최근에 새로운 세럼을 하나 써봤어요.",
            "ホクロが消えた" to "네, 지금 눈가 주변이 많이 붉어져 있는데, 혹시 최근에 새로운 스킨케어 제품을 쓰셨나요?",
            "오늘은 날씨가 좋다." to "かしこまりました、では始めます。"
        )

        cases.forEach { (source, translated) ->
            assertTrue(
                "Expected synchronous validation for $source -> $translated",
                shouldSynchronouslyValidateLocalTranslation(source, translated)
            )
        }
    }
}
