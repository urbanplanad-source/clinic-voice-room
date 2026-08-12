export const medicalTranscriptionContextInstruction = [
  "Medical context:",
  "특정 약재: 약재 (medicinal herb), not 약제.",
  "사용할 약침: 사용할, not 사용한.",
  "제조사·모델명 문맥: 보형물.",
  "리쥬란 HB 2cc: keep 2cc.",
  "Apply only if spoken; never add a term or dose."
].join(" ");

export type MedicalTranscriptionRuleId =
  | "current_herbal_medicines"
  | "kmed_future_pharmacopuncture"
  | "medicinal_herb_allergy_context"
  | "thermage_flx_shots"
  | "ultherapy_prime_bilateral_shots"
  | "implant_documentation"
  | "rejuran_hb_dose"
  | "re2o_skin_booster_question";

type MedicalTranscriptionRule = {
  id: MedicalTranscriptionRuleId;
  canonical: string;
  observedVariants: string[];
  suspicious: (key: string) => boolean;
  retryResolved: (key: string) => boolean;
};

export type MedicalTranscriptionAssessment = {
  status: "accepted" | "corrected" | "retry_required";
  text?: string;
  originalText: string;
  corrected: boolean;
  ruleId?: MedicalTranscriptionRuleId;
  reason?: string;
};

export type MedicalTranscriptionSafetyOutcome = MedicalTranscriptionAssessment & {
  retryAttempted: boolean;
  retryTranscript?: string;
};

function key(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]/gu, "");
}

const rules: MedicalTranscriptionRule[] = [
  {
    id: "current_herbal_medicines",
    canonical: "복용 중인 한약과 건강보조제를 모두 말씀해 주세요.",
    observedVariants: ["병중인 한약과 건강 보조제를 모두 말씀해 주세요."],
    suspicious: () => false,
    retryResolved: (value) =>
      value.includes("복용중인한약") &&
      value.includes("건강보조제")
  },
  {
    id: "kmed_future_pharmacopuncture",
    canonical: "사용할 약침의 성분과 제품명을 확인하겠습니다.",
    observedVariants: ["사용한 약침의 성분과 제품명을 확인하겠습니다."],
    suspicious: (value) =>
      value.includes("사용한약침") &&
      value.includes("성분") &&
      value.includes("제품명") &&
      value.includes("확인"),
    retryResolved: (value) =>
      value.includes("사용할약침") &&
      value.includes("성분") &&
      value.includes("제품명") &&
      value.includes("확인")
  },
  {
    id: "medicinal_herb_allergy_context",
    canonical: "특정 약재에 알레르기가 있나요?",
    observedVariants: ["특정 약제에 알레르기가 있나요?"],
    suspicious: (value) =>
      value.includes("특정") &&
      value.includes("알레르기") &&
      !value.includes("약재") &&
      !value.includes("약제"),
    retryResolved: (value) =>
      value.includes("특정약재") &&
      value.includes("알레르기")
  },
  {
    id: "thermage_flx_shots",
    canonical: "써마지 FLX 600샷으로 진행하겠습니다.",
    observedVariants: ["삼아지에프렉스의 600샷으로 진행하겠습니다."],
    suspicious: () => false,
    retryResolved: (value) =>
      value.includes("써마지flx") &&
      value.includes("600샷")
  },
  {
    id: "ultherapy_prime_bilateral_shots",
    canonical: "울쎄라 프라임은 오른쪽에 300샷, 왼쪽에 300샷입니다.",
    observedVariants: ["울산의 프라임은 오른쪽에 300샷과 왼쪽에 300샷입니다."],
    suspicious: () => false,
    retryResolved: (value) =>
      value.includes("울쎄라프라임") &&
      value.includes("오른쪽에300샷") &&
      value.includes("왼쪽에300샷")
  },
  {
    id: "implant_documentation",
    canonical: "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
    observedVariants: [
      "고형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
      "모형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
      "공약물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
      "도형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다."
    ],
    suspicious: (value) =>
      !value.includes("보형물") &&
      value.includes("제조사") &&
      value.includes("모델명") &&
      value.includes("확인된기록") &&
      value.includes("근거"),
    retryResolved: (value) =>
      value.includes("보형물") &&
      value.includes("제조사") &&
      value.includes("모델명") &&
      value.includes("확인된기록")
  },
  {
    id: "rejuran_hb_dose",
    canonical: "리쥬란 HB 2cc를 눈 밑에 주입합니다.",
    observedVariants: [
      "레주란 HB ECC를 눈밑에 주입합니다.",
      "리쥬란 HB ECC를 눈 밑에 주입합니다.",
      "리쥬란 HB EC씨를 눈 밑에 주입합니다.",
      "리쥬란 HB 이시씨를 눈 밑에 주입합니다."
    ],
    suspicious: (value) => {
      const context = (value.includes("리쥬란hb") || value.includes("리주란hb")) &&
        value.includes("눈밑") && value.includes("주입");
      return context && !/\d+(?:\.\d+)?cc/u.test(value);
    },
    retryResolved: (value) =>
      (value.includes("리쥬란hb") || value.includes("리주란hb")) &&
      value.includes("눈밑") &&
      value.includes("주입") &&
      /\d+(?:\.\d+)?cc/u.test(value)
  },
  {
    id: "re2o_skin_booster_question",
    canonical: "Re2O 스킨부스터 시술이 맞나요?",
    observedVariants: ["리쥬 스킨부스터 시술이 맞나요?"],
    suspicious: () => false,
    retryResolved: (value) =>
      value.includes("re2o스킨부스터") &&
      value.includes("시술이맞나요")
  }
];

