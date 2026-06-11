import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ClinicGlossaryData } from "./clinic-glossary";
import { routeTranslationModel } from "./model-router";

const glossaryData: ClinicGlossaryData = {
  terms: [
    {
      spoken: ["리쥬란"],
      standardKo: "리쥬란",
      zh: "Rejuran",
      ja: "リジュラン",
      en: "Rejuran",
      ru: "Rejuran",
      vi: "Rejuran",
      id: "Rejuran",
      category: "procedure",
      note: ""
    }
  ],
  criticalPhrases: [],
  transcriptionHints: [],
  verifiedSentences: []
};

describe("model router", () => {
  const originalStandard = process.env.OPENAI_TEXT_TRANSLATION_MODEL;
  const originalLight = process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT;

  beforeEach(() => {
    process.env.OPENAI_TEXT_TRANSLATION_MODEL = "standard-model";
    process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT = "light-model";
  });

  afterEach(() => {
    process.env.OPENAI_TEXT_TRANSLATION_MODEL = originalStandard;
    process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT = originalLight;
  });

  it("disables routing when the light model env is unset", () => {
    delete process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT;
    expect(routeTranslationModel("감사합니다", glossaryData)).toMatchObject({ tier: "standard", model: "standard-model", reason: "light_env_unset" });
  });

  it("routes short safe text to light", () => {
    expect(routeTranslationModel("잠시만 기다려주세요", glossaryData)).toMatchObject({ tier: "light", model: "light-model" });
  });

  it("blocks light routing for long text", () => {
    expect(routeTranslationModel("안녕하세요. 오늘 시술 전 안내 문장을 길게 확인하겠습니다.", glossaryData).reason).toBe("long_text");
  });

  it("blocks light routing for numbers", () => {
    expect(routeTranslationModel("3일 후 오세요", glossaryData).reason).toBe("number_present");
  });

  it("blocks light routing for high risk keywords", () => {
    expect(routeTranslationModel("동의하시면 서명해주세요", glossaryData).reason).toBe("high_risk");
  });

  it("blocks light routing for glossary term hits", () => {
    expect(routeTranslationModel("리쥬란 시술 부위에 통증이 있어요", glossaryData).reason).toBe("glossary_hit");
  });
});
