"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  Copy,
  Database,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  WandSparkles
} from "lucide-react";
import { changedTranscriptionSpan } from "@/lib/clinic-transcription";
import { AdminQualityWorkspaceNav } from "./AdminQualityWorkspaceNav";
import { AdminLoadingSkeleton } from "@/components/AdminLoadingSkeleton";

type SampleSource = "local_voice" | "consultation_voice" | "procedure_voice";
type SampleStatus = "new" | "reviewed" | "fixed" | "dismissed";
type ReviewKind = "source_correct" | "stt_error" | "translation_error" | "noise" | "uncertain";
type AssetType = "none" | "transcription_hint" | "term" | "verified_sentence";
type PromotionScope = "hospital" | "specialty" | "global";

type HospitalOption = { id: string; name: string; slug: string };
type TranslationSample = {
  id: string;
  hospitalId: string;
  hospital?: { id: string; name: string; slug: string } | null;
  staffId: string | null;
  staff?: { id: string; name: string; email: string } | null;
  roomId: string | null;
  messageId: string | null;
  source: SampleSource;
  mode: string;
  direction: string;
  patientLanguage: string | null;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  model: string | null;
  guardFlags: Record<string, unknown> | null;
  status: SampleStatus;
  createdAt: string;
  reviewedAt: string | null;
};

type ReviewDraft = {
  reviewKind: ReviewKind;
  correctedSourceText: string;
  correctedTranslatedText: string;
  reviewNote: string;
  assetType: AssetType;
  assetStandardKo: string;
  assetSpokenForm: string;
  assetTranslation: string;
  assetCategory: string;
  promotionScope: PromotionScope;
};

const statusLabels: Record<SampleStatus, string> = { new: "대기", reviewed: "검수 완료", fixed: "자산 반영", dismissed: "제외" };
const sourceLabels: Record<SampleSource, string> = { local_voice: "Face-to-face", consultation_voice: "Consultation", procedure_voice: "Procedure" };
const reviewKindLabels: Record<ReviewKind, string> = {
  source_correct: "원문·번역 정상",
  stt_error: "음성 인식 오류",
  translation_error: "번역 오류",
  noise: "잡음·무의미",
  uncertain: "판단 보류"
};
const assetLabels: Record<Exclude<AssetType, "none">, { title: string; description: string }> = {
  transcription_hint: { title: "STT 힌트", description: "잘못 들은 표현을 표준 한국어로 교정" },
  term: { title: "의료 용어", description: "브랜드·시술·의학 용어의 표준 번역 정의" },
  verified_sentence: { title: "검증문장", description: "질문·명령·부정 표현을 포함한 기준 문장" }
};

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function initialDraft(sample: TranslationSample): ReviewDraft {
  const review = objectValue(objectValue(sample.guardFlags).adminReview);
  const reviewKind = stringValue(review.kind) as ReviewKind;
  const storedAssetType = stringValue(review.assetType) || stringValue(review.promotedEntryType);
  const correctedSourceText = stringValue(review.correctedSourceText) || sample.sourceText;
  const correctedTranslatedText = stringValue(review.correctedTranslatedText) || sample.translatedText;
  const koreanText = sample.sourceLanguage === "ko" ? correctedSourceText : sample.targetLanguage === "ko" ? correctedTranslatedText : "";
  const translatedText = sample.sourceLanguage === "ko" ? correctedTranslatedText : sample.targetLanguage === "ko" ? correctedSourceText : "";
  return {
    reviewKind: reviewKind in reviewKindLabels ? reviewKind : "source_correct",
    correctedSourceText,
    correctedTranslatedText,
    reviewNote: stringValue(review.note),
    assetType: storedAssetType in assetLabels ? storedAssetType as Exclude<AssetType, "none"> : "none",
    assetStandardKo: stringValue(review.assetStandardKo) || stringValue(review.hintCanonicalForm) || koreanText,
    assetSpokenForm: stringValue(review.assetSpokenForm) || stringValue(review.hintObservedForm),
    assetTranslation: stringValue(review.assetTranslation) || translatedText,
    assetCategory: stringValue(review.assetCategory) || stringValue(review.hintCategory) || "sample_review",
    promotionScope: (["hospital", "specialty", "global"] as string[]).includes(stringValue(review.promotionScope)) ? stringValue(review.promotionScope) as PromotionScope : "hospital"
  };
}

function statusStyle(status: SampleStatus) {
  return status === "fixed" ? "bg-emerald-50 text-emerald-700" : status === "dismissed" ? "bg-slate-100 text-slate-500" : status === "reviewed" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700";
}

