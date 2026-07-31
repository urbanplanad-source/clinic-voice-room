import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClinicGlossaryData } from "./clinic-glossary";
import { polishKoreanAndTranslateWithOpenAITextSafety } from "./openai-korean-polish-translation";
import { CriticalNumericTranslationError } from "./openai-text-translation";

const glossaryData: ClinicGlossaryData = {
  terms: [],
  criticalPhrases: [],
  transcriptionHints: [],
  verifiedSentences: []
};

const originalModel = process.env.OPENAI_TEXT_TRANSLATION_MODEL;
const originalLightModel = process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT;
const originalNumberGuard = process.env.NUMBER_GUARD;

function responseWithOrderedOutput(polishedKorean: string, translatedText: string) {
  return new Response(JSON.stringify({
    output_text: JSON.stringify({ polishedKorean, translatedText })
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function translationParams(sourceText: string) {
  return {
    apiKey: "test-key",
    safetyIdentifier: "test-safety",
    sourceText,
    instructions: "First polish the Korean, then translate exactly the polished Korean.",
    glossaryData,
    errorLabel: "[test]",
    context: "test-ordered",
    forceStandard: true,
    timeoutMs: 2_000
  };
}

describe("ordered Korean polish and translation", () => {
  beforeEach(() => {
    process.env.OPENAI_TEXT_TRANSLATION_MODEL = "standard-model";
    delete process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT;
    process.env.NUMBER_GUARD = "on";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.OPENAI_TEXT_TRANSLATION_MODEL = originalModel;
    process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT = originalLightModel;
    process.env.NUMBER_GUARD = originalNumberGuard;
  });

  it("returns the readable Korean actually used for a one-call translation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(responseWithOrderedOutput(
      "원장님께서 알맞은 상품을 추천해 주실 거예요.",
      "The director will recommend a suitable product for you."
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      polishKoreanAndTranslateWithOpenAITextSafety(
        translationParams("원장님이 알맞은 상품으로 추천해줄거야")
      )
    ).resolves.toMatchObject({
      polishedSourceText: "원장님께서 알맞은 상품을 추천해 주실 거예요.",
      translatedText: "The director will recommend a suitable product for you.",
      model: "standard-model"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.text.format).toMatchObject({
      type: "json_schema",
      name: "ordered_korean_translation",
      strict: true
    });
  });

  it("fails closed when polishing changes a real price", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWithOrderedOutput("가격은 30만원입니다.", "The price is 300,000 won."))
      .mockResolvedValueOnce(responseWithOrderedOutput("가격은 30만원입니다.", "The price is 300,000 won."));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      polishKoreanAndTranslateWithOpenAITextSafety(
        translationParams("가격은 300만원입니다.")
      )
    ).rejects.toBeInstanceOf(CriticalNumericTranslationError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the strict retry when the final translation restores the price", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWithOrderedOutput("가격은 300만원입니다.", "The price is 300,000 won."))
      .mockResolvedValueOnce(responseWithOrderedOutput("가격은 300만원입니다.", "The price is 3,000,000 won."));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      polishKoreanAndTranslateWithOpenAITextSafety(
        translationParams("가격은 300만원입니다.")
      )
    ).resolves.toMatchObject({
      polishedSourceText: "가격은 300만원입니다.",
      translatedText: "The price is 3,000,000 won."
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
