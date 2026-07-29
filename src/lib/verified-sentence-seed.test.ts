import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ClinicGlossaryData } from "./clinic-glossary";
import { patientLanguages } from "./languages";
import { verifiedSentenceSeedEntries } from "./verified-sentence-seed";
import { matchVerifiedSentence } from "./verified-sentences";

const manualStandardKoreanSentences = [
  "누가 먼저 하실까요?",
  "시간은 얼마나 걸릴까요?",
  "오늘 보톡스 시술을 원하시는 게 맞으세요?",
  "몸무게가 어떻게 되세요?",
  "써마지 FLX 600샷 시술은 얼마나 걸리나요?",
  "이 시술을 받으면 할인이 가능한가요?",
  "의사와 상담한 후 어떤 시술을 받을지 결정할 수 있을까요?",
  "의사 상담 비용이 따로 있나요?",
  "수분크림과 진정크림을 발라드릴게요.",
  "선크림도 발라드릴까요?",
  "가방을 잘 챙기신 후 데스크로 가시면 됩니다."
] as const;

const manualEntries = manualStandardKoreanSentences.map((standardKo) => {
  const entry = verifiedSentenceSeedEntries.find((candidate) => candidate.standardKo === standardKo);
  if (!entry) throw new Error(`Missing manual verified sentence seed: ${standardKo}`);
  return entry;
});

const glossaryData: ClinicGlossaryData = {
  terms: [],
  criticalPhrases: [],
  transcriptionHints: [],
  verifiedSentences: manualEntries
};

describe("manual multilingual verified sentence seeds", () => {
  const originalFlag = process.env.VERIFIED_SENTENCES;

  beforeEach(() => {
    process.env.VERIFIED_SENTENCES = "on";
  });

  afterEach(() => {
    process.env.VERIFIED_SENTENCES = originalFlag;
  });

  it("includes every patient language for all 11 operator-provided sentences", () => {
    const expectedLanguages = [...patientLanguages].sort();

    for (const entry of manualEntries) {
      expect(Object.keys(entry.translations).sort()).toEqual(expectedLanguages);
      for (const language of patientLanguages) {
        expect(entry.translations[language]?.trim()).toBeTruthy();
      }
    }
  });

  it("matches Korean staff speech to the selected patient language", () => {
    const match = matchVerifiedSentence("오늘 보톡스 시술 원하는 거 맞으세요?", "zh_tw", glossaryData);
    expect(match?.translatedText).toBe("您今天是想施打肉毒桿菌素，對嗎？");
  });

  it("matches supplied and generated patient speech back to standard Korean", () => {
    expect(matchVerifiedSentence("How much time will this treatment take Thermage FLX 600s?", "ko", glossaryData)?.translatedText).toBe(
      "써마지 FLX 600샷 시술은 얼마나 걸리나요?"
    );
    expect(matchVerifiedSentence("請問要幾耐？", "ko", glossaryData)?.translatedText).toBe("시간은 얼마나 걸릴까요?");
  });
});

describe("shared verified sentence seed catalog", () => {
  it("contains 36 unique global sentences for both specialties", () => {
    expect(verifiedSentenceSeedEntries).toHaveLength(36);
    expect(new Set(verifiedSentenceSeedEntries.map((entry) => entry.standardKo)).size).toBe(36);

    for (const entry of verifiedSentenceSeedEntries) {
      expect(entry.specialty).toBeNull();
    }
  });

  it("includes every patient language for all 36 sentences", () => {
    const expectedLanguages = [...patientLanguages].sort();

    for (const entry of verifiedSentenceSeedEntries) {
      expect(Object.keys(entry.translations).sort()).toEqual(expectedLanguages);
      for (const language of patientLanguages) {
        expect(entry.translations[language]?.trim()).toBeTruthy();
        expect(entry.spoken).toContain(entry.translations[language]);
      }
    }
  });
});
