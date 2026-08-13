import { describe, expect, it } from "vitest";
import { analyzeDeterministicTranslation, classifyTranslationRisk } from "./translation-quality";

describe("translation quality deterministic checks", () => {
  it("rejects Korean language mixing in a Chinese target translation", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "시술 뒤 받은 안내를 따라 주세요.",
      translatedText: "术后请按照收到的 안내执行。",
      direction: "ko_to_patient",
      targetLanguage: "zh"
    });

    expect(result.targetLanguagePreserved).toBe(false);
    expect(result.failureReasons).toContain("target_language_mismatch");
  });

  it("passes a faithful patient-to-Korean question", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "Is this a side effect?",
      translatedText: "이것은 부작용인가요?",
      direction: "patient_to_ko"
    });
    expect(result.status).toBe("pass");
    expect(result.riskReasons).toContain("adverse_effect");
  });

  it("preserves Korean avoidance as English avoid", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "안내에 따라 햇빛을 피하고 자외선 차단제를 사용하세요.",
      translatedText: "Avoid sun exposure and use sunscreen as instructed.",
      direction: "ko_to_patient",
      targetLanguage: "en"
    });

    expect(result.negationPreserved).toBe(true);
  });

  it("does not treat the Chinese affirmative idiom 没错 as a negation", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "부위가 이곳이 맞나요?",
      translatedText: "部位是这里没错吗？",
      direction: "ko_to_patient",
      targetLanguage: "zh"
    });

    expect(result.negationPreserved).toBe(true);
  });
  it("detects question, negation, number and unit changes", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "하루에 2번, 5mL를 복용하지 마세요?",
      translatedText: "Take 3 mL once a day.",
      direction: "ko_to_patient"
    });
    expect(result.status).toBe("fail");
    expect(result.failureReasons).toEqual(expect.arrayContaining([
      "number_mismatch",
      "clinical_unit_mismatch",
      "question_form_mismatch",
      "negation_mismatch"
    ]));
  });

  it("preserves a question followed by a statement in Chinese", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "수술 부위가 왼쪽, 오른쪽 또는 양쪽 중 어디인가요? 다시 확인하겠습니다.",
      translatedText: "手术部位是左侧、右侧还是双侧？我会再次确认。",
      direction: "ko_to_patient"
    });
    expect(result.questionPreserved).toBe(true);
    expect(result.failureReasons).not.toContain("question_form_mismatch");
  });

  it("does not mistake an English do-not command for a question", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "어지러우면 즉시 말씀하시고 혼자 일어나지 마세요.",
      translatedText: "If you feel dizzy, tell us immediately and do not get up by yourself.",
      direction: "ko_to_patient"
    });
    expect(result.questionPreserved).toBe(true);
    expect(result.failureReasons).not.toContain("question_form_mismatch");
  });

  it("does not mistake Korean 동안 or alternative 아니면 for negation", () => {
    expect(analyzeDeterministicTranslation({
      sourceText: "0.05% 연고를 7일 동안 바르세요.",
      translatedText: "Apply the 0.05% ointment for 7 days.",
      direction: "ko_to_patient",
      targetLanguage: "en"
    }).negationPreserved).toBe(true);
    expect(analyzeDeterministicTranslation({
      sourceText: "발적과 부종이 둘 다 심해졌나요, 아니면 발적만 심해졌나요?",
      translatedText: "Have both redness and swelling worsened, or only the redness?",
      direction: "ko_to_patient",
      targetLanguage: "en"
    }).negationPreserved).toBe(true);
  });

  it("recognizes Cantonese negation, questions, and stop requests", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "請即刻停，我唔同意繼續，有冇其他方法？",
      translatedText: "즉시 중단해 주세요. 계속하는 데 동의하지 않습니다. 다른 방법이 있나요?",
      direction: "patient_to_ko"
    });
    expect(result.questionPreserved).toBe(true);
    expect(result.negationPreserved).toBe(true);
    expect(result.stopOrRefusalPreserved).toBe(true);
  });

  it("does not treat an English do-not command as a question", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "공복에는 이 환약을 복용하지 마세요.",
      translatedText: "Do not take this herbal pill on an empty stomach.",
      direction: "ko_to_patient",
      targetLanguage: "en"
    });
    expect(result.questionPreserved).toBe(true);
  });

  it("detects loss of an approved Latin brand", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "Thermage FLX 시술입니다.",
      translatedText: "This is a radiofrequency procedure.",
      direction: "ko_to_patient"
    });
    expect(result.failureReasons).toContain("brand_mismatch");
  });

  it("maps approved Korean and English brand aliases to the same canonical brand", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "써마지 FLX는 얼굴 전체에 총 600샷입니다.",
      translatedText: "Thermage FLX is 600 shots total for the full face.",
      direction: "ko_to_patient",
      targetLanguage: "en"
    });
    expect(result.brandPreserved).toBe(true);

    const normalizedSttAlias = analyzeDeterministicTranslation({
      sourceText: "울쎄라피 프라임은 오른쪽 300샷, 왼쪽 300샷입니다.",
      translatedText: "Ultherapy Prime is 300 shots on the right and 300 shots on the left.",
      direction: "ko_to_patient",
      targetLanguage: "en"
    });
    expect(normalizedSttAlias.brandPreserved).toBe(true);
  });

  it("preserves Korean 아닌 as English not", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "리쥬란은 아닌 거죠?",
      translatedText: "It is not Rejuran, correct?",
      direction: "ko_to_patient",
      targetLanguage: "en"
    });
    expect(result.negationPreserved).toBe(true);
  });

  it("preserves a Korean stop request as an English stop request", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "지금 바로 레이저를 중단해 주세요.",
      translatedText: "Please stop the laser right now.",
      direction: "ko_to_patient",
      targetLanguage: "en"
    });
    expect(result.negationPreserved).toBe(true);
    expect(result.stopOrRefusalPreserved).toBe(true);
  });

  it("detects an omitted stop request", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "지금 바로 레이저를 중단해 주세요.",
      translatedText: "The laser treatment will continue now.",
      direction: "ko_to_patient",
      targetLanguage: "en"
    });
    expect(result.failureReasons).toContain("stop_or_refusal_mismatch");
  });

  it("recognizes inflected Korean and Japanese stop expressions", () => {
    const korean = analyzeDeterministicTranslation({
      sourceText: "지금 멈춰 주세요.",
      translatedText: "Please stop now.",
      direction: "ko_to_patient",
      targetLanguage: "en"
    });
    const japanese = analyzeDeterministicTranslation({
      sourceText: "呼吸が止まったら、119に連絡してください。",
      translatedText: "호흡이 멈추면 119에 연락하세요.",
      direction: "patient_to_ko",
      targetLanguage: "ko"
    });

    expect(korean.stopOrRefusalPreserved).toBe(true);
    expect(japanese.stopOrRefusalPreserved).toBe(true);
  });

  it("raises contextual medication and consent risks", () => {
    expect(classifyTranslationRisk("지금 시술 진행에 동의하시나요?").riskReasons)
      .toContain("consent_or_refusal_in_execution_context");
    expect(classifyTranslationRisk("하루 2번 5mg 복용하세요.").riskReasons)
      .toContain("medication_dose_or_route");
  });
});
