import { afterEach, describe, expect, it, vi } from "vitest";
import { getCodeGlossaryData } from "./glossary-service";
import { resolveRealtimeVerifiedTranslation } from "./realtime-verified-translation";

describe("Realtime verified translation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("overrides a Realtime model candidate with the approved final translation", () => {
    vi.stubEnv("VERIFIED_SENTENCES", "on");
    const result = resolveRealtimeVerifiedTranslation({
      sourceText: "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 문서에 적겠습니다.",
      sourceTranscriptComplete: true,
      targetLanguage: "en",
      glossaryData: getCodeGlossaryData()
    });

    expect(result).toMatchObject({
      translatedText: "I will record the implant’s manufacturer or model name in the document only based on confirmed records.",
      model: "verified",
      translationSource: "verified"
    });
  });

  it("does not exact-match an incomplete Realtime transcript", () => {
    vi.stubEnv("VERIFIED_SENTENCES", "on");
    expect(resolveRealtimeVerifiedTranslation({
      sourceText: "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 문서에 적겠습니다.",
      sourceTranscriptComplete: false,
      targetLanguage: "en",
      glossaryData: getCodeGlossaryData()
    })).toBeNull();
  });
});
