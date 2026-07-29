import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClinicGlossaryData } from "./clinic-glossary";
import {
  CriticalNumericTranslationError,
  translateWithOpenAITextSafety
} from "./openai-text-translation";

const glossaryData: ClinicGlossaryData = {
  terms: [],
  criticalPhrases: [],
  transcriptionHints: [],
  verifiedSentences: []
};

const originalModel = process.env.OPENAI_TEXT_TRANSLATION_MODEL;
const originalLightModel = process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT;
const originalNumberGuard = process.env.NUMBER_GUARD;

function responseWithText(outputText: string) {
  return new Response(JSON.stringify({ output_text: outputText }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function translationParams() {
  return {
    apiKey: "test-key",
    safetyIdentifier: "test-safety",
    sourceText: "300,000\uC6D0\uC785\uB2C8\uB2E4.",
    instructions: "Translate faithfully.",
    glossaryData,
    errorLabel: "[test]",
    context: "test",
    timeoutMs: 2_000
  };
}

describe("OpenAI text translation numeric safety", () => {
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

  it("fails closed when a money value is still wrong after retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWithText("The price is 30,000 won."))
      .mockResolvedValueOnce(responseWithText("The price is 30,000 won."));
    vi.stubGlobal("fetch", fetchMock);

    await expect(translateWithOpenAITextSafety(translationParams()))
      .rejects.toBeInstanceOf(CriticalNumericTranslationError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the corrected retry when the money value matches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWithText("The price is 30,000 won."))
      .mockResolvedValueOnce(responseWithText("The price is 300,000 won."));
    vi.stubGlobal("fetch", fetchMock);

    await expect(translateWithOpenAITextSafety(translationParams())).resolves.toMatchObject({
      translatedText: "The price is 300,000 won.",
      model: "standard-model"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed when a clinical volume unit becomes a mass unit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWithText("Inject 1mg."))
      .mockResolvedValueOnce(responseWithText("Inject 1mg."));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      translateWithOpenAITextSafety({
        ...translationParams(),
        sourceText: "Inject 1cc."
      })
    ).rejects.toBeInstanceOf(CriticalNumericTranslationError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts mL as the corrected equivalent of cc", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWithText("Inject 1mg."))
      .mockResolvedValueOnce(responseWithText("Inject 1 mL."));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      translateWithOpenAITextSafety({
        ...translationParams(),
        sourceText: "Inject 1cc."
      })
    ).resolves.toMatchObject({ translatedText: "Inject 1 mL." });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed when number-to-unit pairs are swapped", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWithText("Use 1mg and 2mL."))
      .mockResolvedValueOnce(responseWithText("Use 1mg and 2mL."));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      translateWithOpenAITextSafety({
        ...translationParams(),
        sourceText: "Use 1cc and 2mg."
      })
    ).rejects.toBeInstanceOf(CriticalNumericTranslationError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the translation invents a money value", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWithText("It costs 300,000 won."))
      .mockResolvedValueOnce(responseWithText("It costs 300,000 won."));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      translateWithOpenAITextSafety({
        ...translationParams(),
        sourceText: "It is okay."
      })
    ).rejects.toBeInstanceOf(CriticalNumericTranslationError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
