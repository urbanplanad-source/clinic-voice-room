"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, RefreshCw, Save, ScanSearch, Search } from "lucide-react";
import { changedTranscriptionSpan } from "@/lib/clinic-transcription";

type SampleSource = "local_voice" | "consultation_voice" | "procedure_voice";
type SampleStatus = "new" | "reviewed" | "fixed" | "dismissed";
type ReviewKind = "source_correct" | "stt_error" | "translation_error" | "noise" | "uncertain";
type PromotionScope = "hospital" | "specialty" | "global";

type HospitalOption = {
  id: string;
  name: string;
  slug: string;
};

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
  reviewNote: string;
  hintObservedForm: string;
  hintCanonicalForm: string;
  hintCategory: string;
  promotionScope: PromotionScope;
  promoteToSttHint: boolean;
};

const sources = ["local_voice", "consultation_voice", "procedure_voice"] as const;
const statuses: SampleStatus[] = ["new", "reviewed", "fixed", "dismissed"];

const reviewKindLabels: Record<ReviewKind, string> = {
  source_correct: "원문 인식 정상",
  stt_error: "한국어 음성인식 오류",
  translation_error: "번역만 오류",
  noise: "잡음 또는 무의미",
  uncertain: "판단 보류"
};

const statusLabels: Record<SampleStatus, string> = {
  new: "검수 대기",
  reviewed: "검수 완료",
  fixed: "힌트 반영",
  dismissed: "제외"
};

const sourceLabels: Record<SampleSource, string> = {
  local_voice: "Face-to-face",
  consultation_voice: "Consultation",
  procedure_voice: "Procedure"
};

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function reviewDraftFromSample(sample: TranslationSample): ReviewDraft {
  const review = objectValue(objectValue(sample.guardFlags).adminReview);
  const reviewKind = stringValue(review.kind);
  return {
    reviewKind: reviewKind in reviewKindLabels ? reviewKind as ReviewKind : "source_correct",
    correctedSourceText: stringValue(review.correctedSourceText) || sample.sourceText,
    reviewNote: stringValue(review.note),
    hintObservedForm: stringValue(review.hintObservedForm),
    hintCanonicalForm: stringValue(review.hintCanonicalForm),
    hintCategory: stringValue(review.hintCategory) || "sample_stt",
    promotionScope: (["hospital", "specialty", "global"] as string[]).includes(stringValue(review.promotionScope))
      ? stringValue(review.promotionScope) as PromotionScope
      : "hospital",
    promoteToSttHint: Boolean(review.promotedGlossaryEntryId)
  };
}

