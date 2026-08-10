import { afterEach, describe, expect, it, vi } from "vitest";
import { validateMedicalTranslation } from "./medical-semantic-validation";

afterEach(() => vi.restoreAllMocks());

describe("validateMedicalTranslation", () => {
  it("requires no model for a normal deterministic staff turn", async () => {
    const strictTranslate = vi.fn();
    const result = await validateMedicalTranslation({
      sourceText: "안녕하세요.",
      translatedText: "Hello.",
      direction: "ko_to_patient",
      sourceLanguage: "Korean",
      targetLanguage: "English",
      safetyIdentifier: "test",
      semanticRequired: false,
      strictTranslate
    });
    expect(result.status).toBe("final");
    expect(result.semanticStatus).toBe("not_required");
    expect(strictTranslate).not.toHaveBeenCalled();
  });

  it("accepts a patient-to-Korean turn only after semantic validation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      output_text: JSON.stringify({ ok: true, reason: "same meaning", correctedTranslation: "" })
    }), { status: 200 }));
    const result = await validateMedicalTranslation({
      apiKey: "test-key",
      sourceText: "Does it hurt?",
      translatedText: "아픈가요?",
      direction: "patient_to_ko",
      sourceLanguage: "English",
      targetLanguage: "Korean",
      safetyIdentifier: "test",
      semanticRequired: true,
      strictTranslate: vi.fn()
    });
    expect(result.status).toBe("final");
    expect(result.semanticStatus).toBe("pass");
    expect(result.validationAttemptCount).toBe(1);
  });

  it("uses a corrected translation as the only final value", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      output_text: JSON.stringify({ ok: false, reason: "wrong intent", correctedTranslation: "눈을 떠 주세요." })
    }), { status: 200 }));
    const result = await validateMedicalTranslation({
      apiKey: "test-key",
      sourceText: "目を開けてください。",
      translatedText: "시작할게요.",
      direction: "patient_to_ko",
      sourceLanguage: "Japanese",
      targetLanguage: "Korean",
      safetyIdentifier: "test",
      semanticRequired: true,
      strictTranslate: vi.fn()
    });
    expect(result.status).toBe("final");
    expect(result.finalTranslation).toBe("눈을 떠 주세요.");
    expect(result.corrected).toBe(true);
    expect(result.validationPath).toBe("repair");
  });

  it("blocks output when validation and strict repair are unavailable", async () => {
    const result = await validateMedicalTranslation({
      sourceText: "Does it hurt?",
      translatedText: "아픈가요?",
      direction: "patient_to_ko",
      sourceLanguage: "English",
      targetLanguage: "Korean",
      safetyIdentifier: "test",
      semanticRequired: true,
      strictTranslate: vi.fn().mockResolvedValue(null)
    });
    expect(result.status).toBe("retry_required");
    expect(result.finalTranslation).toBeUndefined();
    expect(result.semanticStatus).toBe("unavailable");
  });

  it("does not release an unverified strict model translation after a validator timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    const result = await validateMedicalTranslation({
      apiKey: "test-key",
      sourceText: "Do I need to stop taking this medicine?",
      translatedText: "이 약을 계속 복용하세요.",
      direction: "patient_to_ko",
      sourceLanguage: "English",
      targetLanguage: "Korean",
      safetyIdentifier: "test",
      semanticRequired: true,
      strictTranslate: vi.fn().mockResolvedValue({
        translatedText: "이 약 복용을 중단해야 하나요?",
        translationSource: "model"
      })
    });

    expect(result.status).toBe("retry_required");
    expect(result.finalTranslation).toBeUndefined();
    expect(result.semanticStatus).toBe("unavailable");
  });

  it("releases an exact approved sentence without a semantic model call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await validateMedicalTranslation({
      sourceText: "Please open your eyes.",
      translatedText: "눈을 떠 주세요.",
      direction: "patient_to_ko",
      sourceLanguage: "English",
      targetLanguage: "Korean",
      safetyIdentifier: "test",
      initialTranslationSource: "verified_sentence",
      semanticRequired: true,
      strictTranslate: vi.fn()
    });

    expect(result.status).toBe("final");
    expect(result.translationSource).toBe("verified_sentence");
    expect(result.semanticStatus).toBe("pass");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