export function medicalTranscriptionSafetyEnabled(
  env: Record<string, string | undefined> = process.env
) {
  return env.MEDICAL_STT_SAFETY_CANDIDATE?.trim().toLowerCase() === "on";
}

export function assessMedicalTranscription(transcript: string): MedicalTranscriptionAssessment {
  const originalText = transcript.trim();
  const transcriptKey = key(originalText);

  for (const rule of rules) {
    const canonicalKey = key(rule.canonical);
    if (transcriptKey === canonicalKey) {
      return { status: "accepted", text: originalText, originalText, corrected: false, ruleId: rule.id };
    }
    if (rule.observedVariants.some((variant) => key(variant) === transcriptKey)) {
      return {
        status: "corrected",
        text: rule.canonical,
        originalText,
        corrected: true,
        ruleId: rule.id,
        reason: "approved_full_context_variant"
      };
    }
    if (rule.suspicious(transcriptKey)) {
      return {
        status: "retry_required",
        originalText,
        corrected: false,
        ruleId: rule.id,
        reason: "unresolved_high_risk_transcription"
      };
    }
  }

  return { status: "accepted", text: originalText, originalText, corrected: false };
}

export function buildMedicalTranscriptionRetryPrompt(assessment: MedicalTranscriptionAssessment) {
  const rule = rules.find((candidate) => candidate.id === assessment.ruleId);
  return [
    medicalTranscriptionContextInstruction,
    "Listen to the same audio again.",
    rule ? `The clinically expected form for this ambiguity is: ${rule.canonical}` : "Resolve the medical ambiguity from the audio.",
    "Return only what is acoustically supported. If the expected form was not spoken, do not force it."
  ].join(" ");
}

export async function resolveMedicalTranscriptionSafety(params: {
  transcript: string;
  inputLanguage: string;
  enabled?: boolean;
  retranscribe?: (prompt: string) => Promise<string | null>;
}): Promise<MedicalTranscriptionSafetyOutcome> {
  const originalText = params.transcript.trim();
  if (!params.enabled || params.inputLanguage !== "ko") {
    return { status: "accepted", text: originalText, originalText, corrected: false, retryAttempted: false };
  }

  const initial = assessMedicalTranscription(originalText);
  if (initial.status !== "retry_required" || !params.retranscribe) {
    return { ...initial, retryAttempted: false };
  }

  let retryTranscript: string | null = null;
  try {
    retryTranscript = await params.retranscribe(buildMedicalTranscriptionRetryPrompt(initial));
  } catch {
    retryTranscript = null;
  }
  if (!retryTranscript?.trim()) {
    return { ...initial, retryAttempted: true, reason: "retranscription_unavailable" };
  }

  const retryAssessment = assessMedicalTranscription(retryTranscript);
  const rule = rules.find((candidate) => candidate.id === initial.ruleId);
  const retryText = retryAssessment.text?.trim() ?? retryTranscript.trim();
  const resolved = rule?.retryResolved(key(retryText)) === true;
  if (!resolved) {
    return {
      ...initial,
      retryAttempted: true,
      retryTranscript: retryTranscript.trim(),
      reason: "retranscription_did_not_confirm_medical_term"
    };
  }

  return {
    status: retryAssessment.status === "corrected" ? "corrected" : "accepted",
    text: retryText,
    originalText,
    corrected: retryText !== originalText,
    ruleId: initial.ruleId,
    reason: "retranscription_confirmed",
    retryAttempted: true,
    retryTranscript: retryTranscript.trim()
  };
}
