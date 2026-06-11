import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pendingBackTranslationGuard } from "./back-translation-check";
import { mergeGuardFlags } from "./guard-flags";
import { detectHighRisk } from "./risk-detector";

describe("back translation check helpers", () => {
  const originalFlag = process.env.BACK_TRANSLATION_CHECK;

  beforeEach(() => {
    process.env.BACK_TRANSLATION_CHECK = "on";
  });

  afterEach(() => {
    process.env.BACK_TRANSLATION_CHECK = originalFlag;
  });

  it("detects high risk consent text", () => {
    expect(detectHighRisk("보톡스 시술에 동의하시면 서명해 주세요")).toMatchObject({
      isHighRisk: true,
      categories: ["consent"]
    });
    expect(detectHighRisk("안녕하세요").isHighRisk).toBe(false);
  });

  it("creates pending flags only for staff to patient LLM translations", () => {
    expect(
      pendingBackTranslationGuard({
        sourceText: "보톡스 시술에 동의하시면 서명해 주세요",
        role: "staff",
        targetLanguage: "en",
        translationSource: "llm"
      })?.backTranslation?.status
    ).toBe("pending");

    expect(
      pendingBackTranslationGuard({
        sourceText: "보톡스 시술에 동의하시면 서명해 주세요",
        role: "staff",
        targetLanguage: "en",
        translationSource: "verified"
      })
    ).toBeUndefined();

    expect(
      pendingBackTranslationGuard({
        sourceText: "Do you agree?",
        role: "patient",
        targetLanguage: "ko",
        translationSource: "llm"
      })
    ).toBeUndefined();
  });

  it("keeps existing number guard data when merging back translation results", () => {
    const merged = mergeGuardFlags(
      { numberCheck: "mismatch", sourceNumbers: [2], translatedNumbers: [] },
      { backTranslation: { status: "fail", backText: "동의하지 않습니다", reason: "meaning changed" } }
    );
    expect(merged?.numberCheck).toBe("mismatch");
    expect(merged?.backTranslation?.status).toBe("fail");
  });

  it("is disabled by default unless BACK_TRANSLATION_CHECK is on", () => {
    process.env.BACK_TRANSLATION_CHECK = "off";
    expect(
      pendingBackTranslationGuard({
        sourceText: "동의하시면 서명해 주세요",
        role: "staff",
        targetLanguage: "en",
        translationSource: "llm"
      })
    ).toBeUndefined();
  });
});
