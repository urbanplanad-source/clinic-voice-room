"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileWarning,
  RotateCcw,
  Save,
  ShieldCheck,
  UserRoundCheck,
  X
} from "lucide-react";
import type {
  DatasetAssetCandidate,
  DatasetAssetType,
  DatasetConflict,
  DatasetDryRunResult
} from "@/lib/medivoice-dataset-import";
import {
  candidateApprovalBlockers,
  conflictDecisionBlockers,
  createCandidateReviewDecision,
  createConflictDecision,
  requiresSecondReview,
  summarizeDatasetReview,
  type CandidateReviewDecision,
  type CandidateReviewStatus,
  type ConflictResolutionAction,
  type DatasetConflictDecision
} from "@/lib/medivoice-dataset-review";

const statusLabels: Record<CandidateReviewStatus, string> = {
  pending: "대기",
  approved: "한국어 승인",
  needs_changes: "수정 요청",
  rejected: "반려"
};

const statusTone: Record<CandidateReviewStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  approved: "bg-emerald-100 text-emerald-800",
  needs_changes: "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-800"
};

const assetLabels: Record<DatasetAssetType, string> = {
  term: "의료 용어",
  critical_phrase: "필수 표현",
  verified_sentence: "검증 문장"
};

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9가-힣_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function downloadJson(fileName: string, payload: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function candidateRiskTone(risk: string) {
  if (risk === "critical") return "border-rose-200 bg-rose-50 text-rose-800";
  if (risk === "high") return "border-orange-200 bg-orange-50 text-orange-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function AdminDatasetReviewWorkspace({ result }: { result: DatasetDryRunResult }) {
  const datasetKey = useMemo(() => result.files.map((file) => `${file.specialty}:${file.fileName}`).sort().join("|"), [result.files]);
  const storageKey = `medivoice-dataset-review:v1:${datasetKey}`;
  const [reviewer, setReviewer] = useState("");
  const [candidateDecisions, setCandidateDecisions] = useState<Record<string, CandidateReviewDecision>>({});
  const [conflictDecisions, setConflictDecisions] = useState<Record<string, DatasetConflictDecision>>({});
  const [loadedStorageKey, setLoadedStorageKey] = useState("");
  const [selectedKey, setSelectedKey] = useState(result.candidates[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | CandidateReviewStatus>("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          reviewer?: string;
          candidateDecisions?: Record<string, CandidateReviewDecision>;
          conflictDecisions?: Record<string, DatasetConflictDecision>;
        };
        setReviewer(parsed.reviewer ?? "");
        setCandidateDecisions(parsed.candidateDecisions ?? {});
        setConflictDecisions(parsed.conflictDecisions ?? {});
      } else {
        setReviewer("");
        setCandidateDecisions({});
        setConflictDecisions({});
      }
    } catch {
      setFeedback("이전에 저장된 검토 상태를 불러오지 못했습니다. 새 검토로 시작합니다.");
    }
    setLoadedStorageKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return;
    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ reviewer, candidateDecisions, conflictDecisions }));
      } catch {
        setFeedback("브라우저 자동 저장 공간이 부족합니다. 검토 JSON을 내려받아 보관해 주세요.");
      }
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [candidateDecisions, conflictDecisions, loadedStorageKey, reviewer, storageKey]);

  const reviewSummary = useMemo(
    () => summarizeDatasetReview(result.candidates, candidateDecisions, result.conflicts, conflictDecisions),
    [candidateDecisions, conflictDecisions, result.candidates, result.conflicts]
  );

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return result.candidates.filter((candidate) => {
      const status = candidateDecisions[candidate.key]?.status ?? "pending";
      if (statusFilter && status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return [candidate.standardKo, candidate.category, candidate.sourceIds.join(" ")]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [candidateDecisions, query, result.candidates, statusFilter]);

  const selectedCandidate = result.candidates.find((candidate) => candidate.key === selectedKey) ?? filteredCandidates[0] ?? result.candidates[0];
  const selectedDecision = selectedCandidate
    ? candidateDecisions[selectedCandidate.key] ?? createCandidateReviewDecision(selectedCandidate)
    : null;
  const unresolvedRelatedConflicts = selectedCandidate
    ? result.conflicts.filter((conflict) => conflict.relatedCandidateKeys.includes(selectedCandidate.key) && !conflictDecisions[conflict.key]?.resolved)
    : [];
  const approvalBlockers = selectedCandidate && selectedDecision
    ? candidateApprovalBlockers(selectedCandidate, { ...selectedDecision, reviewer: selectedDecision.reviewer || reviewer }, unresolvedRelatedConflicts.map((conflict) => conflict.key))
    : [];

  function patchCandidate(candidate: DatasetAssetCandidate, patch: Partial<CandidateReviewDecision>) {
    setCandidateDecisions((current) => ({
      ...current,
      [candidate.key]: {
        ...(current[candidate.key] ?? createCandidateReviewDecision(candidate)),
        reviewer: current[candidate.key]?.reviewer || reviewer,
        ...patch,
        updatedAt: new Date().toISOString()
      }
    }));
    setFeedback("");
  }

  function patchConflict(conflict: DatasetConflict, patch: Partial<DatasetConflictDecision>) {
    if (conflictDecisions[conflict.key]?.resolved && patch.resolved !== true) {
      setCandidateDecisions((current) => Object.fromEntries(Object.entries(current).map(([key, decision]) => [
        key,
        conflict.relatedCandidateKeys.includes(key) ? { ...decision, status: "pending", updatedAt: new Date().toISOString() } : decision
      ])));
    }
    setConflictDecisions((current) => ({
      ...current,
      [conflict.key]: {
        ...(current[conflict.key] ?? createConflictDecision(conflict)),
        reviewer: current[conflict.key]?.reviewer || reviewer,
        ...patch,
        resolved: patch.resolved ?? false,
        updatedAt: new Date().toISOString()
      }
    }));
    setFeedback("");
  }

  function confirmConflict(conflict: DatasetConflict) {
    const decision = conflictDecisions[conflict.key] ?? createConflictDecision(conflict);
    const next = { ...decision, reviewer: decision.reviewer || reviewer };
    const blockers = conflictDecisionBlockers(conflict, next);
    if (blockers.length) {
      setFeedback(blockers[0]);
      return;
    }
    patchConflict(conflict, { ...next, resolved: true });
    setFeedback(`${conflict.label} 충돌 결정을 저장했습니다.`);
  }

  function setCandidateStatus(status: CandidateReviewStatus) {
    if (!selectedCandidate || !selectedDecision) return;
    const next = { ...selectedDecision, reviewer: selectedDecision.reviewer || reviewer };
    if (status === "approved" && approvalBlockers.length) {
      setFeedback(approvalBlockers[0]);
      return;
    }
    if (["needs_changes", "rejected"].includes(status) && (!next.reviewer.trim() || !next.note.trim())) {
      setFeedback("수정 요청·반려에는 검토자 이름과 사유가 필요합니다.");
      return;
    }
    patchCandidate(selectedCandidate, { ...next, status });
    setFeedback(`${selectedCandidate.standardKo} 항목을 ${statusLabels[status]} 상태로 저장했습니다.`);
  }

  function exportReviewPackage() {
    const generatedAt = new Date().toISOString();
    downloadJson(`medivoice-human-review-${safeFilePart(reviewer || "draft")}-${generatedAt.slice(0, 10)}.json`, {
      schemaVersion: 1,
      generatedAt,
      mode: "human_review_draft",
      databaseWrite: false,
      reviewer,
      sourceFiles: result.files,
      reviewSummary,
      conflicts: result.conflicts.map((conflict) => ({ conflict, decision: conflictDecisions[conflict.key] ?? createConflictDecision(conflict) })),
      candidates: result.candidates.map((candidate) => ({ candidate, decision: candidateDecisions[candidate.key] ?? createCandidateReviewDecision(candidate) })),
      releaseGate: {
        koreanMasterApprovedCount: reviewSummary.approved,
        unresolvedConflictCount: reviewSummary.unresolvedConflictCount,
        translationsRequired: 17,
        promotionReady: false,
        reason: "17개 언어 번역과 의료·언어 QA가 완료되기 전에는 운영 DB로 승격하지 않습니다."
      }
    });
    setFeedback("현재 검토 상태를 JSON 파일로 내보냈습니다.");
  }

  function resetReview() {
    if (!window.confirm("이 브라우저에 저장된 현재 데이터셋 검토 상태를 초기화할까요?")) return;
    window.localStorage.removeItem(storageKey);
    setReviewer("");
    setCandidateDecisions({});
    setConflictDecisions({});
    setFeedback("검토 상태를 초기화했습니다.");
  }

  return (
    <section aria-labelledby="human-review-title" className="space-y-5 rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-soft sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">3. 충돌 해결 및 사람 검토</p>
          <h2 id="human-review-title" className="mt-1 text-2xl font-bold text-white">승격 전 검토 워크스페이스</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-300">결정은 브라우저에 자동 저장됩니다. 한국어 승인은 기록할 수 있지만 17개 언어 검수가 끝나기 전에는 운영 DB에 반영되지 않습니다.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-300">검토자 이름</span>
            <input value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="예: 홍길동 원장" className="h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-blue-400 sm:w-52" />
          </label>
          <button type="button" onClick={exportReviewPackage} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-900 hover:bg-blue-50">
            <Download size={17} aria-hidden="true" /> 검토 JSON 내보내기
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["진행률", `${reviewSummary.completionPercent}%`, "text-blue-300"],
          ["대기", reviewSummary.pending, "text-slate-200"],
          ["한국어 승인", reviewSummary.approved, "text-emerald-300"],
          ["수정 요청", reviewSummary.needs_changes, "text-amber-300"],
          ["반려", reviewSummary.rejected, "text-rose-300"],
          ["미해결 충돌", reviewSummary.unresolvedConflictCount, "text-orange-300"]
        ].map(([label, value, tone]) => (
          <article key={String(label)} className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-4">
            <p className="text-xs font-bold text-slate-400">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
          </article>
        ))}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="검토 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={reviewSummary.completionPercent}>
        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${reviewSummary.completionPercent}%` }} />
      </div>

      {feedback ? <p role="status" className="rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 text-sm font-bold text-blue-100">{feedback}</p> : null}

      <div className="rounded-2xl bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileWarning className="text-amber-600" size={20} aria-hidden="true" />
              <h3 className="text-lg font-bold text-ink">충돌 결정</h3>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-500">연결된 용어를 승인하기 전에 충돌부터 해결해야 합니다.</p>
          </div>
          <p className="text-sm font-bold text-slate-600">{reviewSummary.resolvedConflictCount}/{result.conflicts.length}건 해결</p>
        </div>

        <div className={`mt-4 flex flex-col gap-3 rounded-xl border px-4 py-4 sm:flex-row sm:items-end sm:justify-between ${reviewer.trim() ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50"}`}>
          <div className="flex items-start gap-3">
            <UserRoundCheck className={`mt-0.5 shrink-0 ${reviewer.trim() ? "text-emerald-600" : "text-trust"}`} size={19} aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-ink">공통 검토자</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">한 번 입력하면 아래 모든 충돌 결정과 문장 검토에 사용됩니다.</p>
            </div>
          </div>
          <label className="block w-full sm:w-64">
            <span className="mb-1 block text-xs font-bold text-slate-600">검토자 이름 <span className="text-rose-600">필수</span></span>
            <input id="conflict-reviewer-name" value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="예: 홍길동 원장" className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none placeholder:text-slate-400 focus:border-trust focus:ring-2 focus:ring-blue-100" />
          </label>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {result.conflicts.map((conflict) => {
            const decision = conflictDecisions[conflict.key] ?? createConflictDecision(conflict);
            const blockers = conflictDecisionBlockers(conflict, { ...decision, reviewer: decision.reviewer || reviewer });
            return (
              <article key={conflict.key} className={`rounded-xl border p-4 ${decision.resolved ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50/60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500">{conflict.kind === "term_translation" ? "영문 표기 충돌" : "STT 별칭 충돌"}</p>
                    <h4 className="mt-1 text-lg font-bold text-ink">{conflict.label}</h4>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${decision.resolved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{decision.resolved ? "해결" : "결정 필요"}</span>
                </div>
                <p className="mt-2 text-sm font-medium leading-5 text-slate-600">{conflict.description}</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-slate-600">처리 방식</span>
                    <select value={decision.action} disabled={decision.resolved || conflict.kind === "term_translation"} onChange={(event) => patchConflict(conflict, { action: event.target.value as ConflictResolutionAction, selectedOption: "" })} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust disabled:bg-slate-100">
                      {conflict.kind === "term_translation" ? <option value="canonical">대표 표기 선택</option> : <>
                        <option value="">방식 선택</option>
                        <option value="canonical">한 표준용어에 연결</option>
                        <option value="stt_only">STT 힌트로만 유지</option>
                        <option value="disambiguate">재확인 질문 사용</option>
                        <option value="exclude">자동 매핑에서 제외</option>
                      </>}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-slate-600">{conflict.kind === "term_translation" ? "대표 영문" : "연결 표준용어"}</span>
                    <select value={decision.selectedOption} disabled={decision.resolved || decision.action !== "canonical"} onChange={(event) => patchConflict(conflict, { selectedOption: event.target.value })} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust disabled:bg-slate-100">
                      <option value="">선택</option>
                      {conflict.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">결정 사유</span>
                  <textarea value={decision.note} disabled={decision.resolved} onChange={(event) => patchConflict(conflict, { note: event.target.value })} rows={2} placeholder="의료적 차이, 환자 친화 표현, STT 처리 원칙 등을 기록" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium outline-none focus:border-trust disabled:bg-slate-100" />
                </label>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-500">{decision.resolved ? `${decision.reviewer} · 결정 저장됨` : blockers[0] ?? "결정 가능"}</p>
                  {decision.resolved ? (
                    <button type="button" onClick={() => patchConflict(conflict, { resolved: false })} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><RotateCcw size={15} aria-hidden="true" /> 결정 수정</button>
                  ) : (
                    <button type="button" disabled={blockers.length > 0} onClick={() => confirmConflict(conflict)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-ink px-3 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Check size={15} aria-hidden="true" /> 결정 확정</button>
                  )}
                </div>
              </article>
            );
          })}
          {result.conflicts.length === 0 ? <p className="rounded-xl bg-emerald-50 px-4 py-6 text-center text-sm font-bold text-emerald-700 lg:col-span-2">구조화된 충돌 항목이 없습니다.</p> : null}
        </div>
      </div>

      <div className="grid min-h-[640px] overflow-hidden rounded-2xl bg-white lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,0.58fr)]">
        <div className="border-b border-line lg:border-b-0 lg:border-r">
          <div className="border-b border-line p-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="text-trust" size={20} aria-hidden="true" />
              <h3 className="font-bold text-ink">검토 대기열</h3>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_140px]">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="문장·용어·ID 검색" className="h-10 rounded-xl border border-line bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white" />
              <select aria-label="검토 상태 필터" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "" | CandidateReviewStatus)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust">
                <option value="">전체 상태</option>
                {(Object.keys(statusLabels) as CandidateReviewStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
              </select>
            </div>
          </div>
          <div className="max-h-[580px] overflow-y-auto">
            {filteredCandidates.map((candidate) => {
              const decision = candidateDecisions[candidate.key];
              const status = decision?.status ?? "pending";
              const selected = selectedCandidate?.key === candidate.key;
              return (
                <button key={candidate.key} type="button" onClick={() => setSelectedKey(candidate.key)} style={{ contentVisibility: "auto", containIntrinsicSize: "76px" }} className={`flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition ${selected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                  <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone[status]}`}>{statusLabels[status]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-bold leading-5 text-ink">{decision?.reviewedStandardKo || candidate.standardKo}</span>
                    <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{assetLabels[candidate.assetType]} · {candidate.riskLevel || "미분류"}</span>
                  </span>
                  <ChevronRight className={`mt-1 shrink-0 ${selected ? "text-trust" : "text-slate-300"}`} size={16} aria-hidden="true" />
                </button>
              );
            })}
            {filteredCandidates.length === 0 ? <p className="px-4 py-10 text-center text-sm font-semibold text-slate-500">조건에 맞는 검토 항목이 없습니다.</p> : null}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {selectedCandidate && selectedDecision ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${candidateRiskTone(selectedCandidate.riskLevel)}`}>{selectedCandidate.riskLevel || "미분류"}</span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-trust">{assetLabels[selectedDecision.assetType]}</span>
                    {requiresSecondReview(selectedCandidate, selectedDecision.assetType) ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800">이중 승인</span> : null}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-500">{selectedCandidate.sourceIds.join(" · ")}</p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${statusTone[selectedDecision.status]}`}>{statusLabels[selectedDecision.status]}</span>
              </div>

              {unresolvedRelatedConflicts.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertTriangle size={17} aria-hidden="true" /> 연결된 충돌 {unresolvedRelatedConflicts.length}건이 미해결 상태입니다.</p>
                  <p className="mt-1 text-xs font-semibold text-amber-800">{unresolvedRelatedConflicts.map((conflict) => conflict.label).join(" · ")}</p>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">검토된 한국어 기준문장</span>
                <textarea value={selectedDecision.reviewedStandardKo} onChange={(event) => patchCandidate(selectedCandidate, { reviewedStandardKo: event.target.value, status: "pending" })} rows={3} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base font-bold leading-7 text-ink outline-none focus:border-trust" />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">자산 유형</span>
                  <select value={selectedDecision.assetType} onChange={(event) => patchCandidate(selectedCandidate, { assetType: event.target.value as DatasetAssetType, status: "pending" })} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust">
                    {(Object.keys(assetLabels) as DatasetAssetType[]).map((type) => <option key={type} value={type}>{assetLabels[type]}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">적용 범위</span>
                  <select value={selectedDecision.scope} onChange={(event) => patchCandidate(selectedCandidate, { scope: event.target.value as "global" | "specialty", status: "pending" })} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust">
                    <option value="specialty">해당 진료과만</option>
                    <option value="global">전체 진료과 공통</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${selectedDecision.medicalApproved ? "border-emerald-300 bg-emerald-50" : "border-line bg-slate-50"}`}>
                  <input type="checkbox" checked={selectedDecision.medicalApproved} onChange={(event) => patchCandidate(selectedCandidate, { medicalApproved: event.target.checked, status: "pending" })} className="mt-1 size-4 accent-emerald-600" />
                  <span><span className="block text-sm font-bold text-ink">의료 내용 확인</span><span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">의미, 금기, 수치와 진료 상황을 확인했습니다.</span></span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${selectedDecision.languageQaApproved ? "border-violet-300 bg-violet-50" : "border-line bg-slate-50"}`}>
                  <input type="checkbox" checked={selectedDecision.languageQaApproved} onChange={(event) => patchCandidate(selectedCandidate, { languageQaApproved: event.target.checked, status: "pending" })} className="mt-1 size-4 accent-violet-600" />
                  <span><span className="block text-sm font-bold text-ink">언어·안전 QA</span><span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">방향, 부정, 질문·명령 및 필수어를 확인했습니다.</span></span>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">필수어</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{selectedCandidate.requiredTerms.join(" · ") || "지정 없음"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">금지 변형</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{selectedCandidate.forbiddenChanges.join(" · ") || "지정 없음"}</p>
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">검토 사유 및 수정 메모</span>
                <textarea value={selectedDecision.note} onChange={(event) => patchCandidate(selectedCandidate, { note: event.target.value })} rows={3} placeholder="승인 근거, 수정할 내용 또는 반려 사유를 기록" className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium leading-6 outline-none focus:border-trust" />
              </label>

              {approvalBlockers.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-bold text-amber-900">승인 전 확인</p>
                  <ul className="mt-2 space-y-1 text-sm font-semibold text-amber-800">{approvalBlockers.map((blocker) => <li key={blocker}>· {blocker}</li>)}</ul>
                </div>
              ) : (
                <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><BadgeCheck size={18} aria-hidden="true" /> 한국어 마스터 승인 조건을 충족했습니다.</p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setCandidateStatus("rejected")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 hover:bg-rose-50"><X size={17} aria-hidden="true" /> 반려</button>
                <button type="button" onClick={() => setCandidateStatus("needs_changes")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 text-sm font-bold text-amber-800 hover:bg-amber-50"><FileWarning size={17} aria-hidden="true" /> 수정 요청</button>
                <button type="button" disabled={approvalBlockers.length > 0} onClick={() => setCandidateStatus("approved")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"><UserRoundCheck size={17} aria-hidden="true" /> 한국어 승인</button>
              </div>
            </div>
          ) : <p className="py-16 text-center text-sm font-semibold text-slate-500">검토할 항목이 없습니다.</p>}
        </div>
      </div>

      <footer className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-blue-300" size={19} aria-hidden="true" />
          <p className="text-xs font-semibold leading-5 text-slate-300"><b className="text-white">안전 게이트:</b> 여기서의 승인은 한국어 기준 데이터 승인입니다. 실제 승격은 17개 언어 번역·숫자 보존·의료 QA를 마친 별도 패키지에서만 허용됩니다.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={resetReview} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-600 px-3 text-xs font-bold text-slate-300 hover:bg-slate-800"><RotateCcw size={15} aria-hidden="true" /> 초기화</button>
          <button type="button" onClick={exportReviewPackage} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-500"><Save size={15} aria-hidden="true" /> 검토본 저장</button>
        </div>
      </footer>
    </section>
  );
}
