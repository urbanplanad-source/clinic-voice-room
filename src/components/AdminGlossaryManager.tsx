"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Eye, Loader2, Plus, RefreshCw, Save, Search, Upload } from "lucide-react";
import { hospitalSpecialties, hospitalSpecialtyLabels, type HospitalSpecialty } from "@/lib/hospital-specialty";

type GlossaryScope = "global" | "specialty" | "hospital";
type GlossaryEntryType = "term" | "critical_phrase" | "transcription_hint" | "verified_sentence";

type HospitalOption = {
  id: string;
  name: string;
  slug: string;
  specialty: HospitalSpecialty;
};

type GlossaryEntry = {
  id: string;
  scope: GlossaryScope;
  specialty?: HospitalSpecialty | null;
  hospitalId?: string | null;
  hospital?: { id: string; name: string; slug: string } | null;
  entryType: GlossaryEntryType;
  spokenForms: string[];
  standardKo: string;
  translations: Record<string, string>;
  category?: string | null;
  note?: string | null;
  priority: number;
  isActive: boolean;
};

type FeedbackPrefill = {
  id: string;
  hospitalId: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
};

type TranscriptionPreview = {
  hospital: HospitalOption;
  source: "code" | "db";
  prompt: string;
  promptHash: string;
  chars: number;
  hintCount: number;
  mappingCount: number;
  omittedHintCount: number;
  omittedMappingCount: number;
  omittedHints: string[];
  omittedMappingStandardForms: string[];
  truncated: boolean;
  conflicts: Array<{ spokenForm: string; standardForms: string[] }>;
};

type Draft = {
  scope: GlossaryScope;
  specialty: HospitalSpecialty | "";
  hospitalId: string;
  entryType: GlossaryEntryType;
  spokenFormsText: string;
  standardKo: string;
  translations: Record<string, string>;
  category: string;
  note: string;
  priority: number;
  isActive: boolean;
};

const translationKeys = ["zh", "zh_tw", "yue", "ja", "en", "ru", "vi", "id", "th", "ms", "tl", "mn", "fr", "es", "de", "it", "pt"] as const;

const translationLabels: Record<(typeof translationKeys)[number], string> = {
  zh: "중국어",
  zh_tw: "번체",
  yue: "광둥어",
  ja: "일본어",
  en: "영어",
  ru: "러시아어",
  vi: "베트남어",
  id: "인니어",
  th: "태국어",
  ms: "말레이어",
  tl: "타갈로그",
  mn: "몽골어",
  fr: "프랑스어",
  es: "스페인어",
  de: "독일어",
  it: "이탈리아어",
  pt: "포르투갈어"
};

function isTranslationKey(value: string): value is (typeof translationKeys)[number] {
  return (translationKeys as readonly string[]).includes(value);
}

const initialDraft: Draft = {
  scope: "hospital",
  specialty: "",
  hospitalId: "",
  entryType: "term",
  spokenFormsText: "",
  standardKo: "",
  translations: {},
  category: "",
  note: "",
  priority: 100,
  isActive: true
};

function draftFromEntry(entry: GlossaryEntry): Draft {
  return {
    scope: entry.scope,
    specialty: entry.specialty ?? "",
    hospitalId: entry.hospitalId ?? "",
    entryType: entry.entryType,
    spokenFormsText: entry.spokenForms.join("|"),
    standardKo: entry.standardKo,
    translations: entry.translations ?? {},
    category: entry.category ?? "",
    note: entry.note ?? "",
    priority: entry.priority,
    isActive: entry.isActive
  };
}

function payloadFromDraft(draft: Draft) {
  return {
    scope: draft.scope,
    specialty: draft.specialty || null,
    hospitalId: draft.hospitalId || null,
    entryType: draft.entryType,
    spokenForms: draft.spokenFormsText.split("|").map((value) => value.trim()).filter(Boolean),
    standardKo: draft.standardKo,
    translations: draft.translations,
    category: draft.category || null,
    note: draft.note || null,
    priority: draft.priority,
    isActive: draft.isActive
  };
}

