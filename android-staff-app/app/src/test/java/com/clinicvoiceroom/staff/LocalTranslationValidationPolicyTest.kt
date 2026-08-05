package com.clinicvoiceroom.staff

import org.junit.Assert.assertEquals
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
    fun treatmentCountDoesNotBecomeMandatoryRisk() {
        assertFalse(
            shouldSynchronouslyValidateLocalTranslation(
                "써마지 600샷으로 안내해 드릴게요.",
                "サーマクール600ショットでご案内いたします。"
            )
        )
    }

    @Test
    fun amountTurnKeepsSynchronousValidation() {
        assertTrue(
            shouldSynchronouslyValidateLocalTranslation(
                "써마지 600샷 가격은 300만원입니다.",
                "サーマクール600ショットの料金は300万ウォンです。"
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
    fun questionShapeAloneDoesNotBecomeMandatoryRisk() {
        assertFalse(
            shouldSynchronouslyValidateLocalTranslation(
                "痛みを感じますか?",
                "안녕하세요, 어떻게 도와드릴까요?"
            )
        )
    }

    @Test
    fun generatedReplyHeuristicAloneDoesNotBecomeMandatoryRisk() {
        assertFalse(
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
    fun generatedReplyExamplesRelyOnPatientPreOutputGuardInsteadOfStaffHighRisk() {
        val cases = listOf(
            "痛みはありません。" to "네, 어디 불편하신 곳이 있으신가요? 한번 말씀해 주시겠어요?",
            "痛みを感じますか?" to "안녕하세요, 어떻게 도와드릴까요?",
            "私も試してみます。" to "네, 최근에 새로운 세럼을 하나 써봤어요.",
            "ホクロが消えた" to "네, 지금 눈가 주변이 많이 붉어져 있는데, 혹시 최근에 새로운 스킨케어 제품을 쓰셨나요?",
            "오늘은 날씨가 좋다." to "かしこまりました、では始めます。"
        )

        cases.forEach { (source, translated) ->
            assertFalse(
                "Semantic heuristics alone must not become mandatory high risk for " + source,
                shouldSynchronouslyValidateLocalTranslation(source, translated)
            )
        }
    }

    @Test
    fun longTreatmentCountDoesNotBypassTheHighRiskPolicy() {
        val plan = planLocalTranslationValidation(
            direction = "ko_to_patient",
            isInstantTemplate = false,
            sourceTranscriptComplete = true,
            targetLanguageMismatch = false,
            sourceText = "써마지 600샷으로 안내해 드릴 예정이고 시술 시간은 한 시간 정도 걸립니다.",
            translatedText = "サーマクール600ショットでご案内する予定で、施術時間は約1時間です。",
            shortTurnCandidate = false
        )

        assertFalse(plan.candidate)
        assertFalse(plan.required)
        assertFalse(plan.force)
        assertEquals("", plan.forceReason)
    }

    @Test
    fun reportedRoutineProcedurePhrasesDoNotBlockOutput() {
        val cases = listOf(
            "리프팅 시술전에 연고마취가 필요해요" to "リフティング施術の前に麻酔クリームが必要です。",
            "이제 시술 시작할게요" to "はい、では施術を始めます。",
            "이쪽으로 오시면 연고 마취 도와드릴게요" to "こちらへお越しいただければ、麻酔クリームを塗ります。",
            "리프팅 전에 연고 마취 진행할게요" to "リフティングの前に麻酔クリームを塗ります。",
            "마취 크림을 바를게요" to "麻酔クリームを塗ります。",
            "30분 동안 연고 마취할게요" to "30分間、麻酔クリームを塗っておきます。",
            "시술실로 이동해 주세요" to "施術室へ移動してください。",
            "여기에 누워 주세요" to "こちらに横になってください。",
            "한방" to "漢方",
            "한방 치료" to "漢方治療",
            "한의학" to "韓医学",
            "한의원" to "韓医院",
            "한방기반의 스킨 부스터" to "韓方医学に基づいたスキンブースター",
            "한의학 기반의 스킨 부스터" to "韓医学に基づいたスキンブースター"
        )

        cases.forEach { (source, translated) ->
            val plan = planLocalTranslationValidation(
                direction = "ko_to_patient",
                isInstantTemplate = false,
                sourceTranscriptComplete = true,
                targetLanguageMismatch = false,
                sourceText = source,
                translatedText = translated,
                shortTurnCandidate = false
            )
            assertFalse("Routine phrase must not require validation: " + source, plan.required)
            assertFalse("Routine phrase must not force validation: " + source, plan.force)
        }
    }

    @Test
    fun namesAndNonFinancialPayPhrasesDoNotBecomeMandatoryRisk() {
        val cases = listOf(
            "이 원장님이 상담해 드릴게요." to "院長のイ先生がご相談を担当します。",
            "이 원장님께 확인해 볼게요." to "院長のイ先生に確認します。",
            "오 원장님을 기다려 주세요." to "オ院長をお待ちください。",
            "오원석 원장님이 진료합니다." to "オ・ウォンソク院長が診察します。",
            "이원입니다." to "イ・ウォンです。",
            "삼원입니다." to "サムウォンです。",
            "이원 선생님께 안내받으세요." to "イ・ウォン先生から案内を受けてください。",
            "삼원색 레이저가 아닙니다." to "三原色レーザーではありません。",
            "병원에서 지원해 드립니다." to "病院でサポートいたします。",
            "원하시는 부위를 말씀해 주세요." to "ご希望の部位を教えてください。",
            "시술 부위를 잘 확인해 주세요." to "Please pay attention to the treatment area.",
            "일어날 때 조심해 주세요." to "Please pay attention when standing up.",
            "통증은 거의 없을 거예요." to "You won't feel much pain.",
            "마취는 필요하지 않을 거예요." to "You won’t need anesthesia.",
            "효율적인 시술입니다." to "This is a cost-effective treatment.",
            "효율적인 선택입니다." to "This is cost effective.",
            "기계가 더 이상 반응하지 않습니다." to "The device no longer responds.",
            "그 이상 반응하지 않도록 강도를 조절할게요." to "I will adjust the intensity so it does not react beyond that.",
            "원 선생님이 진료합니다." to "Dr. Yuan will see you.",
            "엔 선생님을 기다려 주세요." to "Please wait for Ms. Yen.",
            "만지지 않도록 꼭 주의해 주세요." to "Avoid touching it at all costs.",
            "1cc 사용합니다." to "1cc使用します。",
            "2주 후에 내원해 주세요." to "2週間後にご来院ください。",
            "알레르기가 있는지 말씀해 주세요." to "アレルギーがあるか教えてください。",
            "임신 중인지 확인해 주세요." to "妊娠中か確認してください。",
            "동의서를 작성해 주세요." to "同意書をご記入ください。"
        )

        cases.forEach { (source, translated) ->
            assertFalse(
                "Non-amount phrase must not become mandatory high risk: " + source,
                shouldSynchronouslyValidateLocalTranslation(source, translated)
            )
        }
    }

    @Test
    fun routineTranslationsAcrossAllSupportedLanguagesDoNotBecomeMandatoryRisk() {
        val translations = listOf(
            "现在开始治疗。",
            "而家開始療程。",
            "現在開始療程。",
            "これから施術を始めます。",
            "We will start the treatment now.",
            "ตอนนี้เราจะเริ่มการรักษา",
            "Bây giờ chúng ta sẽ bắt đầu liệu trình.",
            "Kami akan memulai perawatan sekarang.",
            "Kami akan memulakan rawatan sekarang.",
            "Sisimulan na natin ang procedure.",
            "Одоо эмчилгээг эхэлье.",
            "Сейчас начнем процедуру.",
            "Nous allons commencer le traitement.",
            "Ahora comenzaremos el tratamiento.",
            "Wir beginnen jetzt mit der Behandlung.",
            "Ora inizieremo il trattamento.",
            "Vamos iniciar o procedimento agora.",
            "Please stay by my side.",
            "The treatment is effective.",
            "This effect is temporary.",
            "The skin reacted well."
        )

        translations.forEach { translated ->
            assertFalse(
                "Routine multilingual output must not become mandatory high risk: " + translated,
                shouldSynchronouslyValidateLocalTranslation("이제 시술을 시작할게요.", translated)
            )
        }
    }

    @Test
    fun excludedClinicalCategoriesDoNotBecomeMandatoryRisk() {
        val cases = listOf(
            "다음 주 화요일 오전 10시에 오세요." to "来週の火曜日、午前10時にお越しください。",
            "2주에 한 번씩 주사를 맞아야 합니다." to "2週間に1回、注射を受ける必要があります。",
            "1cc만 주입할게요." to "1ccだけ注入します。",
            "하루에 두 번 복용하세요." to "1日2回服用してください。",
            "알레르기가 있으면 말씀해 주세요." to "アレルギーがあれば教えてください。",
            "임신 중에는 시술하지 않습니다." to "妊娠中は施術を行いません。",
            "이 약은 복용하지 마세요." to "この薬は服用しないでください。",
            "시술 동의서를 작성해 주세요." to "施術同意書をご記入ください。",
            "절대 문지르지 마세요." to "絶対にこすらないでください。",
            "눈을 감지 마세요." to "目を閉じないでください。",
            "통증이 있으면 말씀해 주세요." to "痛みがあれば教えてください。",
            "이상으로 설명을 마칠게요." to "以上で説明を終わります。",
            "피부 반응이 좋습니다." to "肌の反応は良好です。",
            "반응이 이상적입니다." to "反応は理想的です。",
            "원래 약간 붉어질 수 있습니다." to "通常、少し赤くなることがあります。",
            "회원 등록을 도와드릴게요." to "会員登録をお手伝いします。"
        )

        cases.forEach { (source, translated) ->
            assertFalse(
                "Excluded category must not become mandatory high risk: " + source,
                shouldSynchronouslyValidateLocalTranslation(source, translated)
            )
        }
    }

    @Test
    fun sideEffectMeaningVariantsRemainMandatoryRisk() {
        val cases = listOf(
            "부작용이 있을 수 있습니다." to "副作用が生じる可能性があります。",
            "이상 반응이 나타나면 연락해 주세요." to "異常な反応が出たらご連絡ください。",
            "피부 반응이 이상하면 바로 말씀해 주세요." to "皮膚に異常な反応があれば、すぐにお知らせください。",
            "비정상적인 반응이 생길 수 있습니다." to "An abnormal reaction may occur.",
            "일시적인 부작용입니다." to "This is a temporary side effect."
        )

        cases.forEach { (source, translated) ->
            assertTrue(
                "Side-effect meaning must remain mandatory high risk: " + source,
                shouldSynchronouslyValidateLocalTranslation(source, translated)
            )
        }
    }

    @Test
    fun variedCurrencyFormatsRemainMandatoryRisk() {
        val cases = listOf(
            "시술비는 3억 원입니다." to "施術費は3億ウォンです。",
            "마취 비용은 3천 원입니다." to "麻酔費用は3千ウォンです。",
            "시술비는 3천5백원입니다." to "施術費は3,500ウォンです。",
            "시술비는 3억5천만원입니다." to "施術費は3億5千万ウォンです。",
            "총액은 삼백만 원입니다." to "合計は300万ウォンです。",
            "300만 원을 결제해 주세요." to "300万ウォンをお支払いください。",
            "카드로 결제해 주세요." to "Please pay by card.",
            "진료비를 안내해 드릴게요." to "診察料をご案内します。",
            "할인 적용 후 결제해 주세요." to "割引適用後にお支払いください。",
            "시술을 시작할게요." to "施術料は三百万円です。",
            "시술을 시작할게요." to "治疗费是三百万元。",
            "시술을 시작할게요." to "The fee is three million won.",
            "엔화로 결제할 수 있습니다." to "You can pay in yen."
        )

        cases.forEach { (source, translated) ->
            assertTrue(
                "Amount phrase must remain mandatory high risk: " + source,
                shouldSynchronouslyValidateLocalTranslation(source, translated)
            )
        }
    }

    @Test
    fun amountRiskStillBypassesShortTurnGate() {
        val plan = planLocalTranslationValidation(
            direction = "ko_to_patient",
            isInstantTemplate = false,
            sourceTranscriptComplete = true,
            targetLanguageMismatch = false,
            sourceText = "써마지 600샷 가격은 300만원이며 결제는 시술 전에 진행합니다.",
            translatedText = "サーマクール600ショットの料金は300万ウォンで、施術前にお支払いいただきます。",
            shortTurnCandidate = false
        )

        assertTrue(plan.candidate)
        assertTrue(plan.required)
        assertTrue(plan.force)
        assertEquals("high_risk_translation", plan.forceReason)
    }

    @Test
    fun ordinaryLongStaffTurnDoesNotBecomeBlockingValidation() {
        val plan = planLocalTranslationValidation(
            direction = "ko_to_patient",
            isInstantTemplate = false,
            sourceTranscriptComplete = true,
            targetLanguageMismatch = false,
            sourceText = "현재 피부 상태를 확인한 다음 가장 적합한 관리 방법을 차근차근 설명해 드리겠습니다.",
            translatedText = "現在の肌の状態を確認してから、最も適したケア方法を順番にご説明します。",
            shortTurnCandidate = false
        )

        assertFalse(plan.candidate)
        assertFalse(plan.required)
        assertFalse(plan.force)
    }

    @Test
    fun patientToKoreanPlanAlwaysRequiresPreOutputValidation() {
        val plan = planLocalTranslationValidation(
            direction = "patient_to_ko",
            isInstantTemplate = false,
            sourceTranscriptComplete = true,
            targetLanguageMismatch = false,
            sourceText = "目を開けてください。",
            translatedText = "시작할게요.",
            shortTurnCandidate = false
        )

        assertTrue(plan.candidate)
        assertTrue(plan.required)
        assertTrue(plan.force)
        assertEquals("patient_to_ko_pre_output", plan.forceReason)
    }
}
