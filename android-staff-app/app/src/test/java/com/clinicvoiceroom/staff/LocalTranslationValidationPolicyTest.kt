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
}
