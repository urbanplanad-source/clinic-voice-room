import { describe, expect, it } from "vitest";
import {
  evaluateTranslationRows,
  parseTranslationEvaluationJsonl,
  validateEvaluationSplitIsolation
} from "./translation-evaluation";

const base = {
  specialty: "dermatology",
  direction: "ko_to_patient" as const,
  sourceLanguage: "ko",
  targetLanguage: "en",
  sourceText: "하루 2번 복용하세요.",
  expectedTranslation: "Take it twice a day.",
  riskTags: ["dose"],
  humanApproved: true
};

describe("translation evaluation datasets", () => {
  it("rejects semantic variants split across evaluation sets", () => {
    const errors = validateEvaluationSplitIsolation([
      { ...base, id: "a", semanticGroupId: "g1", split: "training" },
      { ...base, id: "b", semanticGroupId: "g1", split: "holdout" }
    ]);
    expect(errors[0]).toContain("semantic group leakage");
  });

  it("summarizes deterministic failures", () => {
    const result = evaluateTranslationRows([
      { ...base, id: "a", semanticGroupId: "g1", split: "validation", candidateTranslation: "Take it 3 times a day." }
    ]);
    expect(result.summary.deterministicFail).toBe(1);
    expect(result.summary.issueCounts.number_mismatch).toBe(1);
  });

  it("reports malformed JSONL lines", () => {
    const result = parseTranslationEvaluationJsonl('{"id":"missing fields"}\nnot-json');
    expect(result.errors).toHaveLength(2);
  });
});
