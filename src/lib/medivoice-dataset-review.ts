import type {
  DatasetAssetCandidate,
  DatasetAssetType,
  DatasetConflict
} from "./medivoice-dataset-import";

export type CandidateReviewStatus = "pending" | "approved" | "needs_changes" | "rejected";
export type ConflictResolutionAction = "" | "canonical" | "stt_only" | "disambiguate" | "exclude";

export type CandidateReviewDecision = {
  status: CandidateReviewStatus;
  reviewedStandardKo: string;
  assetType: DatasetAssetType;
  scope: "global" | "specialty";
  medicalApproved: boolean;
  languageQaApproved: boolean;
  reviewer: string;
  note: string;
  updatedAt: string;
};

export type DatasetConflictDecision = {
  action: ConflictResolutionAction;
  selectedOption: string;
  reviewer: string;
  note: string;
  resolved: boolean;
  updatedAt: string;
};

export function requiresSecondReview(candidate: DatasetAssetCandidate, assetType: DatasetAssetType = candidate.assetType) {
  return assetType === "critical_phrase" || ["high", "critical"].includes(candidate.riskLevel);
}

export function createCandidateReviewDecision(candidate: DatasetAssetCandidate): CandidateReviewDecision {
  return {
    status: "pending",
    reviewedStandardKo: candidate.standardKo,
    assetType: candidate.assetType,
    scope: candidate.scope,
    medicalApproved: false,
    languageQaApproved: false,
    reviewer: "",
    note: "",
    updatedAt: ""
  };
}

export function createConflictDecision(conflict: DatasetConflict): DatasetConflictDecision {
  return {
    action: conflict.kind === "term_translation" ? "canonical" : "",
    selectedOption: "",
    reviewer: "",
    note: "",
    resolved: false,
    updatedAt: ""
  };
}

export function conflictDecisionBlockers(conflict: DatasetConflict, decision: DatasetConflictDecision) {
  const blockers: string[] = [];
  if (!decision.reviewer.trim()) blockers.push("위의 공통 검토자 이름을 입력하면 결정 확정 버튼이 활성화됩니다.");
  if (!decision.action) blockers.push("처리 방식을 선택하세요.");
  if (conflict.kind === "term_translation" && decision.action !== "canonical") blockers.push("대표 영문 표기를 선택해야 합니다.");
  if (decision.action === "canonical" && !decision.selectedOption.trim()) blockers.push("연결할 대표 항목을 선택하세요.");
  return blockers;
}

export function candidateApprovalBlockers(
  candidate: DatasetAssetCandidate,
  decision: CandidateReviewDecision,
  unresolvedConflictKeys: string[]
) {
  const blockers: string[] = [];
  if (!decision.reviewer.trim()) blockers.push("검토자 이름이 필요합니다.");
  if (!decision.reviewedStandardKo.trim()) blockers.push("검토된 한국어 기준문장이 비어 있습니다.");
  if (!decision.medicalApproved) blockers.push("의료 내용 확인이 필요합니다.");
  if (requiresSecondReview(candidate, decision.assetType) && !decision.languageQaApproved) blockers.push("high/critical 항목은 언어·안전 QA의 추가 확인이 필요합니다.");
  if (unresolvedConflictKeys.length) blockers.push(`연결된 충돌 ${unresolvedConflictKeys.length}건을 먼저 해결해야 합니다.`);
  return blockers;
}

export function summarizeDatasetReview(
  candidates: DatasetAssetCandidate[],
  candidateDecisions: Record<string, CandidateReviewDecision>,
  conflicts: DatasetConflict[],
  conflictDecisions: Record<string, DatasetConflictDecision>
) {
  const counts: Record<CandidateReviewStatus, number> = {
    pending: 0,
    approved: 0,
    needs_changes: 0,
    rejected: 0
  };
  for (const candidate of candidates) {
    counts[candidateDecisions[candidate.key]?.status ?? "pending"] += 1;
  }
  const resolvedConflictCount = conflicts.filter((conflict) => conflictDecisions[conflict.key]?.resolved).length;
  return {
    ...counts,
    resolvedConflictCount,
    unresolvedConflictCount: conflicts.length - resolvedConflictCount,
    completionPercent: candidates.length ? Math.round(((counts.approved + counts.needs_changes + counts.rejected) / candidates.length) * 100) : 0
  };
}
