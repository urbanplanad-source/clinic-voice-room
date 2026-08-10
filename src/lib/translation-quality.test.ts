import { describe, expect, it } from "vitest";
import { analyzeDeterministicTranslation, classifyTranslationRisk } from "./translation-quality";

describe("translation quality deterministic checks", () => {
  it("passes a faithful patient-to-Korean question", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "Is this a side effect?",
      translatedText: "이것은 부작용인가요?",
      direction: "patient_to_ko"
    });
    expect(result.status).toBe("pass");
    expect(result.riskReasons).toContain("adverse_effect");
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

  it("detects loss of an approved Latin brand", () => {
    const result = analyzeDeterministicTranslation({
      sourceText: "Thermage FLX 시술입니다.",
      translatedText: "This is a radiofrequency procedure.",
      direction: "ko_to_patient"
    });
    expect(result.failureReasons).toContain("brand_mismatch");
  });

  it("raises contextual medication and consent risks", () => {
    expect(classifyTranslationRisk("지금 시술 진행에 동의하시나요?").riskReasons)
      .toContain("consent_or_refusal_in_execution_context");
    expect(classifyTranslationRisk("하루 2번 5mg 복용하세요.").riskReasons)
      .toContain("medication_dose_or_route");
  });
});