export function AdminTranslationQualityWorkspace() {
  const [samples, setSamples] = useState<TranslationSample[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [selectedId, setSelectedId] = useState("");
  const [filters, setFilters] = useState({ q: "", hospitalId: "", source: "", status: "new" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.hospitalId) params.set("hospitalId", filters.hospitalId);
    if (filters.source) params.set("source", filters.source);
    if (filters.status) params.set("status", filters.status);
    return params.toString();
  }, [filters.hospitalId, filters.source, filters.status]);

  const filteredSamples = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    if (!query) return samples;
    return samples.filter((sample) => [sample.sourceText, sample.translatedText, sample.hospital?.name ?? "", sample.staff?.name ?? "", sample.sourceLanguage, sample.targetLanguage].join(" ").toLowerCase().includes(query));
  }, [filters.q, samples]);

  const selected = filteredSamples.find((sample) => sample.id === selectedId) ?? filteredSamples[0] ?? null;
  const draft = selected ? drafts[selected.id] ?? initialDraft(selected) : null;
  const selectedIndex = selected ? filteredSamples.findIndex((sample) => sample.id === selected.id) : -1;

  async function loadSamples() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/samples${queryString ? `?${queryString}` : ""}`, { cache: "no-store" });
    setLoading(false);
    if (!response.ok) {
      setError("검수 샘플을 불러오지 못했습니다.");
      return;
    }
    const data = await response.json();
    const nextSamples = (data.samples ?? []) as TranslationSample[];
    setSamples(nextSamples);
    setHospitals((data.hospitals ?? []) as HospitalOption[]);
    setDrafts(Object.fromEntries(nextSamples.map((sample) => [sample.id, initialDraft(sample)])));
    setSelectedId((current) => nextSamples.some((sample) => sample.id === current) ? current : nextSamples[0]?.id ?? "");
  }

  useEffect(() => {
    void loadSamples();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  function updateDraft(update: Partial<ReviewDraft>) {
    if (!selected) return;
    setDrafts((current) => ({ ...current, [selected.id]: { ...(current[selected.id] ?? initialDraft(selected)), ...update } }));
  }

  function chooseReviewKind(reviewKind: ReviewKind) {
    if (!draft) return;
    updateDraft({
      reviewKind,
      assetType: reviewKind === "stt_error" && draft.assetType === "none" ? "transcription_hint" : reviewKind === "noise" || reviewKind === "uncertain" ? "none" : draft.assetType
    });
  }

  function extractSttDifference() {
    if (!selected || !draft) return;
    const difference = changedTranscriptionSpan(selected.sourceText, draft.correctedSourceText);
    if (!difference.observedForm || !difference.canonicalForm) {
      setError("원문과 교정문에서 서로 다른 구간을 찾지 못했습니다.");
      return;
    }
    setError("");
    updateDraft({ assetSpokenForm: difference.observedForm, assetStandardKo: difference.canonicalForm });
  }

  function chooseAsset(assetType: Exclude<AssetType, "none">) {
    if (!selected || !draft) return;
    const koreanText = selected.sourceLanguage === "ko" ? draft.correctedSourceText : selected.targetLanguage === "ko" ? draft.correctedTranslatedText : "";
    const translation = selected.sourceLanguage === "ko" ? draft.correctedTranslatedText : selected.targetLanguage === "ko" ? draft.correctedSourceText : "";
    updateDraft({ assetType, assetStandardKo: draft.assetStandardKo || koreanText, assetTranslation: draft.assetTranslation || translation });
  }

  async function saveReview(forcedKind?: ReviewKind) {
    if (!selected || !draft) return;
    setSaving(true);
    setError("");
    setNotice("");
    const payload = { ...draft, id: selected.id, reviewKind: forcedKind ?? draft.reviewKind, assetType: forcedKind === "uncertain" || forcedKind === "noise" ? "none" : draft.assetType };
    const response = await fetch("/api/admin/sample-learning", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "검수 결과를 저장하지 못했습니다.");
      return;
    }

    const updated = data.sample as TranslationSample;
    const remaining = filters.status && updated.status !== filters.status ? samples.filter((sample) => sample.id !== updated.id) : samples.map((sample) => sample.id === updated.id ? updated : sample);
    setSamples(remaining);
    setSelectedId(remaining[Math.min(Math.max(selectedIndex, 0), Math.max(remaining.length - 1, 0))]?.id ?? "");
    setNotice(data.promotion ? `품질 자산 반영 완료: ${data.promotion.standardKo} · 다음 번역부터 적용됩니다.` : "검수를 저장하고 다음 샘플로 이동했습니다.");
  }

  function moveSelection(offset: number) {
    if (!filteredSamples.length) return;
    const nextIndex = Math.min(Math.max(selectedIndex + offset, 0), filteredSamples.length - 1);
    setSelectedId(filteredSamples[nextIndex].id);
    setError("");
    setNotice("");
  }

  return (
    <div className="space-y-5">
      <AdminQualityWorkspaceNav active="samples" queueCount={samples.filter((sample) => sample.status === "new").length} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-trust-text">MediVoice Quality</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight text-ink">증거 중심 번역 검수</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">원문과 번역을 비교하고 검증된 결과를 다음 번역의 품질 자산으로 연결합니다.</p>
        </div>
        <button type="button" onClick={() => void loadSamples()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ink shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust">
          <RefreshCw size={17} aria-hidden="true" /> 새로고침
        </button>
      </header>

      <div aria-live="polite" className="space-y-2">
        {error ? <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {notice ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl bg-white shadow-soft">
          <div className="border-b border-line p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-ink">검수 큐</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">{filteredSamples.length}개 표시</p>
              </div>
              <Filter size={18} className="text-slate-400" aria-hidden="true" />
            </div>
            <label className="relative mt-3 block">
              <span className="sr-only">샘플 검색</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
              <input className="h-11 w-full rounded-lg border border-line bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white" value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="원문·번역 검색" />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Select value={filters.status} ariaLabel="검수 상태" onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={[["new", "검수 대기"], ["", "전체 상태"], ["reviewed", "검수 완료"], ["fixed", "자산 반영"], ["dismissed", "제외"]]} />
              <Select value={filters.source} ariaLabel="통역 모드" onChange={(value) => setFilters((current) => ({ ...current, source: value }))} options={[["", "전체 모드"], ["local_voice", "대면"], ["consultation_voice", "상담"], ["procedure_voice", "시술"]]} />
            </div>
            {hospitals.length ? <div className="mt-2"><Select value={filters.hospitalId} ariaLabel="병원" onChange={(value) => setFilters((current) => ({ ...current, hospitalId: value }))} options={[["", "전체 병원"], ...hospitals.map((hospital) => [hospital.id, hospital.name] as [string, string])]} /></div> : null}
          </div>

          <div className="max-h-[720px] overflow-y-auto">
            {loading ? <AdminLoadingSkeleton rows={5} /> : filteredSamples.length === 0 ? <p className="px-4 py-8 text-center text-sm font-semibold text-slate-500">조건에 맞는 샘플이 없습니다.</p> : filteredSamples.map((sample) => {
              const active = selected?.id === sample.id;
              return (
                <button key={sample.id} type="button" onClick={() => setSelectedId(sample.id)} className={`block w-full border-b border-line px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-trust ${active ? "bg-blue-50/70" : "hover:bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
                    <span>{sample.sourceLanguage.toUpperCase()} <ArrowRight className="mx-1 inline" size={12} /> {sample.targetLanguage.toUpperCase()}</span>
                    <span>{new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(sample.createdAt))}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-ink">{sample.sourceText}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-slate-500">{sourceLabels[sample.source]}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${statusStyle(sample.status)}`}>{statusLabels[sample.status]}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 overflow-hidden rounded-xl bg-white shadow-soft lg:flex lg:max-h-[calc(100vh-210px)] lg:flex-col">
          {!selected || !draft ? (
            <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
              <CheckCircle2 size={40} className="text-mint-text" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-bold text-ink">검수할 샘플이 없습니다</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">새 샘플이 수집되면 이 대기함에 표시됩니다.</p>
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-line px-5 py-4 sm:px-6">
                <div className="grid grid-cols-3 gap-2">
                  <Step number="1" title="원문 확인" subtitle="의도와 맥락" active />
                  <Step number="2" title="번역 비교" subtitle="차이점 판정" active />
                  <Step number="3" title="품질 자산" subtitle="교정 및 자산화" active={draft.assetType !== "none"} />
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                <section aria-labelledby="evidence-title">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted">검수 대상</p>
                      <h2 id="evidence-title" className="mt-1 text-lg font-bold text-ink">원문과 번역 증거</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => moveSelection(-1)} disabled={selectedIndex <= 0} aria-label="이전 샘플" className="grid h-11 w-11 place-items-center rounded-lg border border-line text-slate-600 disabled:opacity-30"><ChevronLeft size={18} /></button>
                      <span className="text-xs font-bold text-slate-500">{selectedIndex + 1} / {filteredSamples.length}</span>
                      <button type="button" onClick={() => moveSelection(1)} disabled={selectedIndex >= filteredSamples.length - 1} aria-label="다음 샘플" className="grid h-11 w-11 place-items-center rounded-lg border border-line text-slate-600 disabled:opacity-30"><ChevronRight size={18} /></button>
                    </div>
                  </div>

                  <div className="mt-4 grid border-y border-line lg:grid-cols-2 lg:divide-x lg:divide-line">
                    <EvidenceColumn label={`원문 (${selected.sourceLanguage.toUpperCase()})`} value={selected.sourceText} />
                    <EvidenceColumn label={`현재 번역 (${selected.targetLanguage.toUpperCase()})`} value={selected.translatedText} tone="blue" />
                  </div>
                  <dl className="mt-4 grid gap-x-5 gap-y-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    <Meta label="병원" value={selected.hospital?.name ?? selected.hospitalId} />
                    <Meta label="모드" value={sourceLabels[selected.source]} />
                    <Meta label="방향" value={selected.direction} />
                    <Meta label="모델" value={selected.model ?? "-"} />
                  </dl>
                </section>

                <section aria-labelledby="correction-title" className="border-t border-line pt-5">
                  <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
                    <label className="grid content-start gap-2">
                      <span id="correction-title" className="text-sm font-bold text-ink">검수 판정</span>
                      <Select value={draft.reviewKind} ariaLabel="검수 판정" onChange={(value) => chooseReviewKind(value as ReviewKind)} options={(Object.keys(reviewKindLabels) as ReviewKind[]).map((kind) => [kind, reviewKindLabels[kind]])} />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-bold text-ink">판정 근거</span>
                      <input className="h-11 rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white" value={draft.reviewNote} onChange={(event) => updateDraft({ reviewNote: event.target.value })} placeholder="왜 수정하거나 제외하는지 간단히 기록" />
                    </label>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
                    <LabeledTextarea label="교정 원문" value={draft.correctedSourceText} onChange={(value) => updateDraft({ correctedSourceText: value })} />
                    <ArrowRight className="mx-auto hidden text-slate-400 lg:block" size={20} aria-hidden="true" />
                    <LabeledTextarea label="교정 번역" value={draft.correctedTranslatedText} onChange={(value) => updateDraft({ correctedTranslatedText: value })} />
                  </div>
                </section>

                <section aria-labelledby="asset-title" className="border-t border-line pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 id="asset-title" className="text-lg font-bold text-ink">품질 자산으로 반영</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-500">검증한 내용을 선택한 범위의 다음 번역부터 사용합니다.</p>
                    </div>
                    <button type="button" onClick={() => updateDraft({ assetType: "none" })} className="min-h-11 rounded-lg px-3 text-sm font-bold text-slate-500 hover:bg-slate-100">자산화 안 함</button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {(Object.keys(assetLabels) as Array<Exclude<AssetType, "none">>).map((type) => {
                      const disabled = type === "transcription_hint" && selected.sourceLanguage !== "ko";
                      const active = draft.assetType === type;
                      return (
                        <button key={type} type="button" disabled={disabled} onClick={() => chooseAsset(type)} className={`min-h-24 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-trust bg-blue-50" : "border-line bg-white hover:border-blue-200 hover:bg-slate-50"}`}>
                          <span className="flex items-center gap-2 text-sm font-bold text-ink">{active ? <CheckCircle2 size={18} className="text-trust-text" /> : <Database size={18} className="text-slate-400" />}{assetLabels[type].title}</span>
                          <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">{assetLabels[type].description}</span>
                        </button>
                      );
                    })}
                  </div>

                  {draft.assetType !== "none" ? (
                    <div className="mt-4 rounded-xl bg-slate-50 p-4">
                      <div className="grid gap-3 lg:grid-cols-2">
                        {draft.assetType === "transcription_hint" ? (
                          <label className="grid gap-2">
                            <span className="text-xs font-bold text-slate-600">잘못 인식된 표현</span>
                            <div className="flex gap-2">
                              <input className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust" value={draft.assetSpokenForm} onChange={(event) => updateDraft({ assetSpokenForm: event.target.value })} />
                              <button type="button" onClick={extractSttDifference} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink"><WandSparkles size={16} /> 차이 추출</button>
                            </div>
                          </label>
                        ) : (
                          <label className="grid gap-2">
                            <span className="text-xs font-bold text-slate-600">발화형·별칭</span>
                            <input className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust" value={draft.assetSpokenForm} onChange={(event) => updateDraft({ assetSpokenForm: event.target.value })} placeholder="선택 입력" />
                          </label>
                        )}
                        <label className="grid gap-2">
                          <span className="text-xs font-bold text-slate-600">표준 한국어</span>
                          <input className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust" value={draft.assetStandardKo} onChange={(event) => updateDraft({ assetStandardKo: event.target.value })} />
                        </label>
                        {draft.assetType !== "transcription_hint" ? (
                          <label className="grid gap-2">
                            <span className="text-xs font-bold text-slate-600">현재 언어 기준 번역</span>
                            <input className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust" value={draft.assetTranslation} onChange={(event) => updateDraft({ assetTranslation: event.target.value })} />
                          </label>
                        ) : null}
                        <div className="grid grid-cols-2 gap-3">
                          <label className="grid gap-2"><span className="text-xs font-bold text-slate-600">적용 범위</span><Select value={draft.promotionScope} ariaLabel="적용 범위" onChange={(value) => updateDraft({ promotionScope: value as PromotionScope })} options={hospitals.length ? [["hospital", "이 병원"], ["specialty", "같은 진료과"], ["global", "전체 병원"]] : [["hospital", "이 병원"]]} /></label>
                          <label className="grid gap-2"><span className="text-xs font-bold text-slate-600">분류</span><input className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust" value={draft.assetCategory} onChange={(event) => updateDraft({ assetCategory: event.target.value })} /></label>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                        <p className="flex items-center gap-2 text-sm font-bold text-emerald-700"><ShieldCheck size={18} /> 저장 시 중복·별칭 충돌 자동 검사</p>
                        <p className="flex items-center gap-2 text-sm font-bold text-trust-text"><ArrowRight size={18} /> 승인 후 다음 번역부터 적용</p>
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>

              <div className="sticky bottom-0 grid shrink-0 gap-3 border-t border-line bg-white/95 p-4 backdrop-blur-sm sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-6">
                <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs font-bold text-slate-500">생성될 자산 미리보기</p>
                  <p className="mt-1 truncate text-sm font-bold text-ink">{draft.assetType === "none" ? "검수 결과만 저장" : `${assetLabels[draft.assetType].title} · ${draft.assetStandardKo || "표준 한국어 입력 필요"}`}</p>
                </div>
                <button type="button" disabled={saving} onClick={() => void saveReview("uncertain")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-white px-5 text-sm font-bold text-ink disabled:opacity-50"><CirclePause size={18} /> 보류</button>
                <button type="button" disabled={saving} onClick={() => void saveReview()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-trust px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust focus-visible:ring-offset-2">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}{saving ? "저장 중..." : draft.assetType === "none" ? "검수 완료 및 다음 샘플" : "승인하고 다음 샘플"}
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Step({ number, title, subtitle, active }: { number: string; title: string; subtitle: string; active: boolean }) {
  return <div className={`flex min-w-0 items-center gap-2 ${active ? "text-trust-text" : "text-muted"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${active ? "bg-trust text-white" : "bg-slate-100 text-slate-500"}`}>{number}</span><span className="min-w-0"><span className="block truncate text-sm font-bold">{title}</span><span className="hidden truncate text-xs font-semibold text-muted sm:block">{subtitle}</span></span></div>;
}

function EvidenceColumn({ label, value, tone = "plain" }: { label: string; value: string; tone?: "plain" | "blue" }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return <div className="min-w-0 px-1 py-4 lg:px-5"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p><button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold text-slate-500 hover:bg-slate-100"><Copy size={15} />{copied ? "복사됨" : "복사"}</button></div><p className={`mt-3 whitespace-pre-wrap rounded-lg px-3 py-3 text-base font-bold leading-7 text-ink ${tone === "blue" ? "bg-blue-50" : "bg-slate-50"}`}>{value}</p></div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-bold text-muted">{label}</dt><dd className="mt-1 truncate font-bold text-ink">{value}</dd></div>;
}

function LabeledTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2"><span className="text-xs font-bold text-slate-600">{label}</span><textarea className="min-h-24 resize-y rounded-lg border border-line bg-slate-50 px-3 py-3 text-sm font-semibold leading-6 outline-none focus:border-trust focus:bg-white" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ value, onChange, options, ariaLabel }: { value: string; onChange: (value: string) => void; options: Array<[string, string]>; ariaLabel: string }) {
  return <select aria-label={ariaLabel} className="h-11 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>;
}
