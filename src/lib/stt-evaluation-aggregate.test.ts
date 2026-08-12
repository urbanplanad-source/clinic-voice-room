import { describe, expect, it } from "vitest";
import { aggregateSttEvaluationSets, type SttEvaluationResultRow } from "./stt-evaluation-aggregate";

function row(condition: SttEvaluationResultRow["condition"], overrides: Partial<SttEvaluationResultRow["score"]> = {}): SttEvaluationResultRow {
  return {
    caseId: "STT001",
    condition,
    expectedText: "한약을 말씀해 주세요.",
    transcript: "한약을 말씀해 주세요.",
    requiredTerms: ["한약"],
    riskTags: ["medical_term"],
    latencyMs: condition === "with_clinic_prompt" ? 900 : 800,
    score: {
      exactNormalized: true,
      characterErrorRate: 0,
      requiredTermRecall: 1,
      missingTerms: [],
      numberPreserved: true,
      clinicalUnitPreserved: true,
      ...overrides
    }
  };
}

describe("aggregateSttEvaluationSets", () => {
  it("passes a single-baseline safe evaluation", () => {
    const result = aggregateSttEvaluationSets([{ setId: "speaker01-quiet", baselineId: "code-v4", expectedCaseCount: 1, rows: [row("without_prompt"), row("with_clinic_prompt")] }]);
    expect(result.releaseStatus).toBe("pass");
    expect(result.utteranceCount).toBe(1);
  });

  it("fails on a prompted safety regression", () => {
    const result = aggregateSttEvaluationSets([{
      setId: "speaker01-quiet",
      baselineId: "code-v4",
      expectedCaseCount: 1,
      rows: [row("without_prompt"), row("with_clinic_prompt", { requiredTermRecall: 0, exactNormalized: false, missingTerms: ["한약"] })]
    }]);
    expect(result.releaseStatus).toBe("fail");
    expect(result.failures).toHaveLength(1);
    expect(result.regressions).toHaveLength(1);
  });

  it("fails incomplete result pairs", () => {
    const result = aggregateSttEvaluationSets([{
      setId: "speaker01",
      baselineId: "code-v4",
      expectedCaseCount: 1,
      rows: [row("without_prompt")]
    }]);
    expect(result.gates.completeResultPairs).toBe(false);
    expect(result.releaseStatus).toBe("fail");
  });
  it("fails when result sets mix baselines", () => {
    const rows = [row("without_prompt"), row("with_clinic_prompt")];
    const result = aggregateSttEvaluationSets([
      { setId: "speaker01", baselineId: "code-v4", expectedCaseCount: 1, rows },
      { setId: "speaker02", baselineId: "code-v5", expectedCaseCount: 1, rows }
    ]);
    expect(result.gates.singleBaseline).toBe(false);
    expect(result.releaseStatus).toBe("fail");
  });
});
