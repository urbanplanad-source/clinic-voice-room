import { describe, expect, it } from "vitest";
import {
  candidateApprovalBlockers,
  conflictDecisionBlockers,
  createCandidateReviewDecision,
  createConflictDecision,
  requiresSecondReview
} from "./medivoice-dataset-review";
import type { DatasetAssetCandidate, DatasetConflict } from "./medivoice-dataset-import";

const candidate: DatasetAssetCandidate = {
  key: "sentence:test",
  assetType: "critical_phrase",
  scope: "specialty",
  specialty: "dermatology",
  sourceIds: ["dermatology:D001"],
  standardKo: "숨쉬기 어려우면 즉시 알려 주세요.",
  spokenForms: [],
  category: "응급",
  riskLevel: "critical",
  speechAct: "warning",
  direction: "clinician_to_patient",
  requiredTerms: ["즉시"],
  forbiddenChanges: ["부정 반전 금지"],
  evidenceIds: ["E01"],
  promotionReady: false,
  readinessReason: "검토 필요"
};

const conflict: DatasetConflict = {
  key: "term-translation:부종",
  kind: "term_translation",
  label: "부종",
  description: "영문 표기 충돌",
  options: ["edema", "swelling"],
  sourceIds: ["dermatology:DGL003", "plastic_surgery:PLG041"],
  relatedCandidateKeys: ["term:부종"]
};

describe("medivoice dataset human review", () => {
  it("requires two checks for high-risk or critical phrases", () => {
    expect(requiresSecondReview(candidate)).toBe(true);
    const decision = createCandidateReviewDecision(candidate);
    decision.reviewer = "검토자";
    decision.medicalApproved = true;
    expect(candidateApprovalBlockers(candidate, decision, [])).toContain("high/critical 항목은 언어·안전 QA의 추가 확인이 필요합니다.");
    decision.languageQaApproved = true;
    expect(candidateApprovalBlockers(candidate, decision, [])).toEqual([]);
  });

  it("blocks approval until related conflicts are resolved", () => {
    const decision = createCandidateReviewDecision(candidate);
    decision.reviewer = "검토자";
    decision.medicalApproved = true;
    decision.languageQaApproved = true;
    expect(candidateApprovalBlockers(candidate, decision, [conflict.key])).toContain("연결된 충돌 1건을 먼저 해결해야 합니다.");
  });

  it("requires a reviewer and canonical option for term conflicts", () => {
    const decision = createConflictDecision(conflict);
    expect(conflictDecisionBlockers(conflict, decision)).toHaveLength(2);
    decision.reviewer = "검토자";
    decision.selectedOption = "edema";
    expect(conflictDecisionBlockers(conflict, decision)).toEqual([]);
  });
});