export function AdminTranslationSampleManager() {
  const [samples, setSamples] = useState<TranslationSample[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [filters, setFilters] = useState({ q: "", hospitalId: "", source: "", status: "new" });
  const [expandedId, setExpandedId] = useState("");
  const [savingId, setSavingId] = useState("");
  const [loading, setLoading] = useState(true);
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
    const q = filters.q.trim().toLowerCase();
    if (!q) return samples;
    return samples.filter((item) => {
      const haystack = [
        item.hospital?.name ?? "",
        item.hospital?.slug ?? "",
        item.staff?.name ?? "",
        item.staff?.email ?? "",
        item.sourceText,
        item.translatedText,
        item.source,
        item.mode,
        item.direction,
        item.patientLanguage ?? "",
        item.sourceLanguage,
        item.targetLanguage,
        item.model ?? ""
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [samples, filters.q]);

  async function loadSamples() {
    setLoading(true);
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/samples${queryString ? `?${queryString}` : ""}`, { cache: "no-store" });
    setLoading(false);
    if (!response.ok) {
      setError("Samples could not be loaded.");
      return;
    }

    const data = await response.json();
    const nextSamples = (data.samples ?? []) as TranslationSample[];
    setSamples(nextSamples);
    setHospitals((data.hospitals ?? []) as HospitalOption[]);
    setReviewDrafts(Object.fromEntries(nextSamples.map((sample) => [sample.id, reviewDraftFromSample(sample)])));
  }

  useEffect(() => {
    void loadSamples();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const total = filteredSamples.length;

  function updateReviewDraft(sampleId: string, update: Partial<ReviewDraft>) {
    setReviewDrafts((current) => ({
      ...current,
      [sampleId]: { ...(current[sampleId] ?? reviewDraftFromSample(samples.find((sample) => sample.id === sampleId)!)), ...update }
    }));
  }

  function extractChangedSpan(sample: TranslationSample) {
    const draft = reviewDrafts[sample.id] ?? reviewDraftFromSample(sample);
    const difference = changedTranscriptionSpan(sample.sourceText, draft.correctedSourceText);
    if (!difference.observedForm || !difference.canonicalForm) {
      setError("원문과 교정문에서 서로 다른 구간을 찾지 못했습니다.");
      return;
    }
    setError("");
    updateReviewDraft(sample.id, {
      hintObservedForm: difference.observedForm,
      hintCanonicalForm: difference.canonicalForm
    });
  }

  async function saveReview(sample: TranslationSample) {
    const draft = reviewDrafts[sample.id] ?? reviewDraftFromSample(sample);
    setSavingId(sample.id);
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/samples", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sample.id, ...draft })
    });
    const data = await response.json().catch(() => ({}));
    setSavingId("");
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "샘플 검수를 저장하지 못했습니다.");
      return;
    }

    const updated = data.sample as TranslationSample;
    setSamples((current) => {
      if (filters.status && updated.status !== filters.status) return current.filter((item) => item.id !== updated.id);
      return current.map((item) => item.id === updated.id ? updated : item);
    });
    setReviewDrafts((current) => ({ ...current, [updated.id]: reviewDraftFromSample(updated) }));
    setExpandedId("");
    setNotice(data.promotion
      ? `검수 완료: STT 힌트를 ${data.promotion.action === "merged" ? "기존 항목에 병합" : "새로 추가"}했습니다.`
      : "샘플 검수를 저장했습니다.");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-trust-text">Translation Samples</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight text-ink">음성 번역 검수</h1>
        </div>
        <button type="button" onClick={() => void loadSamples()} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ink shadow-sm">
          <RefreshCw size={17} />
          새로고침
        </button>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryStat label="현재 표시" value={total.toLocaleString()} />
        <SummaryStat label="불러온 샘플" value={samples.length.toLocaleString()} />
        <SummaryStat label="한국어 원문" value={samples.filter((sample) => sample.sourceLanguage === "ko").length.toLocaleString()} />
      </section>

      <section className="rounded-lg bg-white p-5 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              className="h-11 w-full rounded-lg border border-line bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white"
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="원문, 번역, 직원 검색"
            />
          </label>
          <Select
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            options={[["", "전체 상태"], ...statuses.map((status) => [status, statusLabels[status]] as [string, string])]}
          />
          <Select
            value={filters.source}
            onChange={(value) => setFilters((current) => ({ ...current, source: value }))}
            options={[["", "전체 모드"], ...sources.map((source) => [source, sourceLabels[source]] as [string, string])]}
          />
          {hospitals.length ? (
            <Select
              value={filters.hospitalId}
              onChange={(value) => setFilters((current) => ({ ...current, hospitalId: value }))}
              options={[["", "전체 병원"], ...hospitals.map((hospital) => [hospital.id, hospital.name] as [string, string])]}
            />
          ) : <div />}
          <button type="button" onClick={() => setFilters({ q: "", hospitalId: "", source: "", status: "new" })} className="h-11 rounded-lg bg-slate-100 px-4 text-sm font-bold text-ink">
            초기화
          </button>
        </div>
      </section>

      {error ? <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}

      <section className="overflow-x-auto rounded-lg bg-white shadow-soft">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-4">원문과 번역</th>
              <th className="px-4 py-4">사용 정보</th>
              <th className="px-4 py-4">품질 검수</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-5 py-6 font-semibold text-slate-500">불러오는 중...</td>
              </tr>
            ) : filteredSamples.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-6 font-semibold text-slate-500">조건에 맞는 샘플이 없습니다.</td>
              </tr>
            ) : (
              filteredSamples.map((item) => {
                const expanded = expandedId === item.id;
                const draft = reviewDrafts[item.id] ?? reviewDraftFromSample(item);
                return (
                  <Fragment key={item.id}>
                    <tr className="border-t border-line align-top">
                      <td className="w-[560px] px-4 py-4">
                        <div className="grid gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase text-muted">Source</p>
                            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-ink">{item.sourceText}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase text-muted">Translation</p>
                            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold leading-6 text-ink">{item.translatedText}</p>
                          </div>
                        </div>
                      </td>
                      <td className="w-[340px] px-4 py-4">
                        <div className="grid gap-2 text-sm font-semibold text-slate-600">
                          <p><span className="font-bold text-ink">병원:</span> {item.hospital?.name ?? item.hospitalId}</p>
                          <p><span className="font-bold text-ink">직원:</span> {item.staff ? `${item.staff.name} (${item.staff.email})` : "-"}</p>
                          <p><span className="font-bold text-ink">모드:</span> {sourceLabels[item.source] ?? item.source}</p>
                          <p><span className="font-bold text-ink">방향:</span> {item.direction}</p>
                          <p><span className="font-bold text-ink">언어:</span> {item.sourceLanguage} {"->"} {item.targetLanguage}</p>
                          <p><span className="font-bold text-ink">모델:</span> {item.model ?? "-"}</p>
                          <p><span className="font-bold text-ink">시각:</span> {new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</p>
                        </div>
                      </td>
                      <td className="w-[240px] px-4 py-4">
                        <div className="grid gap-3">
                          <StatusPill status={item.status} />
                          <QualitySignals guardFlags={item.guardFlags} />
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? "" : item.id)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-ink"
                          >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {expanded ? "검수 닫기" : "검수하기"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-line bg-slate-50/70">
                        <td colSpan={3} className="px-4 py-4">
                          <SampleReviewPanel
                            sample={item}
                            draft={draft}
                            canChooseBroadScope={hospitals.length > 0}
                            saving={savingId === item.id}
                            onChange={(update) => updateReviewDraft(item.id, update)}
                            onExtract={() => extractChangedSpan(item)}
                            onSave={() => void saveReview(item)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: SampleStatus }) {
  const styles: Record<SampleStatus, string> = {
    new: "bg-amber-50 text-amber-800",
    reviewed: "bg-blue-50 text-blue-800",
    fixed: "bg-emerald-50 text-emerald-800",
    dismissed: "bg-slate-100 text-slate-600"
  };
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${styles[status]}`}>
      {status === "fixed" ? <Check size={14} /> : null}
      {statusLabels[status]}
    </span>
  );
}

function QualitySignals({ guardFlags }: { guardFlags: Record<string, unknown> | null }) {
  const flags = objectValue(guardFlags);
  const validation = objectValue(flags.localValidation);
  const canonicalization = objectValue(flags.sourceCanonicalization);
  const signals: Array<{ label: string; style: string }> = [];

  if (validation.checked === true) {
    if (validation.repaired === true) signals.push({ label: "번역 자동 교정", style: "bg-emerald-50 text-emerald-800" });
    else if (validation.ok === false) signals.push({ label: "번역 불일치", style: "bg-rose-50 text-rose-700" });
    else signals.push({ label: "의미 검증 통과", style: "bg-blue-50 text-blue-800" });
  }
  if (canonicalization.changed === true) signals.push({ label: "원문 표준화", style: "bg-violet-50 text-violet-800" });

  if (signals.length === 0) return <p className="text-xs font-semibold text-muted">자동 품질 신호 없음</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((signal) => (
        <span key={signal.label} className={`rounded-md px-2 py-1 text-[11px] font-bold ${signal.style}`}>{signal.label}</span>
      ))}
    </div>
  );
}

