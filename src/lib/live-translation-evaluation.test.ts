import { describe, expect, it } from "vitest";
import {
  estimateTextModelCostUsd,
  parseLiveEvaluationSourceJsonl,
  selectStratifiedLiveCases,
  summarizeLiveEvaluation,
  type LiveEvaluationResult
} from "./live-translation-evaluation";

const base = {
  semanticGroupId: "group",
  scenario: "문진",
  subcategory: "증상",
  speaker: "clinician",
  sourceDirection: "clinician_to_patient",
  evaluationDirection: "ko_to_patient" as const,
  speechAct: "question",
  standardKo: "아픈가요?",
  spokenVariantsKo: "",
  contextNoteKo: "",
  primaryRiskType: "symptom",
  riskFlags: "",
  requiredTerms: "통증",
  forbiddenChanges: "답변으로 바꾸지 않기",
  sourceQaStatus: "pass",
  humanApproved: false,
  sourceWorkbook: "test.xlsx"
};

describe("live translation evaluation", () => {
  it("parses and detects duplicate source ids", () => {
    const line = JSON.stringify({ ...base, id: "A1", specialty: "피부과", riskLevel: "high" });
    expect(parseLiveEvaluationSourceJsonl(`${line}\n${line}`).errors).toContain("duplicate id: A1");
  });

  it("selects higher-risk cases per specialty first", () => {
    const rows = [
      { ...base, id: "A2", specialty: "피부과", riskLevel: "low" },
      { ...base, id: "A1", specialty: "피부과", riskLevel: "high" }
    ];
    expect(selectStratifiedLiveCases(rows, 1).map((row) => row.id)).toEqual(["A1"]);
  });

  it("calculates published token-rate cost inputs without hidden constants", () => {
    expect(estimateTextModelCostUsd({ inputTokens: 1_000_000, outputTokens: 1_000_000, inputUsdPerMillion: 5, outputUsdPerMillion: 30 })).toBe(35);
  });

  it("summarizes pass rates and latency", () => {
    const row = (status: LiveEvaluationResult["status"], totalMs: number): LiveEvaluationResult => ({
      runId: "run", caseId: status, semanticGroupId: status, specialty: "피부과", targetLanguage: "en", repeat: 1,
      sourceText: "질문", candidateTranslation: "Question?", model: "gpt-5.5", status,
      deterministicStatus: "pass", deterministicFailureReasons: [], semanticStatus: "pass",
      translationMs: totalMs / 2, validationMs: totalMs / 2, totalMs, inputTokens: 1, outputTokens: 1,
      estimatedCostUsd: 0.001, riskLevel: "high", riskTags: [], requiredTerms: "", forbiddenChanges: "", sourceQaStatus: "pass"
    });
    const summary = summarizeLiveEvaluation([row("pass", 100), row("fail", 200)]);
    expect(summary.passRate).toBe(0.5);
    expect(summary.totalEstimatedCostUsd).toBe(0.002);
  });
});

