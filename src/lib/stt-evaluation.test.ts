import { describe, expect, it } from "vitest";
import { scoreSttTranscript, summarizeSttScores } from "./stt-evaluation";

const testCase = {
  id: "STT001",
  expectedText: "써마지 FLX 600샷으로 진행하겠습니다.",
  requiredTerms: ["써마지 FLX", "600샷"],
  riskTags: ["brand", "number_unit"]
};

describe("STT evaluation scoring", () => {
  it("passes normalized punctuation and spacing differences", () => {
    const score = scoreSttTranscript(testCase, "써마지 FLX 600샷으로 진행하겠습니다");
    expect(score).toMatchObject({
      exactNormalized: true,
      requiredTermRecall: 1,
      numberPreserved: true,
      clinicalUnitPreserved: true
    });
  });

  it("detects a medical term and numeric-unit transcription loss", () => {
    const score = scoreSttTranscript(testCase, "서머지로 진행하겠습니다.");
    expect(score.exactNormalized).toBe(false);
    expect(score.requiredTermRecall).toBe(0);
    expect(score.numberPreserved).toBe(false);
    expect(score.clinicalUnitPreserved).toBe(false);
  });

  it("accepts an approved spoken alternative for a brand", () => {
    const result = scoreSttTranscript({
      id: "STT007",
      expectedText: "Re2O 스킨부스터 시술이 맞나요?",
      requiredTerms: [["Re2O", "리투오"], "스킨부스터"],
      riskTags: ["brand"]
    }, "리투오 스킨부스터 시술이 맞나요?");
    expect(result.requiredTermRecall).toBe(1);
    expect(result.missingTerms).toEqual([]);
  });
  it("preserves Traditional Chinese and Cantonese characters when scoring", () => {
    const result = scoreSttTranscript({
      id: "STT-YUE-001",
      expectedText: "我唔同意藥針，請即刻打119。",
      requiredTerms: ["唔同意藥針", "119"],
      riskTags: ["consent", "emergency"]
    }, "我唔同意藥針，請即刻打119");
    expect(result).toMatchObject({
      exactNormalized: true,
      requiredTermRecall: 1,
      numberPreserved: true
    });
  });

  it("detects a Traditional Chinese laterality and dose loss", () => {
    const result = scoreSttTranscript({
      id: "STT-ZHTW-001",
      expectedText: "右邊300發、左邊300發。",
      requiredTerms: ["右邊300發", "左邊300發"],
      riskTags: ["body_side", "number_unit"]
    }, "右邊300發");
    expect(result.exactNormalized).toBe(false);
    expect(result.requiredTermRecall).toBe(0.5);
  });

  it("treats Arabic and spoken Chinese medical numbers as equivalent", () => {
    const result = scoreSttTranscript({
      id: "STT-YUE-002",
      expectedText: "我而家懷孕12週；如果呼吸困難，請即刻打119，唔好改做911。",
      requiredTerms: [
        ["懷孕12週", "懷孕十二週"],
        ["119", "一一九"],
        ["唔好改做911", "唔好改做九一一"]
      ],
      riskTags: ["pregnancy", "emergency", "number"]
    }, "我而家懷孕十二週；如果呼吸困難，請即刻打一一九，唔好改做九一一。");
    expect(result).toMatchObject({
      requiredTermRecall: 1,
      numberPreserved: true
    });
  });

  it("treats Chinese shot-unit wording as equivalent to Arabic numerals", () => {
    const result = scoreSttTranscript({
      id: "STT-ZHTW-002",
      expectedText: "總共600發，右邊300發、左邊300發，不是每邊600發。",
      requiredTerms: [
        ["總共600發", "總共六百發"],
        ["右邊300發", "右邊三百發"],
        ["左邊300發", "左邊三百發"],
        ["不是每邊600發", "不是每邊六百發"]
      ],
      riskTags: ["body_side", "number_unit", "negation"]
    }, "總共六百發，右邊三百發、左邊三百發，不是每邊六百發。");
    expect(result).toMatchObject({
      requiredTermRecall: 1,
      numberPreserved: true,
      clinicalUnitPreserved: true
    });
  });

  it("summarizes paired evaluation scores", () => {
    const summary = summarizeSttScores([
      scoreSttTranscript(testCase, testCase.expectedText),
      scoreSttTranscript(testCase, "서머지로 진행하겠습니다.")
    ]);
    expect(summary.count).toBe(2);
    expect(summary.exactRate).toBe(0.5);
    expect(summary.meanRequiredTermRecall).toBe(0.5);
    expect(summary.safetyPassRate).toBe(0.5);
  });
});