function SampleReviewPanel({
  sample,
  draft,
  canChooseBroadScope,
  saving,
  onChange,
  onExtract,
  onSave
}: {
  sample: TranslationSample;
  draft: ReviewDraft;
  canChooseBroadScope: boolean;
  saving: boolean;
  onChange: (update: Partial<ReviewDraft>) => void;
  onExtract: () => void;
  onSave: () => void;
}) {
  const isSttError = draft.reviewKind === "stt_error";
  const canPromote = sample.sourceLanguage === "ko";
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-slate-600">검수 분류</span>
          <Select
            value={draft.reviewKind}
            onChange={(value) => onChange({
              reviewKind: value as ReviewKind,
              promoteToSttHint: value === "stt_error" ? draft.promoteToSttHint : false
            })}
            options={(Object.keys(reviewKindLabels) as ReviewKind[]).map((kind) => [kind, reviewKindLabels[kind]])}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-slate-600">검수 메모</span>
          <input
            className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust"
            value={draft.reviewNote}
            onChange={(event) => onChange({ reviewNote: event.target.value })}
            placeholder="필요한 경우만 입력"
          />
        </label>
      </div>

      {isSttError ? (
        <div className="grid gap-4 border-t border-line pt-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-600">정확한 한국어 원문</span>
            <textarea
              className="min-h-20 w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold leading-6 outline-none focus:border-trust"
              value={draft.correctedSourceText}
              onChange={(event) => onChange({ correctedSourceText: event.target.value })}
            />
          </label>
          <div className="flex justify-end">
            <button type="button" onClick={onExtract} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-3 text-sm font-bold text-ink shadow-sm">
              <ScanSearch size={16} />
              다른 구간 추출
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-600">잘못 인식된 구간</span>
              <input className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust" value={draft.hintObservedForm} onChange={(event) => onChange({ hintObservedForm: event.target.value })} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-600">표준 표현</span>
              <input className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust" value={draft.hintCanonicalForm} onChange={(event) => onChange({ hintCanonicalForm: event.target.value })} />
            </label>
          </div>
          <label className={`flex items-center gap-2 text-sm font-bold ${canPromote ? "text-ink" : "text-slate-400"}`}>
            <input
              type="checkbox"
              checked={draft.promoteToSttHint && canPromote}
              disabled={!canPromote}
              onChange={(event) => onChange({ promoteToSttHint: event.target.checked })}
              className="h-4 w-4 accent-blue-600"
            />
            STT 힌트에 반영
          </label>
          {draft.promoteToSttHint && canPromote ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-600">적용 범위</span>
                <Select
                  value={draft.promotionScope}
                  onChange={(value) => onChange({ promotionScope: value as PromotionScope })}
                  options={canChooseBroadScope
                    ? [["hospital", "이 병원"], ["specialty", "같은 진료과"], ["global", "전체 병원"]]
                    : [["hospital", "이 병원"]]}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-600">힌트 분류</span>
                <input className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust" value={draft.hintCategory} onChange={(event) => onChange({ hintCategory: event.target.value })} />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end border-t border-line pt-4">
        <button type="button" onClick={onSave} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-trust px-4 text-sm font-bold text-white disabled:opacity-50">
          <Save size={16} />
          {saving ? "저장 중..." : "검수 저장"}
        </button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <select className="h-11 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
