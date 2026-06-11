import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ClinicGlossaryData } from "./clinic-glossary";
import { matchVerifiedSentence, normalizeForMatch } from "./verified-sentences";

const glossaryData: ClinicGlossaryData = {
  terms: [],
  criticalPhrases: [],
  transcriptionHints: [],
  verifiedSentences: [
    {
      spoken: ["레이저시술후 일주일간 사우나는 피해주세요"],
      standardKo: "레이저 시술 후 일주일간 사우나는 피해주세요.",
      translations: {
        en: "Please avoid saunas for one week after the laser treatment.",
        ja: "レーザー施術後1週間はサウナを避けてください。"
      },
      category: "aftercare",
      note: "reviewed"
    }
  ]
};

describe("verified sentences", () => {
  const originalFlag = process.env.VERIFIED_SENTENCES;

  beforeEach(() => {
    process.env.VERIFIED_SENTENCES = "on";
  });

  afterEach(() => {
    process.env.VERIFIED_SENTENCES = originalFlag;
  });

  it("normalizes spacing and punctuation only", () => {
    expect(normalizeForMatch("레이저 시술 후 일주일간 사우나는 피해주세요.")).toBe(normalizeForMatch("레이저시술후 일주일간 사우나는 피해주세요"));
  });

  it("matches only exact normalized candidates", () => {
    const match = matchVerifiedSentence("레이저시술후 일주일간 사우나는 피해주세요!", "en", glossaryData);
    expect(match?.translatedText).toBe("Please avoid saunas for one week after the laser treatment.");
    expect(matchVerifiedSentence("레이저 시술 후 사우나는 피해주세요", "en", glossaryData)).toBeNull();
  });

  it("falls through when the requested language is not directly registered", () => {
    expect(matchVerifiedSentence("레이저시술후 일주일간 사우나는 피해주세요", "zh", glossaryData)).toBeNull();
  });

  it("is disabled unless VERIFIED_SENTENCES is on", () => {
    process.env.VERIFIED_SENTENCES = "off";
    expect(matchVerifiedSentence("레이저시술후 일주일간 사우나는 피해주세요", "en", glossaryData)).toBeNull();
  });
});
