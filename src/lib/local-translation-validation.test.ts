import { describe, expect, it } from "vitest";
import {
  buildLocalTranslationValidationInstructions,
  parseLocalTranslationValidationResult,
  resolveLocalTranslation
} from "./local-translation-validation";

describe("local translation validation", () => {
  it("keeps a valid candidate unchanged", () => {
    const validation = parseLocalTranslationValidationResult(
      JSON.stringify({ ok: true, reason: "", correctedTranslation: "" })
    );

    expect(validation).not.toBeNull();
    expect(resolveLocalTranslation("전체 항목의 가격표가 있나요?", validation!)).toEqual({
      translatedText: "전체 항목의 가격표가 있나요?",
      repaired: false
    });
  });

  it("replaces a generated reply with a direct translation", () => {
    const validation = parseLocalTranslationValidationResult(
      JSON.stringify({
        ok: false,
        reason: "The question was changed into an answer.",
        correctedTranslation: "전체 항목의 가격표가 있나요?"
      })
    );

    expect(validation).not.toBeNull();
    expect(
      resolveLocalTranslation(
        "네, 전체 시술 항목의 가격표를 보고 싶으시군요. 잠시만요, 지금 보여드리겠습니다.",
        validation!
      )
    ).toEqual({
      translatedText: "전체 항목의 가격표가 있나요?",
      repaired: true
    });
  });

  it("requires a parseable boolean verdict", () => {
    expect(parseLocalTranslationValidationResult('{"reason":"missing verdict"}')).toBeNull();
    expect(parseLocalTranslationValidationResult("not json")).toBeNull();
  });

  it("does not call an unchanged invalid candidate repaired", () => {
    expect(
      resolveLocalTranslation("가격표가 있나요?", {
        ok: false,
        reason: "repair missing",
        correctedTranslation: "가격표가 있나요?"
      })
    ).toEqual({
      translatedText: "가격표가 있나요?",
      repaired: false
    });
  });

  it("explicitly forbids answering the speaker", () => {
    const instructions = buildLocalTranslationValidationInstructions({
      sourceLanguage: "Traditional Chinese",
      targetLanguage: "Korean"
    });

    expect(instructions).toContain("questions must remain questions");
    expect(instructions).toContain("Never answer the source speaker");
    expect(instructions).toContain("correctedTranslation");
  });
});
