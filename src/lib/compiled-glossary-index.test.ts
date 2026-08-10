import { describe, expect, it } from "vitest";
import type { ClinicGlossaryData } from "./clinic-glossary";
import { compileGlossaryIndex, compiledGlossaryHasTerm, matchedGlossaryEntryIds } from "./compiled-glossary-index";

const glossary: ClinicGlossaryData = {
  terms: [{ spoken: ["써마지"], standardKo: "Thermage FLX", zh: "Thermage FLX", ja: "Thermage FLX", en: "Thermage FLX", ru: "Thermage FLX", vi: "Thermage FLX", id: "Thermage FLX", category: "brand", note: "" }],
  criticalPhrases: [],
  transcriptionHints: [],
  verifiedSentences: [{ spoken: ["눈 떠주세요"], standardKo: "눈을 떠 주세요.", translations: { en: "Please open your eyes." }, category: "procedure", note: "" }]
};

describe("compiled glossary index", () => {
  it("reuses one immutable index per glossary snapshot", () => {
    expect(compileGlossaryIndex(glossary)).toBe(compileGlossaryIndex(glossary));
  });

  it("finds terms without linearly scanning every glossary entry", () => {
    expect(compiledGlossaryHasTerm("오늘 써마지 시술을 합니다.", glossary)).toBe(true);
    expect(compiledGlossaryHasTerm("오늘 상담을 합니다.", glossary)).toBe(false);
  });

  it("returns stable ids for matched diagnostics", () => {
    expect(matchedGlossaryEntryIds("오늘 써마지 시술을 합니다.", glossary)).toContain("term:0");
  });
});