function draftFromFeedback(feedback: FeedbackPrefill, current: Draft): Draft {
  const translations = { ...current.translations };
  let standardKo = feedback.sourceText;

  if (feedback.sourceLanguage === "ko" && isTranslationKey(feedback.targetLanguage)) {
    translations[feedback.targetLanguage] = feedback.translatedText;
  } else if (feedback.targetLanguage === "ko" && isTranslationKey(feedback.sourceLanguage)) {
    standardKo = feedback.translatedText;
    translations[feedback.sourceLanguage] = feedback.sourceText;
  }

  return {
    ...current,
    scope: "hospital",
    hospitalId: feedback.hospitalId,
    entryType: "term",
    spokenFormsText: standardKo,
    standardKo,
    translations,
    category: current.category || "feedback",
    note: current.note || `feedback:${feedback.id}`,
    isActive: true
  };
}

export function AdminGlossaryManager() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [filters, setFilters] = useState({ q: "", scope: "", entryType: "", specialty: "", hospitalId: "" });
  const [previewHospitalId, setPreviewHospitalId] = useState("");
  const [preview, setPreview] = useState<TranscriptionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    return params.toString();
  }, [filters]);

  async function loadEntries() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/glossary${queryString ? `?${queryString}` : ""}`, { cache: "no-store" });
    setLoading(false);
    if (!response.ok) {
      setError("글로서리 목록을 불러오지 못했습니다.");
      return;
    }
    const data = await response.json();
    const nextEntries = (data.entries ?? []) as GlossaryEntry[];
    const nextHospitals = (data.hospitals ?? []) as HospitalOption[];
    setEntries(nextEntries);
    setHospitals(nextHospitals);
    setPreviewHospitalId((current) => current || nextHospitals[0]?.id || "");
    setEdits(Object.fromEntries(nextEntries.map((entry) => [entry.id, draftFromEntry(entry)])));
  }

  async function loadTranscriptionPreview() {
    setPreviewLoading(true);
    const params = new URLSearchParams();
    if (previewHospitalId) params.set("hospitalId", previewHospitalId);
    const response = await fetch(`/api/admin/glossary/preview${params.size ? `?${params}` : ""}`, { cache: "no-store" });
    setPreviewLoading(false);
    if (!response.ok) {
      setPreview(null);
      setError("STT 프롬프트 미리보기를 불러오지 못했습니다.");
      return;
    }
    setPreview(await response.json() as TranscriptionPreview);
  }

  useEffect(() => {
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  useEffect(() => {
    void loadTranscriptionPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewHospitalId]);

  useEffect(() => {
    const feedbackId = new URLSearchParams(window.location.search).get("feedbackId");
    if (!feedbackId) return;

    let cancelled = false;
    void fetch(`/api/admin/feedback?id=${encodeURIComponent(feedbackId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Feedback could not be loaded.");
        return response.json() as Promise<{ feedback?: FeedbackPrefill | null }>;
      })
      .then((data) => {
        if (cancelled || !data.feedback) return;
        setDraft((current) => draftFromFeedback(data.feedback as FeedbackPrefill, current));
        setNotice("Feedback loaded into the new glossary form.");
      })
      .catch(() => {
        if (!cancelled) setError("Feedback could not be loaded into the glossary form.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateEdit<K extends keyof Draft>(entryId: string, key: K, value: Draft[K]) {
    setEdits((current) => ({ ...current, [entryId]: { ...current[entryId], [key]: value } }));
  }

  function updateTranslation(target: "new" | string, key: string, value: string) {
    if (target === "new") {
      setDraft((current) => ({ ...current, translations: { ...current.translations, [key]: value } }));
      return;
    }
    setEdits((current) => ({
      ...current,
      [target]: {
        ...current[target],
        translations: { ...current[target]?.translations, [key]: value }
      }
    }));
  }

  async function createEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromDraft(draft))
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "항목을 추가하지 못했습니다.");
      return;
    }
    setNotice("글로서리 항목을 추가했습니다.");
    setDraft(initialDraft);
    await loadEntries();
    await loadTranscriptionPreview();
  }

  async function saveEntry(entryId: string) {
    const edit = edits[entryId];
    if (!edit) return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/glossary/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromDraft(edit))
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "항목을 저장하지 못했습니다.");
      return;
    }
    setNotice("글로서리 항목을 저장했습니다.");
    await loadEntries();
    await loadTranscriptionPreview();
  }

  async function toggleActive(entry: GlossaryEntry) {
    const edit = edits[entry.id] ?? draftFromEntry(entry);
    setEdits((current) => ({ ...current, [entry.id]: { ...edit, isActive: !edit.isActive } }));
    const response = await fetch(`/api/admin/glossary/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !edit.isActive })
    });
    if (!response.ok) {
      setError("활성 상태를 바꾸지 못했습니다.");
      await loadEntries();
      return;
    }
    await loadEntries();
    await loadTranscriptionPreview();
  }

  function exportCsv() {
    window.location.href = `/api/admin/glossary?${queryString ? `${queryString}&` : ""}format=csv`;
  }

  async function importCsv(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/glossary?format=csv", {
      method: "POST",
      headers: { "Content-Type": "text/csv; charset=utf-8" },
      body: await file.text()
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "CSV를 가져오지 못했습니다.");
      return;
    }
    const data = await response.json();
    setNotice(`CSV 가져오기 완료: ${data.imported ?? 0}개`);
    await loadEntries();
    await loadTranscriptionPreview();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-trust-text">Glossary</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight text-ink">용어 관리</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadEntries()} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ink shadow-sm">
            <RefreshCw size={17} />
            새로고침
          </button>
          <button type="button" onClick={exportCsv} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ink shadow-sm">
            <Download size={17} />
            CSV
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex h-11 items-center gap-2 rounded-lg bg-trust px-4 text-sm font-bold text-white shadow-sm">
            <Upload size={17} />
            가져오기
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void importCsv(event.target.files?.[0])} />
        </div>
      </header>

      <section className="rounded-lg bg-white p-5 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              className="h-11 w-full rounded-lg border border-line bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white"
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="검색"
            />
          </label>
          <FilterSelect value={filters.scope} onChange={(value) => setFilters((current) => ({ ...current, scope: value }))} options={[["", "전체 scope"], ["global", "Global"], ["specialty", "진료과"], ["hospital", "병원"]]} />
          <FilterSelect value={filters.entryType} onChange={(value) => setFilters((current) => ({ ...current, entryType: value }))} options={[["", "전체 유형"], ["term", "용어"], ["critical_phrase", "핵심문장"], ["transcription_hint", "STT 힌트"], ["verified_sentence", "검증문장"]]} />
          <FilterSelect value={filters.specialty} onChange={(value) => setFilters((current) => ({ ...current, specialty: value }))} options={[["", "전체 진료과"], ...hospitalSpecialties.map((specialty) => [specialty, hospitalSpecialtyLabels[specialty]] as [string, string])]} />
          <FilterSelect value={filters.hospitalId} onChange={(value) => setFilters((current) => ({ ...current, hospitalId: value }))} options={[["", "전체 병원"], ...hospitals.map((hospital) => [hospital.id, hospital.name] as [string, string])]} />
          <button type="button" onClick={() => setFilters({ q: "", scope: "", entryType: "", specialty: "", hospitalId: "" })} className="h-11 rounded-lg bg-slate-100 px-4 text-sm font-bold text-ink">
            초기화
          </button>
        </div>
      </section>

      <TranscriptionPreviewPanel
        preview={preview}
        loading={previewLoading}
        hospitals={hospitals}
        selectedHospitalId={previewHospitalId}
        onHospitalChange={setPreviewHospitalId}
        onRefresh={() => void loadTranscriptionPreview()}
      />

      <form onSubmit={createEntry} className="rounded-lg bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Plus size={19} className="text-trust-text" />
          <h2 className="text-lg font-bold text-ink">새 항목</h2>
        </div>
        <GlossaryFields draft={draft} hospitals={hospitals} onChange={updateDraft} onTranslationChange={(key, value) => updateTranslation("new", key, value)} />
        <p className="mt-3 text-xs font-semibold text-slate-500">번역 칸을 비워두면 해당 언어는 LLM 일반 번역에 맡깁니다.</p>
        <button disabled={busy} className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-trust px-4 text-sm font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          추가
        </button>
      </form>

      {error ? <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}

      <section className="overflow-x-auto rounded-lg bg-white shadow-soft">
        <table className="w-full min-w-[1500px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-4">Scope</th>
              <th className="px-4 py-4">유형</th>
              <th className="px-4 py-4">한국어</th>
              <th className="px-4 py-4">발화형</th>
              <th className="px-4 py-4">번역</th>
              <th className="px-4 py-4">메타</th>
              <th className="px-4 py-4">상태</th>
              <th className="px-4 py-4">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-6 font-semibold text-slate-500">불러오는 중...</td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-6 font-semibold text-slate-500">항목이 없습니다.</td>
              </tr>
            ) : (
              entries.map((entry) => {
                const edit = edits[entry.id] ?? draftFromEntry(entry);
                return (
                  <tr key={entry.id} className="border-t border-line align-top">
                    <td className="px-4 py-4">
                      <ScopeFields draft={edit} hospitals={hospitals} onChange={(key, value) => updateEdit(entry.id, key, value)} />
                    </td>
                    <td className="px-4 py-4">
                      <Select value={edit.entryType} onChange={(value) => updateEdit(entry.id, "entryType", value as GlossaryEntryType)} options={[["term", "용어"], ["critical_phrase", "핵심문장"], ["transcription_hint", "STT 힌트"], ["verified_sentence", "검증문장"]]} />
                    </td>
                    <td className="px-4 py-4">
                      <InlineInput value={edit.standardKo} onChange={(value) => updateEdit(entry.id, "standardKo", value)} />
                    </td>
                    <td className="px-4 py-4">
                      <InlineInput value={edit.spokenFormsText} onChange={(value) => updateEdit(entry.id, "spokenFormsText", value)} />
                    </td>
                    <td className="px-4 py-4">
                      <TranslationGrid translations={edit.translations} onChange={(key, value) => updateTranslation(entry.id, key, value)} compact />
                    </td>
                    <td className="px-4 py-4">
                      <div className="grid gap-2">
                        <InlineInput value={edit.category} onChange={(value) => updateEdit(entry.id, "category", value)} placeholder="category" />
                        <InlineInput value={edit.note} onChange={(value) => updateEdit(entry.id, "note", value)} placeholder="note" />
                        <input className="h-10 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none" type="number" value={edit.priority} onChange={(event) => updateEdit(entry.id, "priority", Number(event.target.value))} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => void toggleActive(entry)} className={`h-10 rounded-lg px-3 text-sm font-bold ${edit.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {edit.isActive ? "활성" : "비활성"}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => void saveEntry(entry.id)} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-trust px-3 text-sm font-bold text-white disabled:opacity-50">
                        <Save size={16} />
                        저장
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function TranscriptionPreviewPanel({
  preview,
  loading,
  hospitals,
  selectedHospitalId,
  onHospitalChange,
  onRefresh
}: {
  preview: TranscriptionPreview | null;
  loading: boolean;
  hospitals: HospitalOption[];
  selectedHospitalId: string;
  onHospitalChange: (hospitalId: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Eye size={19} className="text-trust-text" />
          <div>
            <h2 className="text-lg font-bold text-ink">실제 STT 프롬프트</h2>
            <p className="text-xs font-semibold text-slate-500">{preview?.hospital.name ?? "병원 기준을 불러오는 중"}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          {hospitals.length ? (
            <Select
              value={selectedHospitalId}
              onChange={onHospitalChange}
              options={hospitals.map((hospital) => [hospital.id, hospital.name])}
            />
          ) : null}
          <button type="button" onClick={onRefresh} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-ink">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            갱신
          </button>
        </div>
      </div>

      {preview ? (
        <div className="mt-4 grid gap-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line py-4 text-sm md:grid-cols-5">
            <PreviewMetric label="데이터" value={preview.source === "db" ? "운영 DB" : "코드"} />
            <PreviewMetric label="프롬프트" value={`${preview.chars.toLocaleString()}자`} />
            <PreviewMetric label="표준 힌트" value={preview.hintCount.toLocaleString()} />
            <PreviewMetric label="발화형 매핑" value={preview.mappingCount.toLocaleString()} />
            <PreviewMetric label="충돌" value={preview.conflicts.length.toLocaleString()} />
          </div>
          {preview.conflicts.length ? (
            <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              <div className="flex items-center gap-2 font-bold"><AlertTriangle size={16} />발화형 충돌 {preview.conflicts.length}건</div>
              <p className="mt-1 leading-6">{preview.conflicts.slice(0, 5).map((conflict) => `${conflict.spokenForm} → ${conflict.standardForms.join(" / ")}`).join(" · ")}</p>
            </div>
          ) : null}
          {preview.truncated ? (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              <p>글자 예산으로 매핑 {preview.omittedMappingCount}개, 힌트 {preview.omittedHintCount}개가 제외됐습니다. 우선순위 숫자가 작은 항목부터 적용됩니다.</p>
              {preview.omittedMappingStandardForms.length ? <p className="mt-1 text-xs leading-5">제외 매핑: {preview.omittedMappingStandardForms.slice(0, 12).join(" · ")}{preview.omittedMappingStandardForms.length > 12 ? " 외" : ""}</p> : null}
              {preview.omittedHints.length ? <p className="mt-1 text-xs leading-5">제외 힌트: {preview.omittedHints.slice(0, 12).join(" · ")}{preview.omittedHints.length > 12 ? " 외" : ""}</p> : null}
            </div>
          ) : null}
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-slate-50 p-4 text-xs font-semibold leading-5 text-slate-700">{preview.prompt}</pre>
          <p className="text-right text-[11px] font-semibold text-slate-400">hash {preview.promptHash} · 새 Realtime 세션부터 적용</p>
        </div>
      ) : (
        <p className="mt-4 text-sm font-semibold text-slate-500">{loading ? "미리보기를 만드는 중..." : "미리보기를 불러오지 못했습니다."}</p>
      )}
    </section>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className="mt-1 font-bold text-ink">{value}</p>
    </div>
  );
}

function GlossaryFields({
  draft,
  hospitals,
  onChange,
  onTranslationChange
}: {
  draft: Draft;
  hospitals: HospitalOption[];
  onChange: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  onTranslationChange: (key: string, value: string) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <ScopeFields draft={draft} hospitals={hospitals} onChange={onChange} />
        <Select value={draft.entryType} onChange={(value) => onChange("entryType", value as GlossaryEntryType)} options={[["term", "용어"], ["critical_phrase", "핵심문장"], ["transcription_hint", "STT 힌트"], ["verified_sentence", "검증문장"]]} />
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-slate-600">{draft.entryType === "transcription_hint" ? "최종 표준 표현" : "표준 한국어"}</span>
          <InlineInput value={draft.standardKo} onChange={(value) => onChange("standardKo", value)} placeholder="써마지" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-slate-600">발음·오인식 형태</span>
          <InlineInput value={draft.spokenFormsText} onChange={(value) => onChange("spokenFormsText", value)} placeholder="서마지 | 서머지 | 써머지" />
        </label>
      </div>
      {draft.entryType === "transcription_hint" ? (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold leading-5 text-blue-800">
          앱에 표시할 정확한 표현은 표준 표현에 한 번만 입력하고, 실제로 잘못 들린 형태는 발음·오인식 형태에 | 로 구분해 입력합니다.
        </p>
      ) : null}
      {draft.entryType === "verified_sentence" ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
          이 문장은 등록된 번역문이 글자 그대로 나갑니다. 의학적 검수를 거친 번역만 입력하세요.
        </p>
      ) : null}
      {draft.entryType !== "transcription_hint" ? <TranslationGrid translations={draft.translations} onChange={onTranslationChange} /> : null}
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
        <InlineInput value={draft.category} onChange={(value) => onChange("category", value)} placeholder="category" />
        <InlineInput value={draft.note} onChange={(value) => onChange("note", value)} placeholder="note" />
        <input className="h-10 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none" type="number" value={draft.priority} onChange={(event) => onChange("priority", Number(event.target.value))} />
      </div>
    </div>
  );
}

function ScopeFields({
  draft,
  hospitals,
  onChange
}: {
  draft: Draft;
  hospitals: HospitalOption[];
  onChange: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <div className="grid gap-2">
      <Select value={draft.scope} onChange={(value) => onChange("scope", value as GlossaryScope)} options={[["global", "Global"], ["specialty", "진료과"], ["hospital", "병원"]]} />
      {draft.scope === "specialty" ? (
        <Select value={draft.specialty} onChange={(value) => onChange("specialty", value as HospitalSpecialty)} options={hospitalSpecialties.map((specialty) => [specialty, hospitalSpecialtyLabels[specialty]] as [string, string])} />
      ) : null}
      {draft.scope === "hospital" && hospitals.length ? (
        <Select value={draft.hospitalId} onChange={(value) => onChange("hospitalId", value)} options={[["", "병원 선택"], ...hospitals.map((hospital) => [hospital.id, hospital.name] as [string, string])]} />
      ) : null}
    </div>
  );
}

function TranslationGrid({ translations, onChange, compact = false }: { translations: Record<string, string>; onChange: (key: string, value: string) => void; compact?: boolean }) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
      {translationKeys.map((key) => (
        <label key={key} className="block">
          <span className="text-[11px] font-bold text-slate-500">{translationLabels[key]}</span>
          <input
            className="mt-1 h-9 w-full rounded-lg border border-line bg-slate-50 px-2 text-xs font-semibold outline-none focus:border-trust focus:bg-white"
            value={translations[key] ?? ""}
            onChange={(event) => onChange(key, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <Select value={value} onChange={onChange} options={options} />;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <select className="h-10 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function InlineInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <input
      className="h-10 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}
