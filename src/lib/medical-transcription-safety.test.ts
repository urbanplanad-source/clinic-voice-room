import { describe, expect, it, vi } from "vitest";
import {
  assessMedicalTranscription,
  medicalTranscriptionSafetyEnabled,
  resolveMedicalTranscriptionSafety
} from "./medical-transcription-safety";

describe("medical transcription safety candidate", () => {
  it.each([
    ["병중인 한약과 건강 보조제를 모두 말씀해 주세요.", "복용 중인 한약과 건강보조제를 모두 말씀해 주세요."],
    ["사용한 약침의 성분과 제품명을 확인하겠습니다.", "사용할 약침의 성분과 제품명을 확인하겠습니다."],
    ["특정 약제에 알레르기가 있나요?", "특정 약재에 알레르기가 있나요?"],
    ["삼아지에프렉스의 600샷으로 진행하겠습니다.", "써마지 FLX 600샷으로 진행하겠습니다."],
    ["울산의 프라임은 오른쪽에 300샷과 왼쪽에 300샷입니다.", "울쎄라 프라임은 오른쪽에 300샷, 왼쪽에 300샷입니다."],
    ["고형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.", "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다."],
    ["모형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.", "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다."],
    ["도형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.", "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다."],
    ["레주란 HB ECC를 눈밑에 주입합니다.", "리쥬란 HB 2cc를 눈 밑에 주입합니다."],
    ["리쥬 스킨부스터 시술이 맞나요?", "Re2O 스킨부스터 시술이 맞나요?"]
  ])("corrects only an approved full-context variant", (observed, expected) => {
    const result = assessMedicalTranscription(observed);
    expect(result.status).toBe("corrected");
    expect(result.text).toBe(expected);
  });

  it("does not perform global word replacement", () => {
    expect(assessMedicalTranscription("어제 사용한 약침은 폐기했습니다.")).toMatchObject({
      status: "accepted",
      text: "어제 사용한 약침은 폐기했습니다."
    });
    expect(assessMedicalTranscription("고형물 검사를 진행합니다.")).toMatchObject({
      status: "accepted",
      text: "고형물 검사를 진행합니다."
    });
    expect(assessMedicalTranscription("ECC 검사 결과를 확인합니다.")).toMatchObject({
      status: "accepted",
      text: "ECC 검사 결과를 확인합니다."
    });
    expect(assessMedicalTranscription("이 약제에 알레르기가 있나요?")).toMatchObject({
      status: "accepted",
      text: "이 약제에 알레르기가 있나요?"
    });
    expect(assessMedicalTranscription("울산의 병원으로 연락하세요.")).toMatchObject({
      status: "accepted",
      text: "울산의 병원으로 연락하세요."
    });
    expect(assessMedicalTranscription("도형물을 그려 주세요.")).toMatchObject({
      status: "accepted",
      text: "도형물을 그려 주세요."
    });
  });

  it("retranscribes an unresolved implant-context ambiguity once and accepts only confirmation", async () => {
    const retranscribe = vi.fn().mockResolvedValue(
      "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다."
    );
    const result = await resolveMedicalTranscriptionSafety({
      transcript: "봉합물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
      inputLanguage: "ko",
      enabled: true,
      retranscribe
    });
    expect(retranscribe).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "accepted", corrected: true, retryAttempted: true });
  });

  it("blocks output when retranscription does not confirm the medical term", async () => {
    const result = await resolveMedicalTranscriptionSafety({
      transcript: "봉합물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
      inputLanguage: "ko",
      enabled: true,
      retranscribe: async () => "고형물의 제조사와 모델명을 기록하겠습니다."
    });
    expect(result).toMatchObject({
      status: "retry_required",
      retryAttempted: true,
      reason: "retranscription_did_not_confirm_medical_term"
    });
    expect(result.text).toBeUndefined();
  });

  it("keeps the candidate disabled unless explicitly enabled", async () => {
    expect(medicalTranscriptionSafetyEnabled({ MEDICAL_STT_SAFETY_CANDIDATE: "off" })).toBe(false);
    const result = await resolveMedicalTranscriptionSafety({
      transcript: "고형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
      inputLanguage: "ko",
      enabled: false
    });
    expect(result).toMatchObject({ status: "accepted", corrected: false });
  });
});
